import fs from "fs/promises";
import path from "path";
import { CHAINS } from "./config.js";
import type { WizardAnswers } from "./wizard.js";
import { hasFeature, isFeedbackAgent } from "./wizard.js";
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
import { upsertAgent } from "./registry.js";
import { ARCHETYPES } from "./archetypes/index.js";

export async function generateProject(answers: WizardAnswers): Promise<void> {
    const projectPath = path.resolve(process.cwd(), answers.projectDir);

    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, "src"), { recursive: true });

    if (hasFeature(answers, "a2a")) {
        await fs.mkdir(path.join(projectPath, ".well-known"), { recursive: true });
    }

    const chain = CHAINS[answers.chain];
    const archetype = ARCHETYPES[answers.archetype ?? "custom"];

    // Merge archetype OASF metadata into answers (used by register.ts template)
    if (archetype && archetype.id !== "custom") {
        answers.skills = archetype.skills;
        answers.domains = archetype.domains;
    }

    // Build package.json (with archetype extra deps + orchestrator scripts)
    let packageJson = generatePackageJson(answers, archetype);
    if (isFeedbackAgent(answers)) {
        const pkg = JSON.parse(packageJson) as { scripts: Record<string, string> };
        Object.assign(pkg.scripts, getPackageJsonExtras().scripts);
        packageJson = JSON.stringify(pkg, null, 2);
    }
    await writeFile(projectPath, "package.json", packageJson);

    let env = generateEnvExample(answers, chain);
    if (isFeedbackAgent(answers)) env += getEnvBlock();
    await writeFile(projectPath, ".env", env);

    await writeFile(projectPath, "src/register.ts", generateRegisterScript(answers, chain));
    await writeFile(projectPath, "src/agent.ts", generateAgentTs(answers, archetype?.systemPrompt));
    await writeFile(projectPath, "tsconfig.json", generateTsConfig());
    await writeFile(projectPath, ".gitignore", generateGitignore());

    const readmeOpts = isFeedbackAgent(answers)
        ? { extraStructureLines: [getReadmeStructureLine()], extraSections: [getReadmeSection()] }
        : undefined;
    await writeFile(projectPath, "README.md", generateReadme(answers, chain, readmeOpts));

    if (isFeedbackAgent(answers)) {
        await writeFile(projectPath, "src/give-feedback.ts", generateGiveFeedbackScript());
    }

    if (hasFeature(answers, "a2a")) {
        await writeFile(projectPath, "src/a2a-server.ts", generateA2AServer(answers));
        await writeFile(projectPath, "src/a2a-client.ts", generateA2AClient());
        await writeFile(projectPath, ".well-known/agent-card.json", generateAgentCard(answers));
    }

    if (hasFeature(answers, "mcp")) {
        await writeFile(projectPath, "src/mcp-server.ts", generateMCPServer(answers));
        await writeFile(projectPath, "src/tools.ts", generateMCPTools(archetype?.mcpTools));
    }

    // Generate archetype extra files (e.g. registry-service.ts, orchestrator.ts)
    if (archetype && archetype.id !== "custom") {
        for (const extra of archetype.extraTemplates) {
            // Ensure nested directories exist
            const fullPath = path.join(projectPath, extra.path);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, extra.generator(answers), "utf-8");
        }
    }

    const repoRoot = process.cwd();
    await writeFile(
        projectPath,
        ".8004.json",
        JSON.stringify({ projectDir: answers.projectDir, agentType: answers.agentType }, null, 0)
    );
    await upsertAgent(repoRoot, {
        projectDir: answers.projectDir,
        name: answers.agentName,
        agentType: answers.agentType,
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
