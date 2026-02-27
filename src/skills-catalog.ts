/**
 * OASF Skills Catalog
 *
 * A curated subset of the Open Agent Specification Framework (OASF) taxonomy
 * relevant to Web3, DeFi, and blockchain-focused AI agents.
 *
 * Full taxonomy: https://schema.oasf.outshift.com/0.8.0
 */

export interface SkillOption {
    name: string;
    value: string;
}

export interface SkillCategory {
    name: string;
    skills: SkillOption[];
}

export const SKILL_CATEGORIES: SkillCategory[] = [
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
        name: "Technical Writing",
        skills: [
            { value: "technical_writing/documentation", name: "Documentation" },
            { value: "technical_writing/tutorial_creation", name: "Tutorial Creation" },
            { value: "technical_writing/smart_contract_documentation", name: "Smart Contract Docs" },
            { value: "technical_writing/api_documentation", name: "API Documentation" },
            { value: "technical_writing/whitepaper_writing", name: "Whitepaper Writing" },
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
        name: "NFT & Gaming",
        skills: [
            { value: "nft/valuation", name: "NFT Valuation" },
            { value: "nft/metadata_generation", name: "NFT Metadata Generation" },
            { value: "gaming/game_theory", name: "Game Theory & Tokenomics" },
            { value: "gaming/asset_trading", name: "In-game Asset Trading" },
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
        name: "Natural Language Processing",
        skills: [
            { value: "nlp/summarization", name: "Summarization" },
            { value: "nlp/sentiment_analysis", name: "Sentiment Analysis" },
            { value: "nlp/question_answering", name: "Question Answering" },
            { value: "nlp/translation", name: "Translation" },
        ],
    },
];

/** Flat list of all skills — useful for validation or display */
export const ALL_SKILLS: SkillOption[] = SKILL_CATEGORIES.flatMap((c) => c.skills);
