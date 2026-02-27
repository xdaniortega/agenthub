<div align="center">

# 🤖 AgentHub

**The CLI toolkit for ERC-8004 AI agents — create, import, and orchestrate on-chain agents in minutes.**

<br>

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/badge/version-1.0.0-green.svg)](package.json)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org)
[![ERC-8004](https://img.shields.io/badge/ERC-8004-purple.svg)](https://eips.ethereum.org/EIPS/eip-8004)

</div>

<br>

<div align="center">
  <img src="docs/demo.gif" alt="AgentHub CLI demo" width="600"/>
</div>

<br>

## 📋 Table of Contents

- [✨ Features](#-features)
- [⚙️ Setup](#️-setup)
- [🚀 Quick Start](#-quick-start)
- [📖 Usage](#-usage)
- [🧠 Skills Pipeline](#-skills-pipeline)
- [🏗️ Architecture](#️-architecture)
- [🧰 Tech Stack](#-tech-stack)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

- ⚡ **Interactive Init** — go from zero to a running Arbitrum agent in under 60 seconds
- 🏗️ **Full Wizard** — multi-chain support, A2A/MCP/x402 feature selection, OASF skills
- 📦 **Import** — add ERC-8004 compliance to any existing project without overwriting your files
- 💬 **Communicate** — built-in A2A chat client to talk to any deployed agent interactively
- 🔗 **On-chain Identity** — auto-generates wallets and registers agents on the ERC-8004 registry
- 🛠️ **OASF Skills Catalog** — curated skill taxonomy synced from the community (`npm run sync:skills`)
- 🌐 **Multi-chain** — Arbitrum, Base, Ethereum, Polygon (mainnets + testnets)
- 🔄 **Extensible Archetypes** — add new agent types in 3 files without touching core generator logic

---

## ⚙️ Setup

**Prerequisites:** Node.js ≥ 18, npm

### 1. Clone and install

```bash
git clone https://github.com/xdaniortega/agenthub.git
cd agenthub
npm install
```

### 2. Configure your master .env

AgentHub uses a root-level `.env` as the **master configuration** shared across all agents you create. Generated agents load credentials from this file at registration time.

```bash
cp .env.example .env
```

Then open `.env` and fill in the three required variables:

| Variable | Required | Description |
|---|---|---|
| `PRIVATE_KEY` | ✅ | Master wallet private key — pays gas for agent registrations |
| `PINATA_JWT` | ✅ | [Pinata](https://pinata.cloud) JWT — stores agent metadata on IPFS |
| `OPENAI_API_KEY` | ✅ | [OpenAI](https://platform.openai.com/api-keys) key — powers the LLM inside generated agents |
| `RPC_URL` | optional | Custom RPC endpoint (falls back to public endpoints if unset) |

> AgentHub will check for these variables and block agent creation with a clear error if any are missing.

---

## 🚀 Quick Start

```bash
npx agenthub
```

Select **⚡ Agent Examples**, name your agent, confirm — dependencies installed, wallet generated, next steps printed.

---

## 📖 Usage

### ⚡ Agent Examples — Opinionated scaffold

```bash
npx agenthub   # → select ⚡ Agent Examples
```

3 prompts: **name → directory → confirm.** Scaffolds an Arbitrum dApp Developer agent with A2A enabled.

### 🛠️ Create — Full wizard

```bash
npx agenthub   # → select 🛠️ Create
```

Full control: chain, features (A2A / MCP / x402), trust models, and custom OASF skills.

### 📦 Import — Add ERC-8004 to an existing project

```bash
npx agenthub   # → select 📦 Import
```

Points to any existing project directory. Merges `register`, `start:a2a`, and `start:mcp` scripts into your `package.json` without overwriting existing keys. Existing files prompt before overwriting.

### 💬 Communicate — Chat with a deployed agent

```bash
npx agenthub   # → select 💬 Communicate
```

Connects to any A2A-compatible agent by URL or from the local registry. Multi-turn conversations with `contextId` preserved. Slash commands: `/exit`, `/new`, `/context`, `/help`.

### After generation

```bash
cd agents/my-agent
npm run register        # Mint agent identity on-chain
npm run start:a2a       # Start the A2A server (port 3000)
npm run start:mcp       # Start the MCP server (if enabled)
npm run feedback        # Submit on-chain feedback for another agent
```

---

## 🧠 Skills Pipeline

This section explains exactly how skills travel from the UI selection to the generated agent. Each step references the actual source file responsible.

### Overview

```
User selects skills in CLI
        ↓
  skills-catalog.ts     ← defines selectable skills as OASF taxonomy values
        ↓
    wizard.ts           ← collects answers.skills[]
        ↓
   generator.ts         ← applies archetype skills, writes files
        ↓
 templates/core/base.ts ← injects agent.addSkill() into register.ts
        ↓
  Generated register.ts ← npm run register → on-chain via ERC-8004 registry
```

### Step 1 — Skill definitions (`src/skills-catalog.ts`)

Skills are defined as `{name, value}` pairs grouped in `SKILL_CATEGORIES`. The `value` field is either:
- An **OASF taxonomy path** (e.g. `"defi/yield_analysis"`) — follows the [Open Agent Specification Framework](https://schema.oasf.outshift.com/0.8.0)
- A **URL** pointing to a skill specification document (ethskills.com and arbitrum-dapp-skill entries)

Run `npm run sync:skills` to refresh the ethskills and Arbitrum sections from their upstream GitHub repos.

### Step 2 — Selection (`src/wizard.ts`)

In the **Create** flow, the user picks skills from a `checkbox` prompt built from `SKILL_CATEGORIES`. The selections are stored as `answers.skills: string[]` (the `value` strings, not the display names).

### Step 3 — Archetype resolution (`src/generator.ts`)

```typescript
// If an archetype is active (e.g. trading-agent), its pre-defined skills
// override the user's manual selection:
const archetype = ARCHETYPES[answers.archetype ?? "custom"];
if (archetype && archetype.id !== "custom") {
    answers.skills = archetype.skills;  // ← from src/archetypes/*.ts
}
```

Each archetype file (e.g. `src/archetypes/trading-agent.ts`) declares a `skills[]` array aligned with its domain. For the **custom** archetype (Create flow), the user's own selection is kept as-is.

### Step 4 — Code generation (`src/generator.ts` → `ARCHETYPE_EXTRAS`)

Skills influence two independent outputs:

**a) On-chain registration metadata** — via `generateRegisterScript()` in `src/templates/core/base.ts`:

```typescript
// Each skill value becomes an agent.addSkill() call in the generated register.ts
answers.skills.map((s) => `  agent.addSkill('${s}');`).join("\n")
```

When the user later runs `npm run register` inside their agent project, these calls submit the skills to the ERC-8004 on-chain registry, making the agent discoverable by capability.

**b) Implementation scaffold files** — via `ARCHETYPE_EXTRAS` in `src/generator.ts`:

Certain archetypes generate dedicated implementation files beyond the base scaffold:

| Archetype | Skills | Generated file | What it does |
|---|---|---|---|
| `trading-agent` | `defi/yield_analysis`, `defi/market_analysis`, `defi/protocol_risk_assessment`, `defi/liquidity_analysis` | `src/trading-engine.ts` | Chainlink price feeds (AggregatorV3), Kelly position sizing, slippage estimation |
| `data-oracle` | `data_analysis/on_chain_analytics`, `data_analysis/market_data`, `data_analysis/graph_protocol` | `src/data-feed.ts` + `src/tools.ts` | Block/gas metrics, ERC-20 reads, The Graph subgraph queries, MCP oracle tools |
| `task-automation` | `infrastructure/monitoring`, `infrastructure/indexing` | `src/task-runner.ts` | In-memory task queue, `viem.watchEvent` for on-chain event watching |

**c) LLM system prompt** — via `generateAgentTs()` in `src/templates/core/base.ts`:

The archetype's `systemPrompt` string (defined in `src/archetypes/*.ts`) is embedded directly into the generated `src/agent.ts`. It describes the agent's domain expertise, aligned with the registered skills.

### Step 5 — On-chain registration (generated `src/register.ts`)

When the developer runs `npm run register` inside their generated project:

1. The script loads credentials from `../../.env` (your master file), then local `.env`
2. Initializes `@blockbyvlog/agent0-sdk` with the chain config
3. Calls `agent.addSkill(value)` for each selected skill
4. Uploads metadata to IPFS via Pinata
5. Mints the ERC-8004 identity NFT on-chain
6. The agent is now discoverable by other agents and tools via its registered skills

---

## 🏗️ Architecture

```
📦 agenthub
├── 📂 src/
│   ├── 📂 archetypes/        # Agent archetype definitions (skills, system prompt, features)
│   ├── 📂 commands/          # CLI commands: init, communicate, import-agent, validate-env
│   ├── 📂 templates/
│   │   ├── 📂 core/          # base.ts — package.json, .env, register.ts, agent.ts generators
│   │   ├── 📂 protocols/     # a2a.ts, mcp.ts — protocol scaffold generators
│   │   └── 📂 arbitrum/      # trading-engine.ts, data-feed.ts, task-runner.ts
│   ├── 📄 config.ts          # Chain configs + registry contract addresses
│   ├── 📄 generator.ts       # Core project scaffolding logic + ARCHETYPE_EXTRAS map
│   ├── 📄 menu.ts            # Main CLI menu
│   ├── 📄 registry.ts        # Local .8004-agents.json read/write
│   ├── 📄 skills-catalog.ts  # OASF skill taxonomy (sync'd from ethskills + arbitrum-dapp-skill)
│   └── 📄 wizard.ts          # Full create wizard prompts
├── 📂 scripts/
│   └── 📄 sync-skills.ts     # GitHub API sync for community skill repos
├── 📂 tests/                 # Vitest test suite
├── 📄 .env.example           # Master env template — copy to .env before use
├── 📄 package.json
└── 📄 .8004-agents.json      # Local agent registry (auto-managed)
```

**Extending with a new archetype** (3 steps):
1. `src/archetypes/my-agent.ts` — implement the `Archetype` interface
2. `src/templates/arbitrum/my-agent.ts` — scaffold template generator
3. Register in `src/archetypes/index.ts` and add to `ARCHETYPE_EXTRAS` in `src/generator.ts`

---

## 🧰 Tech Stack

| Technology | Purpose |
|---|---|
| [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | On-chain AI agent identity & reputation standard |
| [@blockbyvlog/agent0-sdk](https://github.com/blockbyvlog/agent0-sdk) | On-chain registration, feedback, reputation |
| [viem](https://viem.sh) | EVM interactions, wallet generation, event watching |
| [A2A Protocol](https://github.com/google-a2a/A2A) | Agent-to-agent communication (JSON-RPC 2.0 + SSE) |
| [MCP SDK](https://modelcontextprotocol.io) | Model Context Protocol server/tools |
| [x402](https://x402.org) | USDC micropayment middleware (Base, Polygon) |
| [Inquirer.js](https://github.com/SBoudrias/Inquirer.js) | Interactive CLI prompts |
| [Chalk](https://github.com/chalk/chalk) + [Ora](https://github.com/sindresorhus/ora) | Terminal styling and spinners |
| [Vitest](https://vitest.dev) | Test runner |
| TypeScript ESM | NodeNext module resolution |

**Supported chains:** Arbitrum One, Arbitrum Sepolia, Ethereum, Base, Polygon (+ testnets)

---

## 🤝 Contributing

```bash
git clone https://github.com/xdaniortega/agenthub.git
cd agenthub
npm install
cp .env.example .env   # fill in your credentials
npm run dev            # Run CLI in dev mode (tsx, no build needed)
npm test               # Run test suite
npm run sync:skills    # Refresh OASF skills from community repos
```

Open issues and PRs on [GitHub](https://github.com/xdaniortega/agenthub/issues). Please keep commits to one-line conventional format (`feat:`, `fix:`, `refactor:`).

---

## 📄 License

Apache 2.0 — see [LICENSE](LICENSE).

---

<div align="center">
  Built with ❤️ by <a href="https://github.com/xdaniortega">Daniel Ortega</a>
  <br><br>
  <a href="https://eips.ethereum.org/EIPS/eip-8004">ERC-8004 Spec</a> ·
  <a href="https://github.com/xdaniortega/agenthub/issues">Issues</a> ·
  <a href="https://github.com/xdaniortega/agenthub/pulls">PRs</a>
</div>
