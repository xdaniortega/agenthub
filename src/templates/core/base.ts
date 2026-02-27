import type { WizardAnswers } from "../../wizard.js";
import { hasFeature } from "../../wizard.js";
import { CHAINS } from "../../config.js";
import type { AgentArchetype } from "../../archetypes/index.js";

type ChainConfig = (typeof CHAINS)[keyof typeof CHAINS];

// Helper to get funding instructions based on chain
function getFundingInstructions(chain: ChainConfig): string {
    // Mainnets need real tokens
    const mainnetChains: Record<number, string> = {
        1: "ETH", // Ethereum
        8453: "ETH", // Base
        137: "MATIC", // Polygon
    };

    if (mainnetChains[chain.chainId]) {
        const token = mainnetChains[chain.chainId];
        return `\n**⚠️ Mainnet: You need real ${token} for gas fees.** Transfer ${token} to your wallet before registering.\n`;
    }

    // Testnets have faucets
    const faucets: Record<number, string> = {
        11155111: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia", // Eth Sepolia
        84532: "https://www.coinbase.com/faucets/base-ethereum-goerli-faucet", // Base Sepolia
        80002: "https://faucet.polygon.technology/", // Polygon Amoy
    };

    const faucetUrl = faucets[chain.chainId];
    if (faucetUrl) {
        return `\nGet testnet tokens from: ${faucetUrl}\n`;
    }

    return "\nFund your wallet with native tokens for gas fees.\n";
}

export function generatePackageJson(answers: WizardAnswers, archetype?: AgentArchetype): string {
    const scripts: Record<string, string> = {
        build: "tsc",
        register: "tsx src/register.ts",
    };

    const dependencies: Record<string, string> = {
        "@blockbyvlog/agent0-sdk": "latest",
        dotenv: "^16.3.1",
        inquirer: "^9.2.23",
        openai: "^4.68.0",
        viem: "^2.21.0",
    };

    const devDependencies: Record<string, string> = {
        "@types/node": "^20.10.0",
        tsx: "^4.7.0",
        typescript: "^5.3.0",
    };

    if (hasFeature(answers, "a2a")) {
        scripts["start:a2a"] = "tsx src/a2a-server.ts";
        scripts["a2a:discover"] = "tsx src/a2a-client.ts --discover";
        scripts["a2a:chat"] = "tsx src/a2a-client.ts --interactive";
        scripts["a2a:test"] = "tsx src/a2a-client.ts --test";
        dependencies["express"] = "^4.18.2";
        dependencies["uuid"] = "^9.0.0";
        devDependencies["@types/express"] = "^4.17.21";
        devDependencies["@types/uuid"] = "^9.0.7";
    }

    if (hasFeature(answers, "mcp")) {
        scripts["start:mcp"] = "tsx src/mcp-server.ts";
        dependencies["@modelcontextprotocol/sdk"] = "^1.0.0";
    }

    if (hasFeature(answers, "x402")) {
        dependencies["@x402/express"] = "^2.0.0";
        dependencies["@x402/core"] = "^2.0.0";
        dependencies["@x402/evm"] = "^2.0.0";
    }

    // Orchestrator archetype extra scripts
    if (answers.archetype === "orchestrator") {
        scripts["start:orchestrator"] = "tsx src/orchestrator.ts";
        scripts["discover"] = "tsx src/orchestrator.ts --discover";
        scripts["feedback"] = "tsx src/orchestrator.ts --feedback";
    }

    // Merge archetype extra dependencies
    if (archetype?.extraDependencies) {
        Object.assign(dependencies, archetype.extraDependencies);
    }

    return JSON.stringify(
        {
            name: answers.agentName.toLowerCase().replace(/\s+/g, "-"),
            version: "1.0.0",
            description: answers.agentDescription,
            type: "module",
            scripts,
            dependencies,
            devDependencies,
        },
        null,
        2
    );
}

