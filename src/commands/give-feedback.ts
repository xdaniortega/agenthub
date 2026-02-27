import inquirer from "inquirer";
import chalk from "chalk";
import { spawn } from "child_process";
import path from "path";
import {
    readRegistry,
    findRegistryRoot,
    getDeployedAgents,
    type RegistryAgent,
} from "../registry.js";
import { loadEnvForCommands } from "./load-env.js";
import { exitWithError } from "./exit-with-error.js";

export async function runGiveFeedback(): Promise<void> {
    loadEnvForCommands();

    const cwd = process.cwd();
    const registryRoot = await findRegistryRoot(cwd);
    if (!registryRoot) {
        exitWithError(
            "No local registry found. Run this command from the same repo where you created agents (where .8004-agents.json lives), or create an agent first with Create agent."
        );
    }

    const registry = await readRegistry(cwd);
    if (!registry) {
        exitWithError("Could not read .8004-agents.json");
    }

    const deployed = getDeployedAgents(registry);
    if (deployed.length === 0) {
        exitWithError(
            "No deployed agents in the local registry. Register at least one agent (cd into an agent folder and run npm run register), then run Give feedback again."
        );
    }

    console.log(chalk.gray("Choose which agent to use to give feedback. Only Feedback Agent type can submit feedback.\n"));

    const choices = deployed.map((a) => ({
        name: `${a.name} (${a.projectDir})${a.agentType === "generic" ? " " + chalk.dim("[generic – cannot give feedback]") : ""}`,
        value: a,
    }));

    const { agent: selected } = await inquirer.prompt<{ agent: RegistryAgent }>([
        {
            type: "list",
            name: "agent",
            message: "With which agent do you want to give feedback?",
            choices,
        },
    ]);

    if (selected.agentType === "generic") {
        console.error(chalk.red("\nThis agent type cannot give feedback."));
        console.error(chalk.yellow("Only a Feedback Agent project can submit feedback. Create a Feedback Agent and use that one, or select a Feedback Agent from the list."));
        process.exit(1);
    }

    const agentPath = path.join(registryRoot, selected.projectDir);
    console.log(chalk.cyan(`\nRunning feedback flow for "${selected.name}"...\n`));

    const child = spawn("npm", ["run", "feedback"], {
        cwd: agentPath,
        stdio: "inherit",
    });

    child.on("close", (code) => {
        process.exit(code ?? 0);
    });
}
