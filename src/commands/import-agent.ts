/**
 * Import Agent command
 *
 * Adds ERC-8004 compliance to an existing project by scaffolding:
 *   - src/register.ts   (on-chain registration script)
 *   - .env.8004.example (environment template, safe — won't overwrite .env)
 *   - src/a2a-server.ts / a2a-client.ts  (if A2A selected)
 *   - src/mcp-server.ts / tools.ts        (if MCP selected)
 *   - Merges ERC-8004 scripts + deps into existing package.json
 *   - Registers the agent in the local .8004-agents.json registry
 *
 * Existing files are never silently overwritten — user is prompted first.
 */

import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs/promises";
import path from "path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { CHAINS, type ChainKey, type TrustModel } from "../config.js";
import {
    generateEnvExample,
    generateRegisterScript,
} from "../templates/core/base.js";
import { generateA2AServer, generateAgentCard, generateA2AClient } from "../templates/protocols/a2a.js";
import { generateMCPServer, generateMCPTools } from "../templates/protocols/mcp.js";
import { upsertAgent } from "../registry.js";
import type { WizardAnswers } from "../wizard.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function exists(p: string): Promise<boolean> {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

/**
 * Write a file, but if it already exists ask the user whether to overwrite.
 * Returns true if the file was written.
 */
async function safeWrite(filePath: string, content: string): Promise<boolean> {
    if (await exists(filePath)) {
        const rel = path.relative(process.cwd(), filePath);
        const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
            {
                type: "confirm",
                name: "overwrite",
                message: chalk.yellow(`  ${rel} already exists — overwrite?`),
                default: false,
            },
        ]);
        if (!overwrite) return false;
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    return true;
}

/**
 * Merge ERC-8004 scripts and dependencies into an existing package.json.
 * If package.json doesn't exist, writes a minimal one.
 */
async function mergePackageJson(
    pkgPath: string,
    extraScripts: Record<string, string>,
    extraDeps: Record<string, string>,
    extraDevDeps: Record<string, string>
): Promise<void> {
    let pkg: Record<string, unknown> = {};
    if (await exists(pkgPath)) {
        const raw = await fs.readFile(pkgPath, "utf-8");
        pkg = JSON.parse(raw) as Record<string, unknown>;
    }

    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;

    // Only add keys that don't already exist — don't overwrite what's there
    for (const [k, v] of Object.entries(extraScripts)) {
        if (!(k in scripts)) scripts[k] = v;
    }
    for (const [k, v] of Object.entries(extraDeps)) {
        if (!(k in deps)) deps[k] = v;
    }
    for (const [k, v] of Object.entries(extraDevDeps)) {
        if (!(k in devDeps)) devDeps[k] = v;
    }

    pkg.scripts = scripts;
    pkg.dependencies = deps;
    pkg.devDependencies = devDeps;
    if (!("type" in pkg)) pkg.type = "module";

    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}

// ─── prompt ──────────────────────────────────────────────────────────────────

interface ImportAnswers {
    projectDir: string;
    agentName: string;
    agentDescription: string;
    agentImage: string;
    chain: ChainKey;
    features: ("a2a" | "mcp")[];
    a2aStreaming: boolean;
    trustModels: TrustModel[];
}