export function generateEnvExample(answers: WizardAnswers, chain: ChainConfig): string {
    const useMasterJwt = answers.useMasterPinataJwt === true;
    const preFund = answers.preFundFromMaster === true;
    const preFundAmount = answers.preFundAmount?.trim() || "0.002";
    // When using master: PRIVATE_KEY comes from root .env at register time; we still need AGENT_PRIVATE_KEY for setWallet (agent wallet signs EIP-712)
    const privateKeyValue = answers.generatedPrivateKey ?? "your_private_key_here";
    const pinataLine = useMasterJwt
        ? "# PINATA_JWT loaded from ../../.env (master) when you run register"
        : "PINATA_JWT=your_pinata_jwt_here";

    let env = `# Registration: use ../../.env (master) for PRIVATE_KEY and PINATA_JWT, or set them here
PRIVATE_KEY=${privateKeyValue}

# Agent wallet key (required for setWallet when master pays for registration). Same as PRIVATE_KEY if you only have one key.
AGENT_PRIVATE_KEY=${answers.generatedPrivateKey ?? "same_as_PRIVATE_KEY_or_your_agent_wallet_key"}

# RPC URL for ${chain.name}
RPC_URL=${chain.rpcUrl}

# Pinata for IPFS
${pinataLine}

# OpenAI API key for LLM agent
OPENAI_API_KEY=your_openai_api_key_here
`;

    if (hasFeature(answers, "x402")) {
        env += `
# x402 Payment Configuration (optional overrides)
X402_PAYEE_ADDRESS=${answers.agentWallet}
X402_PRICE=$0.001
`;
    }
    if (preFund) {
        env += `
# Pre-fund: transfer this much ETH from master to agent wallet when you run register
FUND_AGENT_ETH=${preFundAmount}
`;
    }

    // Add registry addresses for archetypes that read on-chain data
    if (answers.archetype === "orchestrator" || (answers.skills && answers.skills.length > 0)) {
        const identityAddr = (chain as { identityRegistry?: string | null }).identityRegistry;
        const reputationAddr = (chain as { reputationRegistry?: string | null }).reputationRegistry;
        if (identityAddr || reputationAddr) {
            env += `
# ERC-8004 Identity Registry
IDENTITY_REGISTRY_ADDRESS=${identityAddr ?? "# not deployed on this chain"}

# ERC-8004 Reputation Registry
REPUTATION_REGISTRY_ADDRESS=${reputationAddr ?? "# not deployed on this chain"}
`;
        } else {
            env += `
# ERC-8004 registries (not yet deployed on ${chain.name} — use Arbitrum Sepolia or ETH Sepolia)
# IDENTITY_REGISTRY_ADDRESS=
# REPUTATION_REGISTRY_ADDRESS=
`;
        }
    }

    return env;
}

