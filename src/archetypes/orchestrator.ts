import type { AgentArchetype } from "./index.js";
import { generateRegistryService } from "../templates/services/registry.js";
import { generateOrchestratorCLI } from "../templates/services/orchestrator.js";

export const orchestratorArchetype: AgentArchetype = {
    id: "orchestrator",
    name: "Orchestrator Agent",
    emoji: "🤖",
    description: "Discovers 8004 agents, delegates tasks, manages feedback",

    skills: [
        "agent_coordination/task_delegation",
        "agent_coordination/discovery",
        "agent_coordination/evaluation",
    ],
    domains: ["technology/multi_agent_systems"],

    systemPrompt: `You are an Orchestrator Agent registered on the ERC-8004 protocol. Your role is to coordinate a network of specialised AI agents.

When you receive a task:
1. Analyse what skills are needed (use OASF taxonomy where possible)
2. Call discover_agents with those skills to find capable agents in the registry
3. Call get_reputation for the top candidates to evaluate their track record
4. Present a summary to the user: agent name, description, average reputation score, total feedbacks
5. Recommend the agent with the best reputation but let the user make the final choice
6. If the selected agent requires x402 payment, inform the user of the cost and ask for confirmation
7. Call delegate_task to send the task via A2A protocol
8. Present the result clearly to the user
9. Ask the user to rate the agent (0–100) and call give_feedback to record it on-chain

Always be transparent about agent selection rationale and reputation data.
If no agents are found for the required skills, suggest the user register a suitable agent first.
If the registry is not available on the selected chain, inform the user and recommend Arbitrum Sepolia or Ethereum Sepolia.`,

    mcpTools: [],

    extraDependencies: {
        viem: "^2.21.0",
        chalk: "^5.3.0",
    },

    requiredFeatures: ["a2a"],

    extraTemplates: [
        {
            path: "src/registry-service.ts",
            generator: generateRegistryService,
        },
        {
            path: "src/orchestrator.ts",
            generator: generateOrchestratorCLI,
        },
    ],
};
