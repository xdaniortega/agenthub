import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { CHAINS, type ChainKey, type TrustModel } from "./config.js";
import { ARCHETYPES } from "./archetypes/index.js";
import { SKILL_CATEGORIES } from "./skills-catalog.js";

function getAvailableDir(baseDir: string): string {
    if (baseDir === ".") return baseDir;

    const fullPath = path.resolve(process.cwd(), baseDir);
    if (!fs.existsSync(fullPath)) return baseDir;

    let index = 1;
    let newDir = `${baseDir}-${index}`;
    while (fs.existsSync(path.resolve(process.cwd(), newDir))) {
        index++;
        newDir = `${baseDir}-${index}`;
    }
    return newDir;
}

export interface WizardAnswers {
    archetype: string;
    projectDir: string;
    agentName: string;
    agentDescription: string;
    agentImage: string;
    features: ("a2a" | "mcp" | "x402")[];
    a2aStreaming: boolean;
    chain: ChainKey;
    trustModels: TrustModel[];
    agentWallet: string;
    generatedPrivateKey?: string;
    skills?: string[];
    domains?: string[];
    llmProvider: "openai" | "claude";
    llmModel: string;
}

export const hasFeature = (answers: WizardAnswers, feature: "a2a" | "mcp" | "x402") =>
    answers.features.includes(feature);

interface RawAnswers {
    projectDir: string;
    agentName: string;
    agentDescription: string;
    agentImage: string;
    features: ("a2a" | "mcp" | "x402")[];
    a2aStreaming?: boolean;
    chain: ChainKey;
    trustModels: TrustModel[];
    llmProvider: "openai" | "claude";
    llmModel: string;
}