export function generateRegisterScript(answers: WizardAnswers, chain: ChainConfig): string {
    const agentSlug = answers.agentName.toLowerCase().replace(/\s+/g, "-");
    const hasA2A = hasFeature(answers, "a2a");
    const hasMCP = hasFeature(answers, "mcp");
    const hasX402 = hasFeature(answers, "x402");

    // Build trust model arguments
    const trustArgs = [
        answers.trustModels.includes("reputation"),
        answers.trustModels.includes("crypto-economic"),
        answers.trustModels.includes("tee-attestation"),
    ];

    return `/**
 * ERC-8004 Agent Registration Script
 *
 * Loads env from: ../../.env (project root master), ../.env.shared, then .env (this agent).
 * You can use a single root .env with PRIVATE_KEY and PINATA_JWT for all agents.
 *
 * After registration you can fund the agent wallet from the master account (interactive menu).
 *
 * Run with: npm run register
 */

import path from 'path';
import { config } from 'dotenv';
config({ path: path.join(process.cwd(), '..', '..', '.env') });
config({ path: path.join(process.cwd(), '..', '.env.shared') });
config();
import inquirer from 'inquirer';
import { SDK } from '@blockbyvlog/agent0-sdk';
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';

// ============================================================================
// Agent Configuration
// ============================================================================

const AGENT_CONFIG = {
  name: '${answers.agentName.replace(/'/g, "\\'")}',
  description: '${answers.agentDescription.replace(/'/g, "\\'")}',
  image: '${answers.agentImage}',
  // Update these URLs when you deploy your agent
  a2aEndpoint: 'https://${agentSlug}.example.com/.well-known/agent-card.json',
  mcpEndpoint: 'https://${agentSlug}.example.com/mcp',
};

// ============================================================================
// Main Registration Flow
// ============================================================================

async function main() {
  // Validate environment
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not set in .env');
  }

  const pinataJwt = process.env.PINATA_JWT?.trim();
  if (!pinataJwt) {
    throw new Error('PINATA_JWT not set in .env');
  }

  const rpcUrl = (process.env.RPC_URL || '${chain.rpcUrl}').trim();

  // Initialize SDK
  console.log('🔧 Initializing Agent0 SDK...');
  const sdk = new SDK({
    chainId: ${chain.chainId},
    rpcUrl,
    privateKey,
    ipfs: 'pinata',
    pinataJwt: pinataJwt,
  });

  // Create agent
  console.log('📝 Creating agent...');
  const agent = sdk.createAgent(
    AGENT_CONFIG.name,
    AGENT_CONFIG.description,
    AGENT_CONFIG.image
  );

  // Configure endpoints
${
    hasA2A
        ? `  console.log('🔗 Setting A2A endpoint...');
  await agent.setA2A(AGENT_CONFIG.a2aEndpoint);
`
        : ""
}${
        hasMCP
            ? `  console.log('🔗 Setting MCP endpoint...');
  await agent.setMCP(AGENT_CONFIG.mcpEndpoint);
`
            : ""
    }
  // Configure trust models
  console.log('🔐 Setting trust models...');
  agent.setTrust(${trustArgs[0]}, ${trustArgs[1]}, ${trustArgs[2]});

  // Set status flags
  // Best practice: Keep active=false until your agent is production-ready
  // Change to true when you're ready for users to discover your agent
  agent.setActive(false);
  agent.setX402Support(${hasX402});

  // OASF skills and domains for discoverability
  // Browse taxonomy: https://schema.oasf.outshift.com/0.8.0
${
    (answers.skills ?? []).length > 0
        ? (answers.skills ?? []).map((s) => `  agent.addSkill('${s}');`).join("\n")
        : "  // agent.addSkill('natural_language_processing/natural_language_generation/summarization');"
}
${
    (answers.domains ?? []).length > 0
        ? (answers.domains ?? []).map((d) => `  agent.addDomain('${d}');`).join("\n")
        : "  // agent.addDomain('technology/software_engineering');"
}

  // Register on-chain with IPFS
  console.log('⛓️  Registering agent on ${chain.name}...');
  console.log('   This will:');
  console.log('   1. Mint agent NFT on-chain');
  console.log('   2. Upload metadata to IPFS');
  console.log('   3. Set agent URI on-chain');
  console.log('');

  const txHandle = await agent.registerIPFS();
  const { result } = await txHandle.waitMined();

  // Set agent wallet via ERC-8004 v2 setAgentWallet() (not deprecated metadata)
  // This uses EIP-712 signature verification for security
  console.log('');
  console.log('🔐 Setting agent wallet via setAgentWallet()...');
  const agentWallet = '${answers.agentWallet}' as \`0x\${string}\`;
  const account = privateKeyToAccount(privateKey as \`0x\${string}\`);
  const agentPrivateKey = process.env.AGENT_PRIVATE_KEY?.trim();
  const setWalletOpts = (agentWallet.toLowerCase() !== account.address.toLowerCase() && agentPrivateKey)
    ? { newWalletPrivateKey: agentPrivateKey }
    : undefined;
  const walletTx = await agent.setWallet(agentWallet, setWalletOpts);
  if (walletTx) await walletTx.waitMined();

  const chainDef = defineChain({
    id: ${chain.chainId},
    name: '${chain.name.replace(/'/g, "\\'")}',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const publicClient = createPublicClient({ chain: chainDef, transport: http(rpcUrl) });
  const balance = await publicClient.getBalance({ address: account.address });
  const balanceEth = Number(balance) / 1e18;

  let fundAmount = process.env.FUND_AGENT_ETH ? parseFloat(process.env.FUND_AGENT_ETH) : NaN;
  if (Number.isNaN(fundAmount) || fundAmount < 0) {
    console.log('');
    const { fundChoice } = await inquirer.prompt<{ fundChoice: string }>([
      {
        type: 'list',
        name: 'fundChoice',
        message: \`Fund agent wallet from master account? (Available: \${balanceEth.toFixed(4)} ETH)\`,
        choices: [
          { name: 'Yes, transfer 0.002 ETH (recommended)', value: '0.002' },
          { name: 'Yes, enter custom amount', value: 'custom' },
          { name: 'No, skip', value: 'skip' },
        ],
      },
    ]);
    if (fundChoice === 'custom') {
      const { amount } = await inquirer.prompt<{ amount: string }>([
        { type: 'input', name: 'amount', message: 'Amount (ETH) to transfer:', default: '0.002' },
      ]);
      fundAmount = parseFloat(amount) || 0;
    } else if (fundChoice !== 'skip') {
      fundAmount = parseFloat(fundChoice) || 0;
    } else {
      fundAmount = 0;
    }
  }

  if (fundAmount > 0 && agentWallet.toLowerCase() !== account.address.toLowerCase()) {
    if (balanceEth < fundAmount) {
      console.log(\`   ⚠️  Insufficient balance (\${balanceEth.toFixed(4)} ETH). Skipping transfer.\`);
    } else {
      console.log(\`   Transferring \${fundAmount} ETH to agent wallet...\`);
      const walletClient = createWalletClient({ account, chain: chainDef, transport: http(rpcUrl) });
      const hash = await walletClient.sendTransaction({
        to: agentWallet,
        value: parseEther(String(fundAmount)),
      });
      console.log('   Fund tx:', hash);
    }
  }

  // Output results
  console.log('');
  console.log('✅ Agent registered successfully!');
  console.log('');
  console.log('🆔 Agent ID:', result.agentId);
  console.log('📄 Agent URI:', result.agentURI);${
      chain.scanPath
          ? `
  console.log('');
  console.log('🌐 View your agent on 8004scan:');
  const agentIdNum = result.agentId?.split(':')[1] || result.agentId;
  console.log(\`   https://www.8004scan.io/agents/${chain.scanPath}/\${agentIdNum}\`);`
          : ""
  }

  // Update local registry so "Give feedback" can list this agent
  try {
    const fs = await import('fs/promises');
    const metaPath = path.join(process.cwd(), '.8004.json');
    try {
      const metaRaw = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaRaw);
      const projectDir = meta.projectDir;
      let dir = process.cwd();
      const root = path.parse(dir).root;
      while (dir !== root) {
        const regPath = path.join(dir, '.8004-agents.json');
        try {
          const dataRaw = await fs.readFile(regPath, 'utf-8');
          const data = JSON.parse(dataRaw);
          const agents = Array.isArray(data.agents) ? data.agents : [];
          let found = false;
          const updated = agents.map((a) => {
            if (a.projectDir !== projectDir) return a;
            found = true;
            return { ...a, agentId: result.agentId, chainId: ${chain.chainId} };
          });
          if (found) {
            await fs.writeFile(regPath, JSON.stringify({ agents: updated }, null, 2));
          }
          break;
        } catch {
          dir = path.dirname(dir);
        }
      }
    } catch {
      // no .8004.json or not tracked
    }
  } catch {
    // ignore registry errors
  }

  console.log('');
  console.log('📋 Next steps:');
  console.log('   1. Update AGENT_CONFIG endpoints with your production URLs');
  console.log('   2. Run \`npm run start:a2a\` to start your A2A server');
  console.log('   3. Deploy your agent to a public URL');
}

