import fs from "fs/promises";
import path from "path";
import { CHAINS } from "./config.js";
import type { WizardAnswers } from "./wizard.js";
import { hasFeature } from "./wizard.js";
import {
    generatePackageJson,
    generateEnvExample,
    generateRegisterScript,
    generateAgentTs,
    generateReadme,
} from "./templates/core/base.js";
import {
    getPackageJsonExtras,
    getEnvBlock,
    getReadmeStructureLine,
    getReadmeSection,
    generateGiveFeedbackScript,
} from "./templates/feedback-agent.js";
import { generateA2AServer, generateAgentCard, generateA2AClient } from "./templates/protocols/a2a.js";
import { generateMCPServer, generateMCPTools } from "./templates/protocols/mcp.js";
import { generateTradingEngine } from "./templates/arbitrum/trading-engine.js";
import { generateDataFeed, generateOracleTools } from "./templates/arbitrum/data-feed.js";
import { generateTaskRunner } from "./templates/arbitrum/task-runner.js";
import { upsertAgent } from "./registry.js";
import { ARCHETYPES } from "./archetypes/index.js";
import { SKILL_CATEGORIES } from "./skills-catalog.js";

/**
 * Archetype-specific extra files written after the base scaffold.
 * Maps archetype ID → { relativePath: content } pairs.
 *
 * How to extend:
 *   1. Add a template generator in src/templates/arbitrum/
 *   2. Register it here — the generator receives the full WizardAnswers
 *   3. Entries here can also OVERRIDE base files (e.g. tools.ts for data-oracle)
 */
const ARCHETYPE_EXTRAS: Record<string, (answers: WizardAnswers) => Record<string, string>> = {
    "trading-agent": () => ({
        "src/trading-engine.ts": generateTradingEngine(),
    }),
    "data-oracle": () => ({
        "src/data-feed.ts": generateDataFeed(),
        // Override the generic tools.ts with oracle-specific MCP tools
        "src/tools.ts": generateOracleTools(),
    }),
    "task-automation": () => ({
        "src/task-runner.ts": generateTaskRunner(),
    }),
};

export async function generateProject(answers: WizardAnswers): Promise<void> {
    const projectPath = path.resolve(process.cwd(), answers.projectDir);

    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, "src"), { recursive: true });

    if (hasFeature(answers, "a2a")) {
        await fs.mkdir(path.join(projectPath, ".well-known"), { recursive: true });
    }

    // All agents get .claude/ — auto-loaded by Claude Code, usable as context by any LLM
    await fs.mkdir(path.join(projectPath, ".claude"), { recursive: true });

    const chain = CHAINS[answers.chain];
    const archetype = ARCHETYPES[answers.archetype ?? "custom"];

    // Apply archetype skills to answers
    if (archetype && archetype.id !== "custom") {
        answers.skills = archetype.skills;
    }

    // Build package.json — all agents get feedback scripts
    let packageJson = generatePackageJson(answers);
    const pkg = JSON.parse(packageJson) as { scripts: Record<string, string> };
    Object.assign(pkg.scripts, getPackageJsonExtras().scripts);
    packageJson = JSON.stringify(pkg, null, 2);
    await writeFile(projectPath, "package.json", packageJson);

    let env = generateEnvExample(answers, chain);
    env += getEnvBlock();
    await writeFile(projectPath, ".env", env);

    await writeFile(projectPath, "src/register.ts", generateRegisterScript(answers, chain));
    await writeFile(projectPath, "src/agent.ts", generateAgentTs(answers, archetype?.systemPrompt));
    await writeFile(projectPath, "tsconfig.json", generateTsConfig());
    await writeFile(projectPath, ".gitignore", generateGitignore());

    // All agents include feedback README section
    const readmeOpts = {
        extraStructureLines: [getReadmeStructureLine()],
        extraSections: [getReadmeSection()],
    };
    await writeFile(projectPath, "README.md", generateReadme(answers, chain, readmeOpts));

    // All agents include give-feedback script
    await writeFile(projectPath, "src/give-feedback.ts", generateGiveFeedbackScript());

    // .claude/CLAUDE.md — generated for ALL agents regardless of LLM provider.
    // For Claude: auto-loaded natively by Claude Code as project context.
    // For OpenAI: useful as documentation; selected OASF skills are also injected
    //             into the system prompt in agent.ts automatically.
    // Note: OASF skills ≠ Claude/AI skills — they are on-chain ERC-8004 identifiers.
    await writeFile(projectPath, ".claude/CLAUDE.md", generateClaudeMd(answers, chain));

    if (hasFeature(answers, "a2a")) {
        await writeFile(projectPath, "src/a2a-server.ts", generateA2AServer(answers));
        await writeFile(projectPath, "src/a2a-client.ts", generateA2AClient());
        await writeFile(projectPath, ".well-known/agent-card.json", generateAgentCard(answers));
    }

    if (hasFeature(answers, "mcp")) {
        await writeFile(projectPath, "src/mcp-server.ts", generateMCPServer(answers));
        await writeFile(projectPath, "src/tools.ts", generateMCPTools());
    }

    // Write archetype-specific extra files (may override base files like tools.ts)
    const extrasFn = ARCHETYPE_EXTRAS[answers.archetype ?? "custom"];
    if (extrasFn) {
        for (const [filePath, content] of Object.entries(extrasFn(answers))) {
            await writeFile(projectPath, filePath, content);
        }
    }

    const repoRoot = process.cwd();
    await writeFile(
        projectPath,
        ".8004.json",
        JSON.stringify({ projectDir: answers.projectDir, agentType: "generic" }, null, 0)
    );
    await upsertAgent(repoRoot, {
        projectDir: answers.projectDir,
        name: answers.agentName,
        agentType: "generic",
    });
}

