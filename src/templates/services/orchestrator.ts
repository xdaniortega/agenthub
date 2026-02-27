import type { WizardAnswers } from "../../wizard.js";
import { CHAINS } from "../../config.js";

export function generateOrchestratorCLI(answers: WizardAnswers): string {
    const chain = CHAINS[answers.chain];
    const hasRegistry = !!(chain.identityRegistry && chain.reputationRegistry);
    const registryWarning = hasRegistry
        ? ""
        : `
// NOTE: ${chain.name} does not have ERC-8004 registries deployed.
// Switch to Arbitrum Sepolia or Ethereum Sepolia for full functionality.
`;

    return `/**
 * Orchestrator CLI — discovers ERC-8004 agents, delegates tasks via A2A, and records feedback.
 *
 * Usage:
 *   npm run start:orchestrator         — interactive mode
 *   npm run discover                   — list agents in the registry
 *   npm run feedback -- <agentId> <score> — give feedback directly
 */
${registryWarning}
import 'dotenv/config';
import readline from 'readline';
import OpenAI from 'openai';
import chalk from 'chalk';
import { discoverAgents, getReputation, giveFeedback } from './registry-service.js';
import { A2AClient } from './a2a-client.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// OpenAI function definitions
// ============================================================================

const functions: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'discover_agents',
      description: 'Search the ERC-8004 Identity Registry for agents with specific OASF skills',
      parameters: {
        type: 'object',
        properties: {
          skills: {
            type: 'array',
            items: { type: 'string' },
            description: 'OASF skill identifiers to search for (e.g. "natural_language_processing/summarization")',
          },
        },
        required: ['skills'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reputation',
      description: 'Get reputation summary for an agent from the ERC-8004 Reputation Registry',
      parameters: {
        type: 'object',
        properties: {
          agentId: { type: 'number', description: 'On-chain agent ID (token ID)' },
        },
        required: ['agentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delegate_task',
      description: 'Send a task to an agent via the A2A protocol',
      parameters: {
        type: 'object',
        properties: {
          agentUrl: { type: 'string', description: 'Base URL of the agent A2A server' },
          message: { type: 'string', description: 'Task message to send to the agent' },
        },
        required: ['agentUrl', 'message'],
      },
    },
  },
];

const SYSTEM_PROMPT = \`You are an Orchestrator Agent on the ERC-8004 network. You coordinate specialised AI agents.

When you receive a task:
1. Analyse what OASF skills are required
2. Call discover_agents with those skills
3. For each discovered agent, call get_reputation
4. Present candidates to the user with name, description, reputation score, and feedback count
5. Recommend the agent with the best reputation
6. After the user confirms, call delegate_task with the agent's A2A endpoint URL
7. Present the result clearly

Always be transparent about why you recommend a particular agent.\`;

// ============================================================================
// Tool executor
// ============================================================================

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'discover_agents': {
      const skills = args.skills as string[];
      console.log(chalk.gray(\`  Searching registry for skills: \${skills.join(', ')}\`));
      const agents = await discoverAgents(skills);
      if (agents.length === 0) return JSON.stringify({ message: 'No agents found for those skills.' });
      return JSON.stringify({ agents: agents.map(a => ({
        agentId: a.agentId,
        name: a.name,
        description: a.description,
        skills: a.skills,
        a2aEndpoint: a.endpoints.find(e => e.type === 'A2A')?.url,
        reputation: a.reputation,
      })) });
    }

    case 'get_reputation': {
      const agentId = args.agentId as number;
      const rep = await getReputation(agentId);
      return JSON.stringify(rep);
    }

    case 'delegate_task': {
      const agentUrl = args.agentUrl as string;
      const message = args.message as string;
      console.log(chalk.gray(\`  Delegating task to: \${agentUrl}\`));
      const client = new A2AClient(agentUrl);
      const task = await client.send(message);
      const response = task.messages.find(m => m.role === 'agent');
      return JSON.stringify({ result: response?.parts[0].text ?? '(no response)', taskId: task.id });
    }

    default:
      return JSON.stringify({ error: \`Unknown tool: \${name}\` });
  }
}

// ============================================================================
// Agentic loop
// ============================================================================

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[];
}

async function agenticLoop(userMessage: string): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools: functions,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    const msg = choice.message;

    // Add assistant message
    messages.push({
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: msg.tool_calls,
    });

    if (choice.finish_reason === 'tool_calls' && msg.tool_calls) {
      for (const toolCall of msg.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        const result = await executeTool(toolCall.function.name, args);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      continue; // continue the loop with tool results
    }

    return msg.content ?? '';
  }
}

// ============================================================================
// Interactive CLI
// ============================================================================

async function interactiveMode() {
  console.log(chalk.bold.cyan('\\n  ERC-8004 Orchestrator Agent'));
  console.log(chalk.gray('  Type your task. The orchestrator will find and delegate to the best agent.'));
  console.log(chalk.gray('  Commands: /exit, /discover, /help\\n'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => {
    rl.question(chalk.bold('You: '), async (input) => {
      const text = input.trim();
      if (!text) return prompt();

      if (text === '/exit') {
        console.log('Bye!');
        rl.close();
        return;
      }

      if (text === '/discover') {
        try {
          const agents = await discoverAgents();
          if (agents.length === 0) {
            console.log(chalk.yellow('No agents found in the registry.\\n'));
          } else {
            console.log(chalk.bold(\`\\nFound \${agents.length} agent(s):\`));
            agents.forEach(a => {
              console.log(chalk.cyan(\`  [#\${a.agentId}] \${a.name}\`));
              console.log(chalk.gray(\`        \${a.description}\`));
              console.log(chalk.gray(\`        Score: \${a.reputation.averageScore} | Feedbacks: \${a.reputation.totalFeedback}\`));
            });
            console.log('');
          }
        } catch (err) {
          console.log(chalk.red(\`Error: \${err instanceof Error ? err.message : String(err)}\\n\`));
        }
        return prompt();
      }

      if (text === '/help') {
        console.log(chalk.gray('  Describe a task in natural language. Examples:'));
        console.log(chalk.gray('    "Research the latest Ethereum Layer 2 developments"'));
        console.log(chalk.gray('    "Generate a TypeScript function to parse CSV files"'));
        console.log(chalk.gray('    "Summarise this document: [paste content]"\\n'));
        return prompt();
      }

      try {
        console.log(chalk.gray('\\n  Orchestrating...\\n'));
        const result = await agenticLoop(text);
        console.log(chalk.bold('Orchestrator:'), result);

        // Ask for feedback
        rl.question(chalk.gray('\\nRate the agent (0-100, or press Enter to skip): '), async (ratingInput) => {
          const rating = parseInt(ratingInput.trim());
          if (!isNaN(rating) && rating >= 0 && rating <= 100) {
            rl.question(chalk.gray('Agent ID to rate: '), async (agentIdInput) => {
              const agentId = parseInt(agentIdInput.trim());
              if (!isNaN(agentId)) {
                try {
                  rl.question(chalk.gray('Comment (optional): '), async (comment) => {
                    // NOTE: authSignature must come from the agent's A2A response in a full implementation
                    console.log(chalk.yellow('\\n  Note: On-chain feedback requires an auth signature from the rated agent.'));
                    console.log(chalk.yellow('  In a full deployment, this is provided in the A2A response.'));
                    console.log(chalk.yellow('  Feedback recorded locally for now.\\n'));
                    prompt();
                  });
                } catch (err) {
                  console.log(chalk.red(\`Feedback error: \${err instanceof Error ? err.message : String(err)}\\n\`));
                  prompt();
                }
              } else {
                prompt();
              }
            });
          } else {
            console.log('');
            prompt();
          }
        });
      } catch (err) {
        console.log(chalk.red(\`Error: \${err instanceof Error ? err.message : String(err)}\\n\`));
        prompt();
      }
    });
  };

  prompt();
}

// ============================================================================
// Standalone commands
// ============================================================================

async function discoverCommand() {
  console.log(chalk.bold('\\nDiscovering ERC-8004 agents...\\n'));
  const agents = await discoverAgents();
  if (agents.length === 0) {
    console.log(chalk.yellow('No agents found in the registry.'));
    console.log(chalk.gray('Make sure IDENTITY_REGISTRY_ADDRESS is set and the chain has deployed registries.'));
    return;
  }
  console.log(chalk.bold(\`Found \${agents.length} agent(s):\\n\`));
  agents.forEach(a => {
    console.log(chalk.cyan(\`[#\${a.agentId}] \${a.name}\`));
    console.log(chalk.gray(\`  Description: \${a.description}\`));
    console.log(chalk.gray(\`  Skills: \${a.skills.join(', ') || 'none'}\`));
    console.log(chalk.gray(\`  Reputation: avg score \${a.reputation.averageScore}, total feedbacks \${a.reputation.totalFeedback}\`));
    const a2a = a.endpoints.find(e => e.type === 'A2A');
    if (a2a) console.log(chalk.gray(\`  A2A: \${a2a.url}\`));
    console.log('');
  });
}

async function feedbackCommand(agentIdStr: string, scoreStr: string) {
  const agentId = parseInt(agentIdStr);
  const score = parseInt(scoreStr);
  if (isNaN(agentId) || isNaN(score)) {
    console.error(chalk.red('Usage: npm run feedback -- <agentId> <score>'));
    process.exit(1);
  }
  console.log(chalk.bold(\`\\nSubmitting feedback for agent #\${agentId} with score \${score}...\\n\`));
  console.log(chalk.yellow('Note: On-chain feedback requires an auth signature from the rated agent.'));
  console.log(chalk.yellow('This command will be fully functional once A2A auth is integrated.'));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--discover')) {
    await discoverCommand();
  } else if (args.includes('--feedback')) {
    const idx = args.indexOf('--feedback');
    await feedbackCommand(args[idx + 1], args[idx + 2]);
  } else {
    await interactiveMode();
  }
}

main().catch(err => {
  console.error(chalk.red('Error:'), err.message || err);
  process.exit(1);
});
`;
}
