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

    if (answers.llmProvider === "claude") {
        await fs.mkdir(path.join(projectPath, ".claude"), { recursive: true });
    }

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

    // For Claude agents: write .claude/CLAUDE.md with OASF skills context
    // This file is auto-loaded by Claude Code, giving it full agent context.
    // Note: OASF skills ≠ Claude skills — they are on-chain ERC-8004 metadata.
    if (answers.llmProvider === "claude") {
        await writeFile(projectPath, ".claude/CLAUDE.md", generateClaudeMd(answers, chain));
    }

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
 * Generate .claude/CLAUDE.md for Claude-powered agents.
 *
 * This file is auto-loaded by Claude Code when working inside the agent repo,
 * giving it full context about the agent's purpose, chain, and OASF skills.
 *
 * IMPORTANT: OASF skills are on-chain ERC-8004 taxonomy identifiers that make
 * the agent discoverable. They are NOT the same as Claude skills — they are
 * blockchain metadata, not Claude Code capabilities.
 */
function generateClaudeMd(answers: WizardAnswers, chain: (typeof CHAINS)[keyof typeof CHAINS]): string {
    const skills = answers.skills ?? [];
    const skillSection =
        skills.length > 0
            ? `## OASF Skills (On-Chain Registered Capabilities)

> **Important**: These are OASF (Open Agent Specification Framework) taxonomy identifiers
> registered on the ERC-8004 blockchain. They are **NOT** Claude skills — they are
> on-chain metadata that make this agent discoverable by other agents and tools.
>
> Browse taxonomy: https://schema.oasf.outshift.com/0.8.0

${skills.map((s) => `- \`${s}\``).join("\n")}
`
            : `## OASF Skills

No OASF skills selected. Add skills in \`src/register.ts\` before registering on-chain.
Browse taxonomy: https://schema.oasf.outshift.com/0.8.0
`;

    const features = answers.features.join(", ") || "none";

    return `# ${answers.agentName} — Agent Context

${answers.agentDescription}

## Agent Details

| Field | Value |
|-------|-------|
| Name | ${answers.agentName} |
| Chain | ${chain.name} |
| Wallet | \`${answers.agentWallet}\` |
| LLM | Claude (${answers.llmModel ?? "claude-sonnet-4-6"}) |
| Features | ${features} |
| Standard | ERC-8004 |

${skillSection}
## Architecture

\`\`\`
src/
├── agent.ts         — LLM logic (Claude via @anthropic-ai/sdk)
├── register.ts      — On-chain ERC-8004 registration${answers.features.includes("a2a") ? "\n├── a2a-server.ts   — A2A server (agent-to-agent communication)\n└── a2a-client.ts   — A2A testing client" : ""}${answers.features.includes("mcp") ? "\n└── mcp-server.ts   — MCP server (tool exposure)" : ""}
\`\`\`

## Development Commands

\`\`\`bash
npm run register      # Register agent identity on-chain (ERC-8004)
${answers.features.includes("a2a") ? "npm run start:a2a     # Start A2A server on port 3000\n" : ""}${answers.features.includes("mcp") ? "npm run start:mcp     # Start MCP server\n" : ""}npm run feedback      # Submit on-chain feedback for another agent
\`\`\`

## Environment Variables

- \`ANTHROPIC_API_KEY\` — Required for LLM inference
- \`PRIVATE_KEY\` — Wallet private key for on-chain transactions
- \`PINATA_JWT\` — IPFS storage for agent metadata
- \`RPC_URL\` — RPC endpoint for ${chain.name}

## Resources

- [ERC-8004 Standard](https://eips.ethereum.org/EIPS/eip-8004)
- [8004scan Explorer](https://www.8004scan.io/)
- [OASF Taxonomy](https://schema.oasf.outshift.com/0.8.0)
- [Anthropic SDK Docs](https://docs.anthropic.com/en/api/getting-started)
`;
}
