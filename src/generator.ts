import fs from "fs/promises";
import path from "path";
import ora from "ora";
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
import { OASF_OFFICIAL_CATEGORIES } from "./skills-catalog.js";

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

    // skills.md — generated for ALL agents regardless of LLM provider.
    // For Claude: load this file as context in Claude Code with /add-file or reference it.
    // For OpenAI: skills are also injected into the system prompt in agent.ts automatically.
    // Contains OASF capability declarations + fetched web3 skill content.
    // Note: OASF skills ≠ LLM skills — they are on-chain ERC-8004 identifiers.
    const skillsContent = await generateSkillsMd(answers);
    await writeFile(projectPath, "skills.md", skillsContent);

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
 * Generate skills.md for ALL agents (OpenAI and Claude).
 *
 * Contains OASF capability declarations and fetched web3 skill content.
 * For Claude agents: load with /add-file or reference in Claude Code.
 * For OpenAI agents: skills are also injected into src/agent.ts system prompt.
 *
 * IMPORTANT: OASF skills are on-chain ERC-8004 blockchain identifiers that make
 * the agent discoverable. They are NOT LLM model capabilities — they are
 * immutable metadata registered on-chain. Selecting inaccurate skills affects
 * your agent's on-chain reputation score.
 */
async function generateSkillsMd(answers: WizardAnswers): Promise<string> {
    // Separate URL-based web3 skills from taxonomy-path OASF skills
    const allSkills = answers.skills ?? [];
    const web3Skills = answers.web3Skills ?? allSkills.filter(
        (s) => s.startsWith("http") || s.startsWith("defi/") || s.startsWith("smart_contracts/") ||
               s.startsWith("data_analysis/") || s.startsWith("infrastructure/") ||
               s.startsWith("nft/") || s.startsWith("gaming/")
    );
    const oasfSkills = allSkills.filter((s) => !web3Skills.includes(s));

    // Resolve OASF skill names from the catalog for display
    const oasfCatalogMap = new Map(
        OASF_OFFICIAL_CATEGORIES.flatMap((cat) => cat.skills.map((s) => [s.value, s.name]))
    );

    // ── OASF section ────────────────────────────────────────────────────────
    const oasfSection =
        oasfSkills.length > 0
            ? oasfSkills
                  .map((s) => `- \`${s}\` — ${oasfCatalogMap.get(s) ?? s}`)
                  .join("\n")
            : "_No OASF AI capability skills selected._";

    // ── Fetch URL-based web3 skills ─────────────────────────────────────────
    const urlSkills = web3Skills.filter((s) => s.startsWith("http"));
    const pathSkills = web3Skills.filter((s) => !s.startsWith("http"));

    let fetchedSections = "";

    if (urlSkills.length > 0) {
        const spinner = ora(`Loading ${urlSkills.length} web3 skill${urlSkills.length > 1 ? "s" : ""}…`).start();

        const results = await Promise.allSettled(
            urlSkills.map(async (url) => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10_000);
                try {
                    const res = await fetch(url, { signal: controller.signal });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return { url, content: await res.text() };
                } finally {
                    clearTimeout(timeout);
                }
            })
        );

        const loaded = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.filter((r) => r.status === "rejected").length;

        if (failed === 0) {
            spinner.succeed(`Loaded ${loaded} web3 skill${loaded > 1 ? "s" : ""}`);
        } else {
            spinner.warn(`Loaded ${loaded}/${urlSkills.length} web3 skills (${failed} failed)`);
        }

        fetchedSections = results
            .map((result, i) => {
                const url = urlSkills[i];
                if (result.status === "fulfilled") {
                    return `\n---\n\n<!-- Source: ${url} -->\n\n${result.value.content.trim()}\n`;
                } else {
                    return `\n---\n\n<!-- Source: ${url} — failed to fetch: ${(result.reason as Error).message} -->\n`;
                }
            })
            .join("");
    }

    // ── Path-based web3 skills (taxonomy IDs, not URLs) ─────────────────────
    const pathSkillsSection =
        pathSkills.length > 0
            ? pathSkills.map((s) => `- \`${s}\``).join("\n")
            : "";

    // ── Build the markdown document ─────────────────────────────────────────
    return `# Agent Skills

## OASF AI Capability Skills (On-Chain Registered)

> These classify **what AI tasks** your agent performs.
> Registered on-chain via ERC-8004 — accurate selection protects your reputation score.
> Full taxonomy: https://schema.oasf.outshift.com/0.8.0

${oasfSection}

---

## Web3 Knowledge Skills

> Domain knowledge loaded into your agent's context.
> For Claude: reference this file in Claude Code. For OpenAI: injected into system prompt.

${pathSkillsSection ? `### Domain Skills\n${pathSkillsSection}\n\n` : ""}${fetchedSections || "_No web3 knowledge skills selected._"}
`;
}
