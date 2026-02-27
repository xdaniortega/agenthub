/**
 * Communicate command
 *
 * Starts an interactive A2A chat session with any ERC-8004 agent.
 * Supports:
 *   - Picking from the local .8004-agents.json registry
 *   - Connecting to any agent by URL
 *   - Multi-turn conversations (contextId preserved across messages)
 *   - Streaming detection and helpful 402 error messaging
 */

import chalk from "chalk";
import inquirer from "inquirer";
import readline from "readline";
import { readRegistry } from "../registry.js";

// ─── A2A protocol types ───────────────────────────────────────────────────────

interface AgentCard {
    name: string;
    description: string;
    url: string;
    version: string;
    capabilities?: {
        streaming?: boolean;
    };
    skills?: Array<{ id: string; name: string; description?: string }>;
    authentication?: { schemes: string[] } | null;
}

interface A2AMessage {
    role: "user" | "agent";
    parts: Array<{ type: "text"; text: string }>;
}

interface Task {
    id: string;
    contextId: string;
    status: "submitted" | "working" | "input-required" | "completed" | "failed" | "canceled";
    messages: A2AMessage[];
    artifacts: Array<{ name?: string; parts: Array<{ type: "text"; text: string }> }>;
}

interface JsonRpcResponse {
    jsonrpc: "2.0";
    result?: Task;
    error?: { code: number; message: string };
    id: number;
}

// ─── A2A client ───────────────────────────────────────────────────────────────

class A2AClient {
    private requestId = 0;

    constructor(private readonly baseUrl: string) {}

