import inquirer from "inquirer";

export type MainAction = "create" | "communicate" | "import";

export async function runMainMenu(): Promise<MainAction> {
    const { action } = await inquirer.prompt<{ action: MainAction }>([
        {
            type: "list",
            name: "action",
            message: "What do you want to do?",
            choices: [
                { name: "🛠️  Create a new agent", value: "create" },
                { name: "💬 Communicate with my agents", value: "communicate" },
                { name: "📦 Import my agent", value: "import" },
            ],
        },
    ]);
    return action;
}
