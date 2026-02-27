import inquirer from "inquirer";

export type MainAction = "init" | "create" | "communicate" | "import";

export async function runMainMenu(): Promise<MainAction> {
    const { action } = await inquirer.prompt<{ action: MainAction }>([
        {
            type: "list",
            name: "action",
            message: "What do you want to do?",
            choices: [
                { name: "⚡ Agent Examples    Pre-configured agent scaffolds", value: "init" },
                { name: "🛠️  Create           Full wizard with all options", value: "create" },
                { name: "💬 Communicate       Chat with a deployed agent via A2A", value: "communicate" },
                { name: "📦 Import            Add ERC-8004 to an existing project", value: "import" },
            ],
        },
    ]);
    return action;
}
