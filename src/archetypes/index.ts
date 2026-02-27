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
    "defi-strategist": defiStrategistArchetype,
    "technical-writer": technicalWriterArchetype,
    custom: customArchetype,
};