export async function runWizard(): Promise<WizardAnswers> {
    console.log("\n");

    const answers = await inquirer.prompt<RawAnswers>([
        {
            type: "input",
            name: "projectDir",
            message: "Project directory (or . for current):",
            default: "agents/my-agent",
        },
        {
            type: "input",
            name: "agentName",
            message: "Agent name:",
            default: "my agent",
        },
        {
            type: "input",
            name: "agentDescription",
            message: "Agent description:",
            default: "test agent created with agenthub",
        },
        {
            type: "input",
            name: "agentImage",
            message: "Agent image URL:",
            default: "https://example.com/agent.png",
        },
        // ── Chain selector ──
        {
            type: "list",
            name: "chain",
            message: "Blockchain network:",
            choices: [
                new inquirer.Separator("── Mainnets ──"),
                ...Object.entries(CHAINS)
                    .filter(([_, chain]) => !chain.name.includes("Testnet"))
                    .map(([key, chain]) => ({
                        name: chain.x402Supported
                            ? `${chain.name.replace(" Mainnet", "")} (x402 supported)`
                            : chain.name.replace(" Mainnet", ""),
                        value: key,
                    })),
                new inquirer.Separator("── Testnets ──"),
                ...Object.entries(CHAINS)
                    .filter(([_, chain]) => chain.name.includes("Testnet"))
                    .map(([key, chain]) => ({
                        name: chain.x402Supported
                            ? `${chain.name.replace(" (Testnet)", "")} (x402 supported)`
                            : chain.name.replace(" (Testnet)", ""),
                        value: key,
                    })),
            ],
        },
        {
            type: "checkbox",
            name: "features",
            message: "Select features to include:",
            choices: (ans: Partial<RawAnswers>) => {
                const chainConfig = ans.chain ? CHAINS[ans.chain] : null;
                const x402Supported = chainConfig?.x402Supported ?? false;
                return [
                    {
                        name: `A2A Server  ${chalk.gray("— Agent-to-Agent protocol: enables your agent to communicate and collaborate with other agents")}`,
                        value: "a2a",
                        checked: true,
                    },
                    {
                        name: `MCP Server  ${chalk.gray("— Model Context Protocol: allows your agent to connect to external tools and data sources")}`,
                        value: "mcp",
                        checked: false,
                    },
                    x402Supported
                        ? {
                              name: `x402 Payments  ${chalk.gray("— USDC micropayments for agent services")}`,
                              value: "x402",
                              checked: false,
                          }
                        : { name: "x402 Payments", value: "x402", disabled: "Not available on this chain" },
                ];
            },
        },
        {
            type: "confirm",
            name: "a2aStreaming",
            message: `Enable A2A streaming responses?  ${chalk.gray("(real-time progressive responses instead of waiting for complete output)")}`,
            default: false,
            when: (ans: Partial<RawAnswers>) => ans.features?.includes("a2a") ?? false,
        },
        {
            type: "checkbox",
            name: "trustModels",
            message: "Supported trust models:",
            choices: [
                { name: "reputation", value: "reputation", checked: true },
                {
                    name: `crypto-economic  ${chalk.gray("(Coming soon)")}`,
                    value: "crypto-economic",
                    disabled: "coming soon",
                },
                {
                    name: `tee-attestation  ${chalk.gray("(Coming soon)")}`,
                    value: "tee-attestation",
                    disabled: "coming soon",
                },
            ],
        },
        // ── LLM provider ──
        {
            type: "list",
            name: "llmProvider",
            message: `LLM provider:  ${chalk.gray("— the AI model that will power your agent's intelligence")}`,
            choices: [
                {
                    name: `OpenAI  ${chalk.gray("— GPT-4o-mini, GPT-4o · use OPENAI_API_KEY in .env")}`,
                    value: "openai",
                },
                {
                    name: `Claude (Anthropic)  ${chalk.gray("— Sonnet, Haiku, Opus · use ANTHROPIC_API_KEY in .env")}`,
                    value: "claude",
                },
            ],
        },
        // ── LLM model (dynamic based on provider) ──
        {
            type: "list",
            name: "llmModel",
            message: "LLM model:",
            choices: (ans: Partial<RawAnswers>) => {
                if (ans.llmProvider === "claude") {
                    return [
                        {
                            name: `claude-sonnet-4-6  ${chalk.gray("— Best balance of intelligence and speed (Recommended)")}`,
                            value: "claude-sonnet-4-6",
                        },
                        {
                            name: `claude-haiku-4-5-20251001  ${chalk.gray("— Fastest and most cost-efficient")}`,
                            value: "claude-haiku-4-5-20251001",
                        },
                        {
                            name: `claude-opus-4-6  ${chalk.gray("— Most intelligent, best for complex reasoning")}`,
                            value: "claude-opus-4-6",
                        },
                    ];
                }
                return [
                    {
                        name: `gpt-4o-mini  ${chalk.gray("— Fast and cost-efficient (Recommended)")}`,
                        value: "gpt-4o-mini",
                    },
                    {
                        name: `gpt-4o  ${chalk.gray("— Most capable OpenAI model")}`,
                        value: "gpt-4o",
                    },
                ];
            },
        },
    ]);

    // ── OASF Skills — separate prompt with explanatory context ──
    console.log(chalk.bold("\n  📋 OASF Skills (On-Chain Registration)"));
    console.log(chalk.gray("  ─────────────────────────────────────────────────────────────────"));
    console.log(chalk.gray("  OASF (Open Agent Specification Framework) skills are on-chain metadata"));
    console.log(chalk.gray("  stored in the ERC-8004 registry that make your agent discoverable by"));
    console.log(chalk.gray("  other agents and tools on the network."));
    console.log();
    console.log(chalk.yellow("  ⚠️  These are NOT Claude/AI model skills — they are blockchain identifiers."));
    console.log(chalk.yellow("  ⚠️  Only select skills your agent genuinely supports. Publishing inaccurate"));
    console.log(chalk.yellow("     skills can damage your agent's on-chain reputation score."));
    console.log();
    if (answers.llmProvider === "openai") {
        console.log(chalk.gray("  → Selected skills will be injected as context into your agent's system prompt."));
    }
    console.log(chalk.gray("  → All agents get a .claude/CLAUDE.md with web3 skills reference (Claude-native"));
    console.log(chalk.gray("    auto-load, OpenAI agents can use it as context too)."));
    console.log(chalk.gray("  → Browse taxonomy: https://schema.oasf.outshift.com/0.8.0"));
    console.log(chalk.gray("  ─────────────────────────────────────────────────────────────────\n"));

    const { skills } = await inquirer.prompt<{ skills: string[] }>([
        {
            type: "checkbox",
            name: "skills",
            message: "Select OASF skills for your agent (space = toggle, enter = confirm):",
            choices: SKILL_CATEGORIES.flatMap((cat) => [
                new inquirer.Separator(`── ${cat.name} ──`),
                ...cat.skills.map((s) => ({ name: s.name, value: s.value })),
            ]),
        },
    ]);

    let projectDir = answers.projectDir.trim();
    const cwdBasename = path.basename(process.cwd());
    const alreadyInAgents = cwdBasename === "agents";
    const alreadyUnderAgents = projectDir.replace(/^\.\//, "").startsWith("agents/");
    if (
        projectDir !== "." &&
        !path.isAbsolute(projectDir) &&
        !alreadyUnderAgents &&
        !alreadyInAgents
    ) {
        projectDir = `agents/${projectDir}`;
    }

    const availableDir = getAvailableDir(projectDir);
    if (availableDir !== projectDir) {
        console.log(`\n📁 Directory "${projectDir}" exists, using "${availableDir}" instead`);
        projectDir = availableDir;
    }

    // Always auto-generate a new wallet
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const agentWallet = account.address;
    console.log("\n🔑 Generated new wallet:", agentWallet);

    return {
        ...answers,
        archetype: "custom",
        projectDir,
        agentWallet,
        generatedPrivateKey: privateKey,
        a2aStreaming: answers.a2aStreaming ?? false,
        features: answers.features,
        llmProvider: answers.llmProvider,
        llmModel: answers.llmModel,
        skills: skills ?? [],
        domains: [],
    };
}