    async discover(): Promise<AgentCard> {
        const url = `${this.baseUrl}/.well-known/agent-card.json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`Agent card fetch failed: HTTP ${res.status} — ${url}`);
        return res.json() as Promise<AgentCard>;
    }

    async send(text: string, contextId?: string): Promise<Task> {
        const payload = {
            jsonrpc: "2.0",
            method: "message/send",
            params: {
                message: {
                    role: "user",
                    parts: [{ type: "text", text }],
                },
                configuration: {
                    ...(contextId && { contextId }),
                    streaming: false,
                },
            },
            id: ++this.requestId,
        };

        const res = await fetch(`${this.baseUrl}/a2a`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30_000),
        });

        if (res.status === 402) {
            throw new PaymentRequiredError(
                `This agent requires payment (x402). ` +
                `Implement payment headers in your client or use an x402-aware agent client.`
            );
        }
        if (!res.ok) throw new Error(`A2A request failed: HTTP ${res.status}`);

        const rpc = (await res.json()) as JsonRpcResponse;
        if (rpc.error) throw new Error(`A2A error ${rpc.error.code}: ${rpc.error.message}`);
        if (!rpc.result) throw new Error("Empty A2A response");
        return rpc.result;
    }
}

class PaymentRequiredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PaymentRequiredError";
    }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function extractText(task: Task): string {
    // Prefer artifacts (final output), fall back to last agent message
    for (const artifact of task.artifacts) {
        const text = artifact.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("");
        if (text) return text;
    }
    const agentMessages = task.messages.filter((m) => m.role === "agent");
    if (agentMessages.length) {
        return agentMessages
            .at(-1)!
            .parts.filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("");
    }
    return `[Task ${task.status} — no text content]`;
}

function normalizeUrl(raw: string): string {
    let url = raw.trim().replace(/\/+$/, "");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "http://" + url;
    }
    return url;
}

function printAgentCard(card: AgentCard): void {
    console.log(chalk.bold("\n┌─ Agent discovered ─────────────────────────────────┐"));
    console.log(`│ ${chalk.cyan("Name:")}   ${card.name}`);
    console.log(`│ ${chalk.cyan("Desc:")}   ${card.description ?? "(none)"}`);
    if (card.skills?.length) {
        console.log(`│ ${chalk.cyan("Skills:")} ${card.skills.map((s) => s.name).join(", ")}`);
    }
    if (card.capabilities?.streaming) {
        console.log(`│ ${chalk.gray("⚡ Streaming supported (this client uses non-streaming)")}`);
    }
    if (card.authentication?.schemes?.length) {
        console.log(`│ ${chalk.yellow("🔒 Auth:")} ${card.authentication.schemes.join(", ")}`);
    }
    console.log(chalk.bold("└────────────────────────────────────────────────────┘\n"));
}

// ─── interactive chat loop ────────────────────────────────────────────────────

async function chatLoop(client: A2AClient, agentName: string): Promise<void> {
    let contextId: string | undefined;

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
    });

    console.log(chalk.bold(`\n💬 Chatting with ${chalk.cyan(agentName)}`));
    console.log(chalk.gray("  Type your message and press Enter. Use Ctrl+C or type /exit to quit.\n"));

    const ask = (): Promise<string> =>
        new Promise((resolve) => rl.question(chalk.green("You: "), resolve));

    // Handle Ctrl+C gracefully
    rl.on("SIGINT", () => {
        console.log(chalk.gray("\n\n👋 Session ended."));
        rl.close();
        process.exit(0);
    });

    for (;;) {
        const input = (await ask()).trim();

        if (!input) continue;
        if (input === "/exit" || input === "/quit") {
            console.log(chalk.gray("\n👋 Session ended."));
            break;
        }

        // Special commands
        if (input === "/new") {
            contextId = undefined;
            console.log(chalk.gray("  🔄 Started a new conversation context.\n"));
            continue;
        }
        if (input === "/context") {
            console.log(chalk.gray(`  Context ID: ${contextId ?? "(none — will be set on first message)"}\n`));
            continue;
        }
        if (input === "/help") {
            console.log(chalk.gray("  Commands: /exit  /new (reset context)  /context (show context ID)\n"));
            continue;
        }

        process.stdout.write(chalk.gray("  Agent: "));

        try {
            const task = await client.send(input, contextId);
            contextId = task.contextId;
            const reply = extractText(task);
            process.stdout.write(chalk.white(reply) + "\n\n");
        } catch (err) {
            if (err instanceof PaymentRequiredError) {
                console.log(chalk.yellow(`\n  ⚠️  ${err.message}\n`));
            } else {
                const msg = err instanceof Error ? err.message : String(err);
                console.log(chalk.red(`\n  ❌ ${msg}\n`));
            }
        }
    }

    rl.close();
}

// ─── main ─────────────────────────────────────────────────────────────────────

export async function runCommunicate(): Promise<void> {
    console.log(chalk.bold("\n💬 Communicate — Connect to an ERC-8004 agent via A2A\n"));

    // Load local registry agents that have been deployed
    const registry = await readRegistry();
    const knownAgents = (registry?.agents ?? []).filter((a) => a.agentId != null);

    type Source = "registry" | "url";
    const sourceChoices: Array<{ name: string; value: Source }> = [
        { name: "Enter an agent endpoint URL", value: "url" },
    ];
    if (knownAgents.length) {
        sourceChoices.unshift({ name: "Choose from local registry", value: "registry" });
    }

    const { source } = await inquirer.prompt<{ source: Source }>([
        {
            type: "list",
            name: "source",
            message: "Connect to:",
            choices: sourceChoices,
        },
    ]);

    let endpointUrl: string;
    let agentLabel: string;

    if (source === "registry") {
        const { chosen } = await inquirer.prompt<{ chosen: string }>([
            {
                type: "list",
                name: "chosen",
                message: "Select agent:",
                choices: knownAgents.map((a) => ({
                    name: `${a.name} (${a.agentId})`,
                    value: a.projectDir,
                })),
            },
        ]);

        const agent = knownAgents.find((a) => a.projectDir === chosen)!;
        agentLabel = agent.name;

        const { url } = await inquirer.prompt<{ url: string }>([
            {
                type: "input",
                name: "url",
                message: `A2A endpoint URL for "${agent.name}":`,
                default: "http://localhost:3000",
            },
        ]);
        endpointUrl = normalizeUrl(url);
    } else {
        const { url } = await inquirer.prompt<{ url: string }>([
            {
                type: "input",
                name: "url",
                message: "Agent A2A endpoint URL:",
                default: "http://localhost:3000",
                validate: (v: string) => (v.trim() ? true : "URL is required"),
            },
        ]);
        endpointUrl = normalizeUrl(url);
        agentLabel = endpointUrl;
    }

    const client = new A2AClient(endpointUrl);

    // Discover agent card
    console.log(chalk.gray(`\n  🔍 Fetching agent card from ${endpointUrl}...`));
    try {
        const card = await client.discover();
        agentLabel = card.name ?? agentLabel;
        printAgentCard(card);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.yellow(`\n  ⚠️  Could not fetch agent card: ${msg}`));
        console.log(chalk.gray("  Continuing without discovery — agent may still respond to messages.\n"));
    }

    await chatLoop(client, agentLabel);
}
