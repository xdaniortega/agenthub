import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { CHAINS, type ChainKey, type TrustModel } from "./config.js";
import { ARCHETYPES } from "./archetypes/index.js";
import { WEB3_SKILL_CATEGORIES, OASF_OFFICIAL_CATEGORIES, type SkillCategory } from "./skills-catalog.js";

function getAvailableDir(baseDir: string): string {
    if (baseDir === ".") return baseDir;

    const fullPath = path.resolve(process.cwd(), baseDir);
    if (!fs.existsSync(fullPath)) return baseDir;

    let index = 1;
    let newDir = `${baseDir}-${index}`;
    while (fs.existsSync(path.resolve(process.cwd(), newDir))) {
        index++;
        newDir = `${baseDir}-${index}`;
    }
    return newDir;
}

// ── Nested skills browser (reusable) ─────────────────────────────────────────
// Shows categories first; selecting one opens a skills checkbox for that
// category. Pressing Enter saves and goes back to the category list.
// Selecting "Done" at the bottom finalises the selection.

async function promptNestedSkills(
    categories: SkillCategory[],
    title: string
): Promise<string[]> {
    const selectedByCategory = new Map<string, string[]>();

    while (true) {
        const totalSelected = [...selectedByCategory.values()].reduce(
            (sum, v) => sum + v.length,
            0
        );
        const summary = totalSelected > 0 ? chalk.green(` (${totalSelected} selected)`) : "";

        const categoryChoices = [
            ...categories.map((cat) => {
                const count = selectedByCategory.get(cat.name)?.length ?? 0;
                // Neutralise category label for display (no specific L2 branding)
                const displayName = cat.name
                    .replace("Arbitrum (arbitrum-dapp-skill)", "EVM L2 dApp Skills")
                    .replace("Ethereum Dev (ethskills.com)", "Ethereum Dev Skills");
                const badge =
                    count > 0
                        ? chalk.green(` [${count} selected]`)
                        : chalk.gray(` — ${cat.skills.length} skills`);
                return {
                    name: `${displayName}${badge}`,
                    value: cat.name, // internal key stays original for data consistency
                    short: displayName,
                };
            }),
            new inquirer.Separator("  ─────────────────────────────────────────────"),
            {
                name: chalk.bold.cyan("✓  Done — save and continue"),
                value: "__done__",
                short: "Done",
            },
        ];

        const { category } = await inquirer.prompt<{ category: string }>([
            {
                type: "list",
                name: "category",
                message: `${title}${summary} — choose a category (↑↓ navigate, Enter to open):`,
                choices: categoryChoices,
                pageSize: 15,
            },
        ]);

        if (category === "__done__") break;

        const cat = categories.find((c) => c.name === category)!;
        const prevSelected = selectedByCategory.get(category) ?? [];
        const displayName = cat.name
            .replace("Arbitrum (arbitrum-dapp-skill)", "EVM L2 dApp Skills")
            .replace("Ethereum Dev (ethskills.com)", "Ethereum Dev Skills");

        const { picked } = await inquirer.prompt<{ picked: string[] }>([
            {
                type: "checkbox",
                name: "picked",
                message: `${displayName}  ${chalk.gray("(space = toggle · Enter = save & go back)")}`,
                choices: [
                    ...cat.skills.map((s) => ({
                        name: s.name,
                        value: s.value,
                        checked: prevSelected.includes(s.value),
                    })),
                    new inquirer.Separator(
                        "  ─────────────────────────────────────────────"
                    ),
                    new inquirer.Separator(
                        chalk.gray("  ↩  Press Enter to save and go back to categories")
                    ),
                ],
                pageSize: 15,
            },
        ]);

        selectedByCategory.set(category, picked);
    }

    return [...selectedByCategory.values()].flat();
}

// ── Official OASF skills — flat checkbox (only 10 skills, no need for nesting) ─

