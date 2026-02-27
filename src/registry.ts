/**
 * Local registry of agents created with agenthub.
 * Stored at repo root as .8004-agents.json.
 * Updated when generating a new agent and when running register from an agent project.
 */

import fs from "fs/promises";
import path from "path";

export interface RegistryAgent {
    projectDir: string;
    name: string;
    agentType: string;
    agentId: string | null;
    chainId: number | null;
}

export interface RegistryFile {
    agents: RegistryAgent[];
}

const REGISTRY_FILENAME = ".8004-agents.json";
const AGENT_META_FILENAME = ".8004.json";

/** Path to .8004.json inside an agent project (relative to agent root) */
export const agentMetaPath = () => AGENT_META_FILENAME;

/**
 * Load and parse registry file. Returns null if file missing or invalid.
 */
async function loadRegistryFile(regPath: string): Promise<RegistryFile | null> {
    try {
        const raw = await fs.readFile(regPath, "utf-8");
        const data = JSON.parse(raw) as RegistryFile;
        return Array.isArray(data.agents) ? data : { agents: [] };
    } catch {
        return null;
    }
}

/**
 * Find .8004-agents.json by walking up from cwd. Returns directory containing it, or null.
 */
export async function findRegistryRoot(fromDir: string = process.cwd()): Promise<string | null> {
    let dir = path.resolve(fromDir);
    const root = path.parse(dir).root;
    while (dir !== root) {
        const candidate = path.join(dir, REGISTRY_FILENAME);
        try {
            await fs.access(candidate);
            return dir;
        } catch {
            dir = path.dirname(dir);
        }
    }
    return null;
}

/**
 * Get full path to registry file in repo root. Returns null if not found.
 */
export async function getRegistryPath(fromDir: string = process.cwd()): Promise<string | null> {
    const root = await findRegistryRoot(fromDir);
    return root ? path.join(root, REGISTRY_FILENAME) : null;
}

/**
 * Read registry from repo root (searches upward from fromDir).
 */
export async function readRegistry(fromDir: string = process.cwd()): Promise<RegistryFile | null> {
    const regPath = await getRegistryPath(fromDir);
    if (!regPath) return null;
    return loadRegistryFile(regPath);
}

/**
 * Write registry to the given path (caller must ensure directory exists).
 */
export async function writeRegistry(regPath: string, data: RegistryFile): Promise<void> {
    await fs.writeFile(regPath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Add or update an agent entry by projectDir. Used when generating a new agent.
 */
export async function upsertAgent(
    repoRoot: string,
    entry: Omit<RegistryAgent, "agentId" | "chainId"> & { agentId?: string | null; chainId?: number | null }
): Promise<void> {
    const regPath = path.join(repoRoot, REGISTRY_FILENAME);
    const data = (await loadRegistryFile(regPath)) ?? { agents: [] };
    const existing = data.agents.find((a) => a.projectDir === entry.projectDir);
    const newAgent: RegistryAgent = {
        projectDir: entry.projectDir,
        name: entry.name,
        agentType: entry.agentType,
        agentId: entry.agentId ?? existing?.agentId ?? null,
        chainId: entry.chainId ?? existing?.chainId ?? null,
    };
    if (existing) {
        data.agents = data.agents.map((a) => (a.projectDir === entry.projectDir ? newAgent : a));
    } else {
        data.agents.push(newAgent);
    }
    await writeRegistry(regPath, data);
}

/**
 * Update agentId and chainId for an entry identified by projectDir. Used by register script.
 */
export async function updateAgentAfterRegister(
    repoRoot: string,
    projectDir: string,
    agentId: string,
    chainId: number
): Promise<void> {
    const regPath = path.join(repoRoot, REGISTRY_FILENAME);
    const data = await loadRegistryFile(regPath);
    if (!data) return;
    let found = false;
    const updated = data.agents.map((a) => {
        if (a.projectDir !== projectDir) return a;
        found = true;
        return { ...a, agentId, chainId };
    });
    if (found) await writeRegistry(regPath, { ...data, agents: updated });
}

/**
 * Deployed agents only (have agentId).
 */
export function getDeployedAgents(registry: RegistryFile): RegistryAgent[] {
    return registry.agents.filter((a) => a.agentId != null && a.chainId != null);
}
