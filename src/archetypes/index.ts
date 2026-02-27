export interface Archetype {
    id: string;
    name: string;
    emoji: string;
    description: string;
    systemPrompt: string;
    skills: string[];
    defaultFeatures: ("a2a" | "mcp" | "x402")[];
}

import { defiStrategistArchetype } from "./defi-strategist.js";
import { technicalWriterArchetype } from "./technical-writer.js";
import { tradingAgentArchetype } from "./trading-agent.js";
import { dataOracleArchetype } from "./data-oracle.js";
import { taskAutomationArchetype } from "./task-automation.js";

const customArchetype: Archetype = {
    id: "custom",
    name: "Custom",
    emoji: "⚙️",
    description: "Build from scratch with custom skills",
    systemPrompt: "You are a helpful AI assistant registered on the ERC-8004 protocol. Be concise and helpful.",
    skills: [],
    defaultFeatures: ["a2a"],
};

export const ARCHETYPES: Record<string, Archetype> = {
    // ── Arbitrum-native agent types ──────────────────────────────────────────
    // These are the primary archetypes for the Arbitrum Agent Kit.
    // To add a new agent type:
    //   1. Create src/archetypes/my-agent.ts implementing the Archetype interface
    //   2. Add a template generator in src/templates/arbitrum/my-agent.ts
    //   3. Register it below and in ARCHETYPE_EXTRAS in src/generator.ts
    "trading-agent": tradingAgentArchetype,
    "data-oracle": dataOracleArchetype,
    "task-automation": taskAutomationArchetype,
    // ── General-purpose archetypes ───────────────────────────────────────────
    "defi-strategist": defiStrategistArchetype,
    "technical-writer": technicalWriterArchetype,
    custom: customArchetype,
};
