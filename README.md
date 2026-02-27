# 🤖 AgentHub

> Create, import, and orchestrate ERC-8004 AI agents with on-chain identity, reputation, and A2A communication.

```bash
npx agenthub
```

## What is AgentHub?

AgentHub is a CLI toolkit for working with [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) AI agents on EVM chains. The ERC-8004 standard gives AI agents on-chain identity (NFT), a reputation registry, and a discoverable endpoint via the A2A protocol.

AgentHub gives you three commands from a single interactive menu:

| Command | What it does |
|---|---|
| 🛠️ **Create** | Scaffold a new ERC-8004 agent project from an archetype |
| 📦 **Import** | Add ERC-8004 compliance to an existing project |
| 💬 **Communicate** | Open an interactive A2A chat session with any agent |

---

## Quick Start

```bash
# Run interactively (no install required)
npx agenthub

# Or install globally
npm install -g agenthub
agenthub
```

---

## Commands

### 🛠️ Create

Generates a complete ERC-8004 agent project:

```
agents/
└── my-agent/
    ├── src/
    │   ├── register.ts      # On-chain registration script
    │   ├── agent.ts         # LLM logic (OpenAI GPT-4o-mini)
    │   ├── a2a-server.ts    # A2A JSON-RPC 2.0 server
    │   ├── a2a-client.ts    # A2A test client
    │   └── mcp-server.ts    # MCP server (if selected)
    ├── .well-known/
    │   └── agent-card.json  # A2A discovery card
    ├── .env                 # Keys and config
    └── package.json
```

**Archetypes** — pre-configured agent personalities with matching OASF skills:

| Archetype | Skills | Default Features |
|---|---|---|
| 🏦 **DeFi Strategist** | Yield analysis, protocol risk, liquidity, tokenomics | A2A |
| 📝 **Technical Writer** | Documentation, tutorials, smart contract docs, API docs | A2A + MCP |
| ⚙️ **Custom** | Pick from the OASF skills catalog | A2A |

**Features you can mix and match:**

- **A2A** — JSON-RPC 2.0 agent-to-agent server + discovery card
- **MCP** — Model Context Protocol server for Claude Desktop / Cursor
- **x402** — USDC micropayment middleware (Base and Polygon only)

**Chains supported:**

| Chain | Type | ERC-8004 Registry | x402 |
|---|---|---|---|
| Arbitrum One | Mainnet | `0x8004A169...` | — |
| Arbitrum Sepolia | Testnet | `0x8004A818...` | — |
| Ethereum Mainnet | Mainnet | `0x8004A169...` | — |
| Ethereum Sepolia | Testnet | `0x8004A818...` | — |
| Base | Mainnet | — | ✅ |
| Polygon | Mainnet | — | ✅ |
| Base Sepolia | Testnet | — | ✅ |
| Polygon Amoy | Testnet | — | ✅ |

---

### 📦 Import

Adds ERC-8004 files to any existing Node.js project without touching your existing code:

- Writes `src/register.ts`, `.env.8004.example`, optional A2A/MCP files
- **Merges** ERC-8004 scripts and dependencies into your existing `package.json` (never overwrites existing keys)
- Prompts before overwriting any file that already exists
- Registers the agent in the local `.8004-agents.json` registry

---

### 💬 Communicate

Opens an interactive A2A chat session with any agent:

```
? Connect to:
  ❯ Choose from local registry
    Enter an agent endpoint URL

Agent discovered ──────────────────────────────────
 Name:   my-defi-agent
 Desc:   DeFi strategy and yield analysis
 Skills: Yield Analysis, Protocol Risk Assessment

You: What are the best yield opportunities on Arbitrum right now?
Agent: [response from the agent...]

You: /new    ← reset conversation context
You: /exit   ← quit
```

Commands available during chat: `/exit`, `/new` (reset context), `/context` (show context ID), `/help`.

---

## Skills Catalog

The Custom archetype lets you pick from a curated OASF skills catalog:

- **DeFi & Finance** — yield analysis, protocol risk, liquidity, market analysis
- **Smart Contracts** — auditing, development, testing, gas optimization
- **Technical Writing** — documentation, tutorials, API docs, whitepapers
- **Data & Analytics** — on-chain analytics, The Graph, reporting
- **NFT & Gaming** — valuation, metadata generation, game theory
- **Infrastructure & DevOps** — node operations, indexing, monitoring
- **NLP** — summarization, sentiment analysis, Q&A, translation
- **Ethereum Dev** — [ethskills.com](https://ethskills.com/) — Gas, Security, L2s, Standards, and more
- **Arbitrum** — [arbitrum-dapp-skill](https://github.com/hummusonrails/arbitrum-dapp-skill) — Stylus/Solidity, deployment, testing

To refresh the ethskills and Arbitrum sections from their source repos:

```bash
npm run sync:skills
```

---

## After Creating an Agent

```bash
cd agents/my-agent

# 1. Fill in .env
#    PRIVATE_KEY=   (your deployer wallet key)
#    PINATA_JWT=    (get a free key at pinata.cloud)
#    OPENAI_API_KEY=

# 2. Install dependencies
npm install

# 3. Register on-chain
npm run register

# 4. Start the A2A server
npm run start:a2a

# 5. Test locally
curl http://localhost:3000/.well-known/agent-card.json
```

---

## Development

```bash
# Clone
git clone https://github.com/xdaniortega/agenthub
cd agenthub
npm install

# Run in dev mode
npm run dev

# Type check
npx tsc --noEmit

# Tests (155 tests across 7 chain × feature combinations)
npm test

# Sync skills catalog from upstream repos
npm run sync:skills
```

---

## Resources

- [ERC-8004 Standard](https://eips.ethereum.org/EIPS/eip-8004)
- [8004scan Explorer](https://www.8004scan.io/)
- [Agent0 SDK](https://github.com/blockbyvlog/agent0-sdk)
- [A2A Protocol](https://a2a-protocol.org/)
- [OASF Skill Taxonomy](https://schema.oasf.outshift.com/0.8.0)
- [ethskills.com](https://ethskills.com/)

## Acknowledgements

Inspired by [create-8004-agent](https://github.com/Eversmile12/create-8004-agent) — the original ERC-8004 scaffolding tool that laid the groundwork for this project.