main().catch((error) => {
  console.error('❌ Registration failed:', error.message || error);
  process.exit(1);
});
`;
}

export function generateAgentTs(answers: WizardAnswers, systemPrompt?: string): string {
    const streamingCode = answers.a2aStreaming
        ? `
/**
 * Stream a response to a user message (generator function)
 * Yields chunks of text as they are generated by the LLM
 * 
 * @param userMessage - The user's input
 * @param history - Previous conversation messages (for context)
 * @yields Text chunks as they are generated
 */
export async function* streamResponse(userMessage: string, history: AgentMessage[] = []): AsyncGenerator<string> {
  const systemPrompt: AgentMessage = {
    role: 'system',
    content: ${JSON.stringify(systemPrompt ?? "You are a helpful AI assistant registered on the ERC-8004 protocol. Be concise and helpful.")},
  };

  const messages: AgentMessage[] = [
    systemPrompt,
    ...history,
    { role: 'user', content: userMessage },
  ];

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
`
        : "";

    return `/**
 * LLM Agent
 * 
 * This file contains the AI logic for your agent.
 * By default, it uses OpenAI's GPT-4o-mini model.
 * 
 * To customize:
 * - Change the model in chat() (e.g., 'gpt-4o', 'gpt-3.5-turbo')
 * - Modify the system prompt in generateResponse()
 * - Add custom logic, tools, or RAG capabilities
 * 
 * To use a different LLM provider:
 * - Replace the OpenAI import with your preferred SDK
 * - Update the chat() function accordingly
 */

import OpenAI from 'openai';

// Initialize OpenAI client
// API key is loaded from OPENAI_API_KEY environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// Types
// ============================================================================

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Send messages to the LLM and get a response
 * This is the low-level function that calls the OpenAI API
 * 
 * @param messages - Array of conversation messages
 * @returns The assistant's response text
 */
export async function chat(messages: AgentMessage[]): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Change model here if needed
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    // Add more options as needed:
    // temperature: 0.7,
    // max_tokens: 1000,
  });

  return response.choices[0]?.message?.content ?? 'No response';
}

