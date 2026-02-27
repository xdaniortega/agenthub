/**
 * Skills Catalog
 *
 * Two separate catalogs with distinct purposes:
 *
 * 1. OASF_OFFICIAL_CATEGORIES — Official OASF taxonomy skills for on-chain
 *    ERC-8004 registration. Use these to declare your agent's AI capabilities
 *    (language, vision, audio, reasoning). Selecting inaccurate skills affects
 *    your on-chain reputation score.
 *
 * 2. WEB3_SKILL_CATEGORIES — Practical web3 knowledge base skills that give
 *    your agent context about blockchain development, DeFi, smart contracts,
 *    and EVM ecosystems. These are loaded into your agent as context, not
 *    registered as OASF taxonomy identifiers.
 *
 * Full OASF taxonomy: https://schema.oasf.outshift.com/0.8.0
 *
 * The ETHSKILLS and ARBITRUM sections below are auto-generated.
 * Run `npm run sync:skills` to refresh them from their source repos.
 */

export interface SkillOption {
    name: string;
    value: string;
}

export interface SkillCategory {
    name: string;
    skills: SkillOption[];
}

// ── Official OASF AI Capability Taxonomy ────────────────────────────────────
// These are the standardised AI capability identifiers from the OASF spec.
// They classify WHAT kind of AI tasks your agent can perform.
// Registered on-chain via ERC-8004 — choose accurately, they affect reputation.

export const OASF_OFFICIAL_CATEGORIES: SkillCategory[] = [
    {
        name: "🗣️  Language",
        skills: [
            { value: "language/text-generation", name: "Text Generation" },
            { value: "language/text-completion", name: "Text Completion" },
            { value: "language/text-summarization", name: "Text Summarization" },
            { value: "language/text-translation", name: "Text Translation" },
        ],
    },
    {
        name: "👁️  Vision",
        skills: [
            { value: "vision/image-generation", name: "Image Generation" },
            { value: "vision/image-classification", name: "Image Classification" },
            { value: "vision/object-detection", name: "Object Detection" },
        ],
    },
    {
        name: "🔊  Audio",
        skills: [
            { value: "audio/speech-to-text", name: "Speech to Text" },
            { value: "audio/text-to-speech", name: "Text to Speech" },
        ],
    },
    {
        name: "🧠  Reasoning",
        skills: [
            { value: "reasoning/task-planning", name: "Task Planning" },
        ],
    },
];

// ── Web3 Knowledge Base Skills ───────────────────────────────────────────────
// Practical web3 skills loaded as context into your agent.
// Includes curated DeFi/smart-contract knowledge AND URL-based skill documents
// from community repos (ethSkills, EVM L2 dApp skills).
// These are separate from OASF AI taxonomy — they enrich the agent's domain
// knowledge, not its registered capability classification.

