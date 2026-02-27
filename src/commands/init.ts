/**
 * Init command — quick, opinionated agent scaffold (Agent Examples).
 *
 * Gets developers from zero to a running agent in under 60 seconds:
 *
 *   1. Name your agent
 *   2. Choose a project directory
 *   3. Confirm
 *   → Files generated, deps installed, next steps shown.
 *
 * Opinionated defaults (all can be changed in .env or package.json later):
 *   - Chain: Arbitrum Sepolia (testnet) — swap to arbitrum-mainnet for production
 *   - Wallet: auto-generated — back up the private key in .env!
 *   - Trust model: reputation
 *   - Features: a2a
 */

import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { execSync } from "child_process";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { generateProject } from "../generator.js";
import type { WizardAnswers } from "../wizard.js";

// ─── Agent type registry ──────────────────────────────────────────────────────
// Only one type is active. Add new types here to extend the init menu.

interface AgentType {
    id: string;
    emoji: string;
    label: string;
    tagline: string;
    features: ("a2a" | "mcp" | "x402")[];
    dirSuffix: string;
}

const AGENT_TYPES: AgentType[] = [
    {
        id: "custom",
        emoji: "⚡",
        label: "Arbitrum dApp Developer",
        tagline: "Build and deploy AI agents on Arbitrum",
        features: ["a2a"],
        dirSuffix: "arbitrum-agent",
    },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

function printSummaryBox(fields: Array<[string, string]>): void {
    const labelWidth = Math.max(...fields.map(([l]) => l.length));
    console.log(chalk.bold("\n  ┌─ Summary " + "─".repeat(38) + "┐"));
    for (const [label, value] of fields) {
        const padded = label.padEnd(labelWidth);
        console.log(`  │  ${chalk.cyan(padded)}  ${chalk.white(value)}`);
    }
    console.log(chalk.bold("  └" + "─".repeat(50) + "┘\n"));
}

function printNextSteps(agentName: string, projectDir: string, features: string[], llmProvider?: string): void {
    const hasA2A = features.includes("a2a");
    const hasMCP = features.includes("mcp");

    console.log(chalk.bold.cyan("\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(chalk.bold.cyan("    🚀  AGENT READY — NEXT STEPS"));
    console.log(chalk.bold.cyan("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

    const step = (() => {
        let n = 0;
        return (title: string, lines: string[]) => {
            n++;
            console.log(chalk.bold.white(`  ${n}. ${title}`));
            for (const line of lines) {
                const isCmd = /^(cd|npm|npx) /.test(line);
                console.log(isCmd ? chalk.cyan(`     ${line}`) : chalk.gray(`     ${line}`));
            }
            console.log();
        };
    })();

    if (projectDir !== ".") step("Navigate to your project", [`cd ${projectDir}`]);

    const llmKeyLine =
        llmProvider === "claude"
            ? "ANTHROPIC_API_KEY=sk-ant-...  ← get one at console.anthropic.com"
            : "OPENAI_API_KEY=sk-...         ← get one at platform.openai.com";
    step("Add your API keys to .env", [
        "PRIVATE_KEY is already set (auto-generated) — back it up!",
        llmKeyLine,
        "PINATA_JWT=...                ← get a free key at pinata.cloud",
    ]);

    step("Get testnet ETH on Arbitrum Sepolia", [
        "→ https://faucet.arbitrum.io",
        "→ Or bridge from Ethereum Sepolia using the Arbitrum bridge",
    ]);

    step("Register your agent on-chain", ["npm run register"]);

    if (hasA2A) {
        step("Start your A2A server", [
            "npm run start:a2a",
            "Test → http://localhost:3000/.well-known/agent-card.json",
        ]);
    }

    if (hasMCP) {
        step("Connect to Claude Desktop / Cursor via MCP", [
            "npm run start:mcp",
            `Add to Claude Desktop config: { "command": "node", "args": ["dist/mcp-server.js"] }`,
        ]);
    }

    step("Communicate with your agent from AgentHub", [
        "agenthub   →   💬 Communicate",
        `Enter: http://localhost:3000`,
    ]);

    console.log(chalk.bold.cyan("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(chalk.gray("  Docs: https://eips.ethereum.org/EIPS/eip-8004\n"));
}

// ─── main ─────────────────────────────────────────────────────────────────────

export async function runInit(): Promise<void> {
    console.log(chalk.bold.cyan("\n  ⚡ AgentHub — Agent Examples\n"));

    // ── Step 1: Agent type ────────────────────────────────────────────────────
    const { typeId } = await inquirer.prompt<{ typeId: string }>([
        {
            type: "list",
            name: "typeId",
            message: "Choose an agent type:",
            choices: AGENT_TYPES.map((t) => ({
                name: `${t.emoji}  ${t.label.padEnd(26)}  ${chalk.gray(t.tagline)}`,
                value: t.id,
                short: `${t.emoji} ${t.label}`,
            })),
        },
    ]);

    const agentType = AGENT_TYPES.find((t) => t.id === typeId)!;

    // ── Step 2: Agent name ────────────────────────────────────────────────────
    const { agentName } = await inquirer.prompt<{ agentName: string }>([
        {
            type: "input",
            name: "agentName",
            message: "Agent name:",
            default: `my-${agentType.dirSuffix}`,
            validate: (v: string) => v.trim().length > 0 || "Name cannot be empty",
        },
    ]);

    const slug = slugify(agentName.trim());
    const defaultDir = `agents/${slug}`;

    // ── Step 2: Project directory ─────────────────────────────────────────────
    const { projectDir } = await inquirer.prompt<{ projectDir: string }>([
        {
            type: "input",
            name: "projectDir",
            message: "Project directory:",
            default: defaultDir,
        },
    ]);

    // ── Step 3: LLM provider ──────────────────────────────────────────────────
    const { llmProvider } = await inquirer.prompt<{ llmProvider: "openai" | "claude" }>([
        {
            type: "list",
            name: "llmProvider",
            message: `LLM provider:  ${chalk.gray("— the AI model that will power your agent")}`,
            choices: [
                {
                    name: `OpenAI  ${chalk.gray("— GPT-4o-mini · fast and cost-efficient · needs OPENAI_API_KEY")}`,
                    value: "openai",
                },
                {
                    name: `Claude (Anthropic)  ${chalk.gray("— claude-sonnet-4-6 · powerful reasoning · needs ANTHROPIC_API_KEY")}`,
                    value: "claude",
                },
            ],
        },
    ]);

    const llmModelChoices =
        llmProvider === "claude"
            ? [
                  { name: `claude-sonnet-4-6  ${chalk.gray("— Recommended")}`, value: "claude-sonnet-4-6" },
                  { name: `claude-haiku-4-5-20251001  ${chalk.gray("— Fastest")}`, value: "claude-haiku-4-5-20251001" },
                  { name: `claude-opus-4-6  ${chalk.gray("— Most intelligent")}`, value: "claude-opus-4-6" },
              ]
            : [
                  { name: `gpt-4o-mini  ${chalk.gray("— Recommended")}`, value: "gpt-4o-mini" },
                  { name: `gpt-4o  ${chalk.gray("— Most capable")}`, value: "gpt-4o" },
              ];

    const { llmModel } = await inquirer.prompt<{ llmModel: string }>([
        {
            type: "list",
            name: "llmModel",
            message: "LLM model:",
            choices: llmModelChoices,
        },
    ]);

    // ── Auto-generate wallet ──────────────────────────────────────────────────
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    // ── Step 4: Confirm ───────────────────────────────────────────────────────
    printSummaryBox([
        ["Type", `${agentType.emoji}  ${agentType.label}`],
        ["Name", agentName.trim()],
        ["Directory", projectDir.trim()],
        ["Chain", "Arbitrum Sepolia  (testnet — change in .env for mainnet)"],
        ["Wallet", `${account.address}  (auto-generated)`],
        ["LLM", `${llmProvider === "claude" ? "Claude (Anthropic)" : "OpenAI"}  —  ${llmModel}`],
        ["Features", agentType.features.join(" + ")],
    ]);

    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
        {
            type: "confirm",
            name: "confirmed",
            message: "Looks good?",
            default: true,
        },
    ]);

    if (!confirmed) {
        console.log(chalk.gray("\n  Cancelled. Run again to start over.\n"));
        return;
    }

    // ── Generate ──────────────────────────────────────────────────────────────
    const answers: WizardAnswers = {
        archetype: agentType.id,
        projectDir: projectDir.trim(),
        agentName: agentName.trim(),
        agentDescription: agentType.tagline,
        agentImage: "https://example.com/agent.png",
        features: agentType.features,
        a2aStreaming: false,
        chain: "arbitrum-sepolia",
        trustModels: ["reputation"],
        agentWallet: account.address,
        generatedPrivateKey: privateKey,
        llmProvider,
        llmModel,
        skills: [],
        domains: [],
    };

    console.log();
    const genSpinner = ora("Generating agent files…").start();
    try {
        await generateProject(answers);
        genSpinner.succeed(chalk.green("Agent scaffold generated!"));
    } catch (err) {
        genSpinner.fail(chalk.red("Generation failed."));
        console.error(err);
        return;
    }

    const installDir = projectDir.trim() === "." ? process.cwd() : projectDir.trim();
    const installSpinner = ora("Installing dependencies…").start();
    try {
        execSync("npm install", { cwd: installDir, stdio: "pipe" });
        installSpinner.succeed(chalk.green("Dependencies installed!"));
    } catch {
        installSpinner.warn(chalk.yellow("Dependency install failed — run 'npm install' manually."));
    }

    printNextSteps(agentName.trim(), projectDir.trim(), agentType.features, llmProvider);
}
