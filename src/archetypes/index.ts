/**
 * Agent Archetypes — predefined agent personalities and capability sets.
 *
 * Each archetype defines OASF skills/domains, a system prompt, MCP tools,
 * extra npm dependencies, required features, and optional extra files to generate.
 */

import type { WizardAnswers } from "../wizard.js";

export interface MCPToolDefinition {
    name: string;
    description: string;
    inputSchema: object;
    /** TypeScript source for the tool's case body inside handleToolCall switch */
    implementation: string;
}

export interface AgentArchetype {
    id: string;
    name: string;
    emoji: string;
    description: string;

    // OASF classification
    skills: string[];
    domains: string[];

    // LLM personality
    systemPrompt: string;

    // MCP tools specific to this archetype
    mcpTools: MCPToolDefinition[];

    // Extra npm packages to inject into package.json
    extraDependencies: Record<string, string>;

    // Features that are pre-selected and locked for this archetype
    requiredFeatures: ("a2a" | "mcp" | "x402")[];

    // Extra files to generate in the project
    extraTemplates: {
        path: string;
        generator: (answers: WizardAnswers) => string;
    }[];
}

import { researchArchetype } from "./research.js";
import { codeArchetype } from "./code-agent.js";
import { documentArchetype } from "./document.js";
import { orchestratorArchetype } from "./orchestrator.js";

const customArchetype: AgentArchetype = {
    id: "custom",
    name: "Custom Agent",
    emoji: "🛠️",
    description: "blank agent, you define everything",
    skills: [],
    domains: [],
    systemPrompt: "You are a helpful AI assistant registered on the ERC-8004 protocol. Be concise and helpful.",
    mcpTools: [],
    extraDependencies: {},
    requiredFeatures: [],
    extraTemplates: [],
};

export const ARCHETYPES: Record<string, AgentArchetype> = {
    research: researchArchetype,
    code: codeArchetype,
    document: documentArchetype,
    orchestrator: orchestratorArchetype,
    custom: customArchetype,
};
