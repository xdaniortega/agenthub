/**
 * Pre-flight environment validation.
 *
 * Called before any agent-creation flow (create / init) to ensure the
 * developer has a properly configured root .env before generating projects
 * that depend on those credentials.
 *
 * Required variables:
 *   PRIVATE_KEY    — master wallet; pays gas for registrations
 *   PINATA_JWT     — Pinata IPFS; stores ERC-8004 agent metadata
 *   OPENAI_API_KEY — OpenAI; powers the LLM inside generated agents
 */

import fs from "fs";
import path from "path";
import chalk from "chalk";
import { config } from "dotenv";

const REQUIRED_VARS = ["PRIVATE_KEY", "PINATA_JWT", "OPENAI_API_KEY"] as const;

/**
 * Validate that the root .env exists and all required variables are non-empty.
 *
 * @returns true if the environment is valid, false otherwise (caller should exit).
 */
export function validateEnv(): boolean {
    const envPath = path.join(process.cwd(), ".env");

    if (!fs.existsSync(envPath)) {
        console.log(chalk.red("\n❌  No .env file found at project root."));
        console.log(chalk.yellow("    Copy .env.example to .env and fill in your credentials:\n"));
        console.log(chalk.cyan("    cp .env.example .env\n"));
        console.log(chalk.gray("    Then open .env and set PRIVATE_KEY, PINATA_JWT, and OPENAI_API_KEY.\n"));
        return false;
    }

    // Load without overwriting already-set vars (safe to call multiple times)
    config({ path: envPath, override: false });

    const missing = REQUIRED_VARS.filter((key) => !process.env[key]?.trim());

    if (missing.length > 0) {
        console.log(chalk.red(`\n❌  Missing required variables in .env:\n`));
        for (const key of missing) {
            console.log(chalk.yellow(`    • ${key}`));
        }
        console.log(chalk.gray("\n    See .env.example for descriptions of each variable."));
        console.log(chalk.gray("    Fill them in, then run agenthub again.\n"));
        return false;
    }

    return true;
}
