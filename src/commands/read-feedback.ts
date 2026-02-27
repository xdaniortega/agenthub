import inquirer from "inquirer";
import chalk from "chalk";
import { SDK } from "@blockbyvlog/agent0-sdk";
import { CHAINS, getChainChoices, validateAgentId, type ChainKey } from "../config.js";
import { loadEnvForCommands } from "./load-env.js";

export async function runReadFeedback(): Promise<void> {
    loadEnvForCommands();

    const answers = await inquirer.prompt<{ chainKey: ChainKey; agentId: string }>([
        {
            type: "list",
            name: "chainKey",
            message: "Chain:",
            choices: getChainChoices(),
        },
        {
            type: "input",
            name: "agentId",
            message: "Agent ID (format chainId:tokenId, e.g. 421614:5):",
            validate: (v: string) => validateAgentId(v ?? ""),
        },
    ]);

    const chain = CHAINS[answers.chainKey];
    const rpcUrl = (process.env.RPC_URL || chain.rpcUrl).trim();
    const agentId = answers.agentId.trim();

    const sdk = new SDK({
        chainId: chain.chainId,
        rpcUrl,
    });

    console.log(chalk.cyan("\nFetching feedback..."));
    const feedbacks = await sdk.searchFeedback({ agentId });
    const summary = await sdk.getReputationSummary(agentId);

    console.log(chalk.bold("\nReputation summary"));
    console.log("  Average value:", summary?.averageValue ?? "—");
    console.log("  Feedback count:", summary?.count ?? feedbacks.length);
    console.log(chalk.bold("\nFeedback entries"));
    if (feedbacks.length === 0) {
        console.log("  (none)");
    } else {
        for (const f of feedbacks.slice(0, 20)) {
            const val = (f as { value?: number }).value ?? "—";
            const t1 = (f as { tag1?: string }).tag1 ?? "";
            const t2 = (f as { tag2?: string }).tag2 ?? "";
            console.log(`  - value: ${val}  tag1: ${t1}  tag2: ${t2}`);
        }
        if (feedbacks.length > 20) {
            console.log(chalk.gray(`  ... and ${feedbacks.length - 20} more`));
        }
    }
    console.log("");
}