async function writeFile(projectPath: string, filePath: string, content: string): Promise<void> {
    await fs.writeFile(path.join(projectPath, filePath), content, "utf-8");
}

function generateTsConfig(): string {
    return JSON.stringify(
        {
            compilerOptions: {
                target: "ES2022",
                module: "NodeNext",
                moduleResolution: "NodeNext",
                outDir: "./dist",
                rootDir: "./src",
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                resolveJsonModule: true,
            },
            include: ["src/**/*"],
            exclude: ["node_modules", "dist"],
        },
        null,
        2
    );
}

function generateGitignore(): string {
    return `node_modules/
dist/
.env
*.log
`;
}

/**
 * Generate .claude/CLAUDE.md for ALL agents (OpenAI and Claude).
 *
 * For Claude agents: auto-loaded by Claude Code when working in this repo.
 * For OpenAI agents: useful as documentation; selected OASF skills are also
 *   injected automatically into the agent.ts system prompt.
 *
 * IMPORTANT: OASF skills are on-chain ERC-8004 blockchain identifiers that make
 * the agent discoverable. They are NOT Claude/AI model capabilities — they are
 * immutable metadata registered on-chain. Selecting inaccurate skills affects
 * your agent's on-chain reputation score.
 */
function generateClaudeMd(answers: WizardAnswers, chain: (typeof CHAINS)[keyof typeof CHAINS]): string {
    const selectedSkills = answers.skills ?? [];
    const llmLabel =
        answers.llmProvider === "claude"
            ? `Claude — ${answers.llmModel ?? "claude-sonnet-4-6"} (Anthropic)`
            : `OpenAI — ${answers.llmModel ?? "gpt-4o-mini"}`;
    const llmKeyVar = answers.llmProvider === "claude" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    const features = answers.features.join(", ") || "none";

    // Build selected OASF skills section
    const selectedSection =
        selectedSkills.length > 0
            ? selectedSkills.map((s) => `- \`${s}\``).join("\n")
            : "_No OASF skills selected. Add skills in `src/register.ts` before registering on-chain._";

    // Build web3 reference skills from the catalog (ethSkills + EVM-specific categories)
    const web3RefCategories = SKILL_CATEGORIES.filter((c) =>
        ["DeFi & Finance", "Smart Contracts", "Data & Analytics", "Infrastructure & DevOps",
         "Ethereum Dev (ethskills.com)", "Arbitrum (arbitrum-dapp-skill)"].includes(c.name)
    );
    const web3RefSection = web3RefCategories
        .map((cat) => {
            // Neutralise category names so no specific L2 is singled out
            const displayName = cat.name
                .replace("Arbitrum (arbitrum-dapp-skill)", "EVM L2 dApp Skills")
                .replace("Ethereum Dev (ethskills.com)", "Ethereum Dev Skills");
            const skillLines = cat.skills.map((s) => `  - ${s.name} — \`${s.value}\``).join("\n");
            return `**${displayName}**\n${skillLines}`;
        })
        .join("\n\n");

    const llmUsageNote =
        answers.llmProvider === "claude"
            ? `This file is **automatically loaded** by Claude Code when you open this project.
Claude will have full context about the agent's purpose, chain, wallet, and OASF skills.`
            : `This file is loaded as **reference documentation** for your OpenAI agent.
The OASF skills you selected are also injected into \`src/agent.ts\` as a system prompt prefix,
so the LLM is aware of its declared on-chain capabilities at inference time.`;

    return `# ${answers.agentName} — Agent Context

> ${answers.agentDescription}

---

## How This File Is Used

${llmUsageNote}

> **Important distinction**: OASF skills listed below are **on-chain blockchain identifiers**
> registered via ERC-8004. They are NOT Claude/AI model skills or capabilities.
> They exist on the blockchain and make your agent discoverable by other agents.

---

## Agent Details

| Field | Value |
|-------|-------|
| Name | ${answers.agentName} |
| Chain | ${chain.name} |
| Wallet | \`${answers.agentWallet}\` |
| LLM Provider | ${llmLabel} |
| Features | ${features} |
| Standard | ERC-8004 |

---

## OASF Skills — Registered On-Chain Capabilities

> ⚠️ These skills are stored on the **${chain.name} blockchain** and affect your agent's
> **on-chain reputation**. Only register skills your agent genuinely supports.
> Taxonomy reference: https://schema.oasf.outshift.com/0.8.0

${selectedSection}

---

## Web3 Skills Reference

The following skills are available in the OASF taxonomy for web3 and EVM agents.
Use these as reference when expanding your agent's capabilities.
Skills with URL values point to skill specification documents fetchable by other agents.

${web3RefSection}

---

## Architecture

\`\`\`
src/
├── agent.ts         — LLM logic (${answers.llmProvider === "claude" ? "Claude via @anthropic-ai/sdk" : "OpenAI via openai SDK"})
├── register.ts      — On-chain ERC-8004 registration${answers.features.includes("a2a") ? "\n├── a2a-server.ts   — A2A server (agent-to-agent communication)\n└── a2a-client.ts   — A2A testing client" : ""}${answers.features.includes("mcp") ? "\n└── mcp-server.ts   — MCP server (tool exposure)" : ""}
└── give-feedback.ts — Submit on-chain feedback for other agents
\`\`\`

## Commands

\`\`\`bash
npm run register      # Register agent identity on-chain (ERC-8004)
${answers.features.includes("a2a") ? "npm run start:a2a     # Start A2A server on port 3000\n" : ""}${answers.features.includes("mcp") ? "npm run start:mcp     # Start MCP server\n" : ""}npm run feedback      # Submit on-chain feedback for another agent
\`\`\`

## Environment Variables

- \`${llmKeyVar}\` — LLM inference
- \`PRIVATE_KEY\` — Wallet private key for on-chain transactions
- \`PINATA_JWT\` — IPFS storage for agent metadata
- \`RPC_URL\` — RPC endpoint for ${chain.name}

## Resources

- [ERC-8004 Standard](https://eips.ethereum.org/EIPS/eip-8004)
- [8004scan Explorer](https://www.8004scan.io/)
- [OASF Taxonomy](https://schema.oasf.outshift.com/0.8.0)
- [Ethereum Skills](https://ethskills.com)
`;
}