/**
 * Generate a response to a user message
 * This is the main function called by A2A and MCP handlers
 * 
 * @param userMessage - The user's input
 * @param history - Previous conversation messages (for context)
 * @returns The agent's response
 */
export async function generateResponse(userMessage: string, history: AgentMessage[] = []): Promise<string> {
  // System prompt defines your agent's personality and behavior
  // Customize this to match your agent's purpose
  const systemPrompt: AgentMessage = {
    role: 'system',
    content: ${JSON.stringify(systemPrompt ?? "You are a helpful AI assistant registered on the ERC-8004 protocol. Be concise and helpful.")},
  };

  // Build the full message array: system prompt + history + new message
  const messages: AgentMessage[] = [
    systemPrompt,
    ...history,
    { role: 'user', content: userMessage },
  ];

  return chat(messages);
}
${streamingCode}`;
}

export interface ReadmeOptions {
    /** Extra lines for the Project Structure (e.g. give-feedback.ts for Feedback Agent) */
    extraStructureLines?: string[];
    /** Extra markdown sections to insert after Project Structure */
    extraSections?: string[];
}

export function generateReadme(
    answers: WizardAnswers,
    chain: ChainConfig,
    opts?: ReadmeOptions
): string {
    const hasA2A = hasFeature(answers, "a2a");
    const hasMCP = hasFeature(answers, "mcp");
    const hasX402 = hasFeature(answers, "x402");
    const extraStructure = opts?.extraStructureLines?.join("\n") ?? "";
    const extraSections = opts?.extraSections?.join("\n\n") ?? "";

    return `# ${answers.agentName}

