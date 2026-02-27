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