async function promptOASFSkills(): Promise<string[]> {
    console.log(chalk.bold("\n  📋 OASF Skills — Official Taxonomy (On-Chain Registration)"));
    console.log(
        chalk.gray(
            "  ─────────────────────────────────────────────────────────────────────────────"
        )
    );
    console.log(
        chalk.gray(
            "  OASF skills classify the AI capabilities your agent provides (language, vision,"
        )
    );
    console.log(
        chalk.gray(
            "  audio, reasoning). They are registered on the ERC-8004 blockchain and make"
        )
    );
    console.log(chalk.gray("  your agent discoverable in the on-chain registry."));
    console.log();
    console.log(
        chalk.yellow(
            "  ⚠️  These are NOT web3 knowledge skills — they classify your AI model's"
        )
    );
    console.log(chalk.yellow("     capabilities (e.g. can it generate text? translate? reason?)."));
    console.log(
        chalk.yellow(
            "  ⚠️  Inaccurate selections will damage your agent's on-chain reputation score."
        )
    );
    console.log(
        chalk.gray(
            "  ─────────────────────────────────────────────────────────────────────────────\n"
        )
    );

    const { skills } = await inquirer.prompt<{ skills: string[] }>([
        {
            type: "checkbox",
            name: "skills",
            message: "Select your agent's AI capabilities (space = toggle, Enter = confirm):",
            choices: OASF_OFFICIAL_CATEGORIES.flatMap((cat) => [
                new inquirer.Separator(`  ${cat.name}`),
                ...cat.skills.map((s) => ({ name: s.name, value: s.value })),
            ]),
            pageSize: 20,
        },
    ]);

    return skills ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────

export interface WizardAnswers {
    archetype: string;
    projectDir: string;
    agentName: string;
    agentDescription: string;
    agentImage: string;
    features: ("a2a" | "mcp" | "x402")[];
    a2aStreaming: boolean;
    chain: ChainKey;
    trustModels: TrustModel[];
    agentWallet: string;
    generatedPrivateKey?: string;
    skills?: string[];
    web3Skills?: string[];
    domains?: string[];
    llmProvider: "openai" | "claude";
    llmModel: string;
}

export const hasFeature = (answers: WizardAnswers, feature: "a2a" | "mcp" | "x402") =>
    answers.features.includes(feature);

// "skills" appears in the raw features checkbox but is stripped before WizardAnswers
type RawFeature = "a2a" | "mcp" | "x402" | "skills";

interface RawAnswers {
    projectDir: string;
    agentName: string;
    agentDescription: string;
    agentImage: string;
    features: RawFeature[];
    a2aStreaming?: boolean;
    chain: ChainKey;
    trustModels: TrustModel[];
    llmProvider: "openai" | "claude";
    llmModel: string;
}

export async function runWizard(): Promise<WizardAnswers> {
    console.log("\n");

    const answers = await inquirer.prompt<RawAnswers>([
        {
            type: "input",
            name: "projectDir",
            message: "Project directory (or . for current):",
            default: "agents/my-agent",
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
            default: "test agent created with agenthub",
        },
        {
            type: "input",
            name: "agentImage",
            message: "Agent image URL:",
            default: "https://example.com/agent.png",
        },
        // ── Chain selector ──
        {
            type: "list",
            name: "chain",
            message: "Blockchain network:",
            choices: [
                new inquirer.Separator("── Mainnets ──"),
                ...Object.entries(CHAINS)
                    .filter(([_, chain]) => !chain.name.includes("Testnet"))
                    .map(([key, chain]) => ({
                        name: chain.x402Supported
                            ? `${chain.name.replace(" Mainnet", "")} (x402 supported)`
                            : chain.name.replace(" Mainnet", ""),
                        value: key,
                    })),
                new inquirer.Separator("── Testnets ──"),
                ...Object.entries(CHAINS)
                    .filter(([_, chain]) => chain.name.includes("Testnet"))
                    .map(([key, chain]) => ({
                        name: chain.x402Supported
                            ? `${chain.name.replace(" (Testnet)", "")} (x402 supported)`
                            : chain.name.replace(" (Testnet)", ""),
                        value: key,
                    })),
            ],
        },
        // ── Features (A2A / MCP / x402 / Web3 Skills) ──
        {
            type: "checkbox",
            name: "features",
            message: "Select features to include:",
            choices: (ans: Partial<RawAnswers>) => {
                const chainConfig = ans.chain ? CHAINS[ans.chain] : null;
                const x402Supported = chainConfig?.x402Supported ?? false;
                return [
                    {
                        name: `A2A Server  ${chalk.gray("— Agent-to-Agent protocol: communicate and collaborate with other agents")}`,
                        value: "a2a",
                        checked: true,
                    },
                    {
                        name: `MCP Server  ${chalk.gray("— Model Context Protocol: connect to external tools and data sources")}`,
                        value: "mcp",
                        checked: false,
                    },
                    x402Supported
                        ? {
                              name: `x402 Payments  ${chalk.gray("— USDC micropayments for agent services")}`,
                              value: "x402",
                              checked: false,
                          }
                        : { name: "x402 Payments", value: "x402", disabled: "Not available on this chain" },
                    {
                        name: `Web3 Skills  ${chalk.gray("— Load ethSkills and EVM dApp knowledge into your agent's context")}`,
                        value: "skills",
                        checked: false,
                    },
                ];
            },
        },
        {
            type: "confirm",
            name: "a2aStreaming",
            message: `Enable A2A streaming responses?  ${chalk.gray("(real-time progressive responses instead of waiting for complete output)")}`,
            default: false,
            when: (ans: Partial<RawAnswers>) => (ans.features as string[] | undefined)?.includes("a2a") ?? false,
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
        // ── LLM provider ──
        {
            type: "list",
            name: "llmProvider",
            message: `LLM provider:  ${chalk.gray("— the AI model that will power your agent's intelligence")}`,
            choices: [
                {
                    name: `OpenAI  ${chalk.gray("— GPT-4o-mini, GPT-4o · use OPENAI_API_KEY in .env")}`,
                    value: "openai",
                },
                {
                    name: `Claude (Anthropic)  ${chalk.gray("— Sonnet, Haiku, Opus · use ANTHROPIC_API_KEY in .env")}`,
                    value: "claude",
                },
            ],
        },
        // ── LLM model (dynamic based on provider) ──
        {
            type: "list",
            name: "llmModel",
            message: "LLM model:",
            choices: (ans: Partial<RawAnswers>) => {
                if (ans.llmProvider === "claude") {
                    return [
                        {
                            name: `claude-sonnet-4-6  ${chalk.gray("— Best balance of intelligence and speed (Recommended)")}`,
                            value: "claude-sonnet-4-6",
                        },
                        {
                            name: `claude-haiku-4-5-20251001  ${chalk.gray("— Fastest and most cost-efficient")}`,
                            value: "claude-haiku-4-5-20251001",
                        },
                        {
                            name: `claude-opus-4-6  ${chalk.gray("— Most intelligent, best for complex reasoning")}`,
                            value: "claude-opus-4-6",
                        },
                    ];
                }
                return [
                    {
                        name: `gpt-4o-mini  ${chalk.gray("— Fast and cost-efficient (Recommended)")}`,
                        value: "gpt-4o-mini",
                    },
                    {
                        name: `gpt-4o  ${chalk.gray("— Most capable OpenAI model")}`,
                        value: "gpt-4o",
                    },
                ];
            },
        },
    ]);

    // ── Web3 Skills (if "skills" was checked in features) ────────────────────
    const wantsWeb3Skills = (answers.features as string[]).includes("skills");
    let web3Skills: string[] = [];

    if (wantsWeb3Skills) {
        console.log(chalk.bold("\n  🔗 Web3 Skills"));
        console.log(
            chalk.gray(
                "  ─────────────────────────────────────────────────────────────────────────────"
            )
        );
        console.log(
            chalk.gray(
                "  Web3 skills load domain knowledge into your agent from community skill docs."
            )
        );
        console.log(
            chalk.gray(
                "  These are NOT OASF taxonomy identifiers — they are practical knowledge bases"
            )
        );
        console.log(
            chalk.gray("  (ethSkills, EVM dApp skills) injected into your agent's context.")
        );
        console.log(
            chalk.gray(
                "  ─────────────────────────────────────────────────────────────────────────────\n"
            )
        );
        web3Skills = await promptNestedSkills(WEB3_SKILL_CATEGORIES, "Web3 Skills");
    }

    // ── OASF Official Skills (always shown at the end) ────────────────────────
    const oasfSkills = await promptOASFSkills();

    // Merge: web3 skills + OASF skills both go into skills[] for on-chain registration
    const allSkills = [...web3Skills, ...oasfSkills];

    // ── Directory resolution ──────────────────────────────────────────────────
    let projectDir = answers.projectDir.trim();
    const cwdBasename = path.basename(process.cwd());
    const alreadyInAgents = cwdBasename === "agents";
    const alreadyUnderAgents = projectDir.replace(/^\.\//, "").startsWith("agents/");
    if (
        projectDir !== "." &&
        !path.isAbsolute(projectDir) &&
        !alreadyUnderAgents &&
        !alreadyInAgents
    ) {
        projectDir = `agents/${projectDir}`;
    }

    const availableDir = getAvailableDir(projectDir);
    if (availableDir !== projectDir) {
        console.log(`\n📁 Directory "${projectDir}" exists, using "${availableDir}" instead`);
        projectDir = availableDir;
    }

    // Always auto-generate a new wallet
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const agentWallet = account.address;
    console.log("\n🔑 Generated new wallet:", agentWallet);

    // Strip "skills" from features — it was a trigger, not a protocol feature
    const cleanFeatures = answers.features.filter(
        (f): f is "a2a" | "mcp" | "x402" => f !== "skills"
    );

    return {
        ...answers,
        archetype: "custom",
        projectDir,
        agentWallet,
        generatedPrivateKey: privateKey,
        a2aStreaming: answers.a2aStreaming ?? false,
        features: cleanFeatures,
        llmProvider: answers.llmProvider,
        llmModel: answers.llmModel,
        skills: allSkills,
        web3Skills,
        domains: [],
    };
}
