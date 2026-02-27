import type { Archetype } from "./index.js";

export const dataOracleArchetype: Archetype = {
    id: "data-oracle",
    name: "Data Oracle",
    emoji: "🔮",
    description: "On-chain data feeds, price oracles, analytics APIs",
    systemPrompt:
        "You are a data oracle agent specialized in sourcing, validating, and publishing on-chain data " +
        "on Arbitrum. You aggregate price feeds, on-chain metrics, and protocol analytics, " +
        "verify data integrity before publishing, and respond to queries from other agents. " +
        "Always cite your data sources and timestamps. Flag stale or suspicious data immediately.",
    skills: [
        "data_analysis/on_chain_analytics",
        "data_analysis/market_data",
        "data_analysis/graph_protocol",
        "data_analysis/reporting",
    ],
    // MCP exposes oracle data as tools consumable by Claude Desktop / Cursor
    defaultFeatures: ["a2a", "mcp"],
};