export const WEB3_SKILL_CATEGORIES: SkillCategory[] = [
    {
        name: "DeFi & Finance",
        skills: [
            { value: "defi/yield_analysis", name: "Yield Analysis" },
            { value: "defi/protocol_risk_assessment", name: "Protocol Risk Assessment" },
            { value: "defi/liquidity_analysis", name: "Liquidity Analysis" },
            { value: "defi/token_economics", name: "Token Economics" },
            { value: "defi/portfolio_management", name: "Portfolio Management" },
            { value: "defi/market_analysis", name: "Market Analysis" },
        ],
    },
    {
        name: "Smart Contracts",
        skills: [
            { value: "smart_contracts/auditing", name: "Smart Contract Auditing" },
            { value: "smart_contracts/development", name: "Smart Contract Development" },
            { value: "smart_contracts/testing", name: "Contract Testing" },
            { value: "smart_contracts/optimization", name: "Gas Optimization" },
            { value: "smart_contracts/formal_verification", name: "Formal Verification" },
        ],
    },
    {
        name: "Data & Analytics",
        skills: [
            { value: "data_analysis/on_chain_analytics", name: "On-chain Analytics" },
            { value: "data_analysis/market_data", name: "Market Data Analysis" },
            { value: "data_analysis/graph_protocol", name: "The Graph / Subgraph Queries" },
            { value: "data_analysis/reporting", name: "Reporting & Dashboards" },
        ],
    },
    {
        name: "Infrastructure & DevOps",
        skills: [
            { value: "infrastructure/node_operations", name: "Node Operations" },
            { value: "infrastructure/indexing", name: "Indexing & Caching" },
            { value: "infrastructure/monitoring", name: "On-chain Monitoring" },
            { value: "infrastructure/bridge_operations", name: "Bridge Operations" },
        ],
    },
    {
        name: "NFT & Gaming",
        skills: [
            { value: "nft/valuation", name: "NFT Valuation" },
            { value: "nft/metadata_generation", name: "NFT Metadata Generation" },
            { value: "gaming/game_theory", name: "Game Theory & Tokenomics" },
            { value: "gaming/asset_trading", name: "In-game Asset Trading" },
        ],
    },
    // BEGIN:ETHSKILLS
    {
        name: "Ethereum Dev (ethskills.com)",
        skills: [
        { value: "https://ethskills.com/addresses/SKILL.md", name: "Contract Addresses" },
        { value: "https://ethskills.com/building-blocks/SKILL.md", name: "DeFi Building Blocks" },
        { value: "https://ethskills.com/concepts/SKILL.md", name: "Core Concepts" },
        { value: "https://ethskills.com/contracts/SKILL.md", name: "Contracts" },
        { value: "https://ethskills.com/defi/SKILL.md", name: "DeFi Primitives" },
        { value: "https://ethskills.com/frontend-playbook/SKILL.md", name: "Frontend Playbook" },
        { value: "https://ethskills.com/frontend-ux/SKILL.md", name: "Frontend UX" },
        { value: "https://ethskills.com/gas/SKILL.md", name: "Gas & Costs" },
        { value: "https://ethskills.com/indexing/SKILL.md", name: "Indexing" },
        { value: "https://ethskills.com/l2s/SKILL.md", name: "Layer 2s" },
        { value: "https://ethskills.com/orchestration/SKILL.md", name: "Orchestration (SE2)" },
        { value: "https://ethskills.com/qa/SKILL.md", name: "QA Checklist" },
        { value: "https://ethskills.com/security/SKILL.md", name: "Security Patterns" },
        { value: "https://ethskills.com/ship/SKILL.md", name: "Ship (End-to-End)" },
        { value: "https://ethskills.com/standards/SKILL.md", name: "ERC Standards" },
        { value: "https://ethskills.com/testing/SKILL.md", name: "Testing" },
        { value: "https://ethskills.com/tools/SKILL.md", name: "Dev Tools" },
        { value: "https://ethskills.com/wallets/SKILL.md", name: "Wallets" },
        { value: "https://ethskills.com/why/SKILL.md", name: "Why Ethereum" },
        ],
    },
    // END:ETHSKILLS
    // BEGIN:ARBITRUM
    {
        name: "Arbitrum (arbitrum-dapp-skill)",
        skills: [
        { value: "https://raw.githubusercontent.com/hummusonrails/arbitrum-dapp-skill/main/SKILL.md", name: "Arbitrum dApp Development" },
        { value: "https://raw.githubusercontent.com/hummusonrails/arbitrum-dapp-skill/main/references/deployment.md", name: "Deployment" },
        { value: "https://raw.githubusercontent.com/hummusonrails/arbitrum-dapp-skill/main/references/frontend-integration.md", name: "Frontend Integration" },
        { value: "https://raw.githubusercontent.com/hummusonrails/arbitrum-dapp-skill/main/references/local-devnode.md", name: "Local Devnode" },
        { value: "https://raw.githubusercontent.com/hummusonrails/arbitrum-dapp-skill/main/references/solidity-contracts.md", name: "Solidity Contracts" },
        { value: "https://raw.githubusercontent.com/hummusonrails/arbitrum-dapp-skill/main/references/stylus-rust-contracts.md", name: "Stylus Rust Contracts" },
        { value: "https://raw.githubusercontent.com/hummusonrails/arbitrum-dapp-skill/main/references/testing.md", name: "Testing" },
        ],
    },
    // END:ARBITRUM
];

/** Backward-compat alias — prefer using WEB3_SKILL_CATEGORIES or OASF_OFFICIAL_CATEGORIES */
export const SKILL_CATEGORIES = WEB3_SKILL_CATEGORIES;

/** Flat list of all web3 skills — useful for validation or display */
export const ALL_SKILLS: SkillOption[] = WEB3_SKILL_CATEGORIES.flatMap((c) => c.skills);
