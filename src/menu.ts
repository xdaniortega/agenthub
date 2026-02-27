import inquirer from "inquirer";

export type MainAction = "create" | "give-feedback" | "read-feedback";

export async function runMainMenu(): Promise<MainAction> {
    const { action } = await inquirer.prompt<{ action: MainAction }>([
        {
            type: "list",
            name: "action",
            message: "What do you want to do?",
            choices: [
                { name: "Create agent — scaffold a new ERC-8004 agent project", value: "create" },
                { name: "Give feedback — submit a reputation score for an agent", value: "give-feedback" },
                { name: "Read feedback — view feedback and reputation for an agent", value: "read-feedback" },
            ],
        },
    ]);
    return action;
}