async function promptImport(): Promise<ImportAnswers & { agentWallet: string; generatedPrivateKey: string }> {
    console.log(chalk.bold("\n📦 Import Agent — Add ERC-8004 to an existing project\n"));

    const answers = await inquirer.prompt<ImportAnswers>([
        {
            type: "input",
            name: "projectDir",
            message: "Path to your existing project (relative or absolute):",
            default: ".",
            validate: async (input: string) => {
                const resolved = path.resolve(process.cwd(), input.trim());
                if (!(await exists(resolved))) return `Directory not found: ${resolved}`;
                const stat = await fs.stat(resolved);
                return stat.isDirectory() ? true : "Path must be a directory";
            },
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
            default: "An AI agent registered on the ERC-8004 protocol",
        },
        {
            type: "input",
            name: "agentImage",
            message: "Agent image URL:",
            default: "https://example.com/agent.png",
        },
        {
            type: "list",
            name: "chain",
            message: "Blockchain network:",
            choices: [
                new inquirer.Separator("── Mainnets ──"),
                ...Object.entries(CHAINS)
                    .filter(([, c]) => !c.name.includes("Testnet"))
                    .map(([k, c]) => ({ name: c.name.replace(" Mainnet", ""), value: k })),
                new inquirer.Separator("── Testnets ──"),
                ...Object.entries(CHAINS)
                    .filter(([, c]) => c.name.includes("Testnet"))
                    .map(([k, c]) => ({ name: c.name.replace(" (Testnet)", ""), value: k })),
            ],
        },
        {
            type: "checkbox",
            name: "features",
            message: "ERC-8004 features to add:",
            choices: [
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
            ],
        },
        {
            type: "confirm",
            name: "a2aStreaming",
            message: `Enable A2A streaming responses?  ${chalk.gray("(real-time progressive responses instead of waiting for complete output)")}`,
            default: false,
            when: (ans: Partial<ImportAnswers>) => ans.features?.includes("a2a") ?? false,
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
    ]);

    // Always auto-generate a new wallet
    const pk = generatePrivateKey();
    const account = privateKeyToAccount(pk);
    console.log("\n🔑 Generated new wallet:", account.address);

    return {
        ...answers,
        agentWallet: account.address,
        generatedPrivateKey: pk,
        a2aStreaming: answers.a2aStreaming ?? false,
    };
}

// ─── main ─────────────────────────────────────────────────────────────────────

export async function runImportAgent(): Promise<void> {
    const answers = await promptImport();

    const projectPath = path.resolve(process.cwd(), answers.projectDir.trim());
    const chain = CHAINS[answers.chain];
    const hasA2A = answers.features.includes("a2a");
    const hasMCP = answers.features.includes("mcp");

    // Build a WizardAnswers-compatible object for template generators
    const wizardLike: WizardAnswers = {
        archetype: "custom",
        projectDir: answers.projectDir,
        agentName: answers.agentName,
        agentDescription: answers.agentDescription,
        agentImage: answers.agentImage,
        features: [...answers.features],
        a2aStreaming: answers.a2aStreaming,
        chain: answers.chain,
        trustModels: answers.trustModels,
        agentWallet: answers.agentWallet,
        generatedPrivateKey: answers.generatedPrivateKey,
        skills: [],
        domains: [],
        llmProvider: "openai",
        llmModel: "gpt-4o-mini",
    };

    console.log(chalk.bold("\n🔧 Scaffolding ERC-8004 files...\n"));

    const written: string[] = [];
    const skipped: string[] = [];

    const track = (rel: string, ok: boolean) =>
        ok ? written.push(rel) : skipped.push(rel);

    // .env.8004.example — never risks overwriting their real .env
    const envContent = generateEnvExample(wizardLike, chain);
    const envDest = path.join(projectPath, ".env.8004.example");
    track(".env.8004.example", await safeWrite(envDest, envContent));

    // src/register.ts
    const registerDest = path.join(projectPath, "src", "register.ts");
    track(
        "src/register.ts",
        await safeWrite(registerDest, generateRegisterScript(wizardLike, chain))
    );

    // A2A files
    if (hasA2A) {
        await fs.mkdir(path.join(projectPath, ".well-known"), { recursive: true });
        track("src/a2a-server.ts", await safeWrite(path.join(projectPath, "src", "a2a-server.ts"), generateA2AServer(wizardLike)));
        track("src/a2a-client.ts", await safeWrite(path.join(projectPath, "src", "a2a-client.ts"), generateA2AClient()));
        track(".well-known/agent-card.json", await safeWrite(path.join(projectPath, ".well-known", "agent-card.json"), generateAgentCard(wizardLike)));
    }

    // MCP files
    if (hasMCP) {
        track("src/mcp-server.ts", await safeWrite(path.join(projectPath, "src", "mcp-server.ts"), generateMCPServer(wizardLike)));
        track("src/tools.ts", await safeWrite(path.join(projectPath, "src", "tools.ts"), generateMCPTools()));
    }

    // Merge into package.json
    const extraScripts: Record<string, string> = {
        register: "tsx src/register.ts",
    };
    const extraDeps: Record<string, string> = {
        "@blockbyvlog/agent0-sdk": "latest",
        dotenv: "^16.3.1",
        viem: "^2.21.0",
    };
    const extraDevDeps: Record<string, string> = {
        tsx: "^4.7.0",
        typescript: "^5.3.0",
        "@types/node": "^20.10.0",
    };

    if (hasA2A) {
        extraScripts["start:a2a"] = "tsx src/a2a-server.ts";
        extraScripts["a2a:discover"] = "tsx src/a2a-client.ts --discover";
        extraScripts["a2a:chat"] = "tsx src/a2a-client.ts --interactive";
        extraDeps["express"] = "^4.18.2";
        extraDeps["uuid"] = "^9.0.0";
        extraDevDeps["@types/express"] = "^4.17.21";
        extraDevDeps["@types/uuid"] = "^9.0.7";
    }
    if (hasMCP) {
        extraScripts["start:mcp"] = "tsx src/mcp-server.ts";
        extraDeps["@modelcontextprotocol/sdk"] = "^1.0.0";
    }

    await mergePackageJson(
        path.join(projectPath, "package.json"),
        extraScripts,
        extraDeps,
        extraDevDeps
    );
    written.push("package.json (merged)");

    // .8004.json marker
    const meta8004 = path.join(projectPath, ".8004.json");
    if (!(await exists(meta8004))) {
        await fs.writeFile(
            meta8004,
            JSON.stringify({ projectDir: answers.projectDir, agentType: "generic" }, null, 0),
            "utf-8"
        );
        written.push(".8004.json");
    }

    // Update local registry
    const repoRoot = process.cwd();
    await upsertAgent(repoRoot, {
        projectDir: answers.projectDir,
        name: answers.agentName,
        agentType: "generic",
    });

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log(chalk.green("\n✅ ERC-8004 scaffolding complete!\n"));

    if (written.length) {
        console.log(chalk.bold("Files written:"));
        for (const f of written) console.log("  " + chalk.cyan(f));
    }
    if (skipped.length) {
        console.log(chalk.bold("\nFiles skipped (already existed):"));
        for (const f of skipped) console.log("  " + chalk.gray(f));
    }

    console.log(chalk.bold("\n📋 Next steps:"));
    console.log(`  1. Fill in ${chalk.cyan(".env.8004.example")} and rename it to ${chalk.cyan(".env")} (or merge into your existing .env)`);
    console.log(`  2. Run ${chalk.cyan("npm install")} inside ${chalk.cyan(answers.projectDir)}`);
    console.log(`  3. Run ${chalk.cyan("npm run register")} to mint your agent on-chain`);
    if (hasA2A) {
        console.log(`  4. Run ${chalk.cyan("npm run start:a2a")} to start the A2A server`);
    }
    console.log();
}
