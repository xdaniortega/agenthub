import type { Archetype } from "./index.js";

export const technicalWriterArchetype: Archetype = {
    id: "technical-writer",
    name: "Technical Writer",
    emoji: "📝",
    description: "Web3 docs, tutorials, smart contract documentation",
    systemPrompt:
        "You are a technical writer agent specialized in Web3 documentation, tutorials, smart contract documentation, and protocol specifications. You produce clear, accurate, developer-friendly content for blockchain projects.",
    skills: [
        "technical_writing/documentation",
        "technical_writing/tutorial_creation",
        "technical_writing/smart_contract_documentation",
        "technical_writing/api_documentation",
    ],
    defaultFeatures: ["a2a", "mcp"],
};