${answers.agentDescription}

## Quick Start

### 1. Install dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Configure environment

Edit \`.env\` and add your API keys:

\`\`\`env
# Already set if wallet was auto-generated
PRIVATE_KEY=your_private_key

# Get from https://pinata.cloud (free tier works)
PINATA_JWT=your_pinata_jwt

# Get from https://platform.openai.com
OPENAI_API_KEY=your_openai_key
\`\`\`

### 3. Fund your wallet

Your agent wallet: \`${answers.agentWallet}\`
${getFundingInstructions(chain)}

### 4. Register on-chain

\`\`\`bash
npm run register
\`\`\`

This will:
- Upload your agent metadata to IPFS
- Register your agent on ${chain.name}
- Output your agent ID and 8004scan link
${
    hasA2A
        ? `
### 5. Start the A2A server

\`\`\`bash
npm run start:a2a
\`\`\`

Test locally: http://localhost:3000/.well-known/agent-card.json

#### Test your agent

\\\`\\\`\\\`bash
# Discover agent capabilities
npm run a2a:discover

# Interactive chat mode
npm run a2a:chat

# Run automated tests
npm run a2a:test
\\\`\\\`\\\`
`
        : ""
}${
        hasMCP
            ? `
### ${hasA2A ? "6" : "5"}. Start the MCP server

\`\`\`bash
npm run start:mcp
\`\`\`
`
            : ""
    }
## Project Structure

\`\`\`
${answers.agentName.toLowerCase().replace(/\s+/g, "-")}/
├── src/
│   ├── register.ts      # Registration script
│   ├── agent.ts         # LLM logic${hasA2A ? "\n│   ├── a2a-server.ts   # A2A server\n│   └── a2a-client.ts   # A2A testing client" : ""}${
        hasMCP ? "\n│   └── mcp-server.ts   # MCP server" : ""
    }${extraStructure ? "\n" + extraStructure : ""}
├── .env                 # Environment variables (keep secret!)
└── package.json
\`\`\`
${extraSections ? extraSections + "\n\n" : ""}${
    hasX402
        ? `
## x402 Payments

This agent has x402 payment support enabled. Protected endpoints require USDC payment.

Payment configuration in \`.env\`:
- \`X402_PAYEE_ADDRESS\` - Wallet to receive payments
- \`X402_PRICE\` - Price per request (e.g., $0.001)
`
        : ""
}
## OASF Skills & Domains (Optional)

Add capabilities and domain expertise to help others discover your agent.

Edit \`src/register.ts\` and uncomment/add before \`registerIPFS()\`:

\`\`\`typescript
// Add skills (what your agent can do)
agent.addSkill('natural_language_processing/natural_language_generation/summarization');
agent.addSkill('analytical_skills/coding_skills/text_to_code');

// Add domains (areas of expertise)  
agent.addDomain('technology/software_engineering');
agent.addDomain('finance_and_business/investment_services');
\`\`\`

Browse the full taxonomy: https://schema.oasf.outshift.com/0.8.0

## Going Live

By default, your agent is registered with \`active: false\`. This is intentional - it lets you test without appearing in explorer listings.

When you're ready for production:
1. Edit \`src/register.ts\` and change \`agent.setActive(false)\` to \`agent.setActive(true)\`
2. Re-run \`npm run register\` to update your agent's metadata

## Next Steps

1. Update the endpoint URLs in \`src/register.ts\` with your production domain
2. Customize the agent logic in \`src/agent.ts\`
3. Deploy to a cloud provider (Vercel, Railway, etc.)
4. Re-run \`npm run register\` if you change metadata

## Resources

- [ERC-8004 Standard](https://eips.ethereum.org/EIPS/eip-8004)
- [8004scan Explorer](https://www.8004scan.io/)
- [Agent0 SDK Docs](https://sdk.ag0.xyz/)
- [OASF Taxonomy](https://github.com/8004-org/oasf)
`;
}
