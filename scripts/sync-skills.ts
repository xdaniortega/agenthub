#!/usr/bin/env tsx
/**
 * Sync skills catalog from external GitHub repos.
 *
 * Sources:
 *   - https://github.com/austintgriffith/ethskills
 *   - https://github.com/hummusonrails/arbitrum-dapp-skill
 *
 * Usage: npm run sync:skills
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, "../src/skills-catalog.ts");

// Canonical names for ethskills directories
const ETHSKILLS_NAME_MAP: Record<string, string> = {
    addresses: "Contract Addresses",
    "building-blocks": "DeFi Building Blocks",
    concepts: "Core Concepts",
    contracts: "Contracts",
    defi: "DeFi Primitives",
    "frontend-playbook": "Frontend Playbook",
    "frontend-ux": "Frontend UX",
    gas: "Gas & Costs",
    indexing: "Indexing",
    l2s: "Layer 2s",
    orchestration: "Orchestration (SE2)",
    qa: "QA Checklist",
    security: "Security Patterns",
    ship: "Ship (End-to-End)",
    standards: "ERC Standards",
    testing: "Testing",
    tools: "Dev Tools",
    wallets: "Wallets",
    why: "Why Ethereum",
};

// l2 / layer2 are aliases of l2s — skip them to avoid duplicates
const ETHSKILLS_SKIP = new Set(["l2", "layer2"]);

type GHItem = { name: string; type: string };

async function githubContents(owner: string, repo: string, subpath = ""): Promise<GHItem[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${subpath}`;
    const res = await fetch(url, {
        headers: {
            "User-Agent": "agenthub-sync-skills/1.0",
            Accept: "application/vnd.github.v3+json",
        },
    });
    if (!res.ok) throw new Error(`GitHub API ${url}: ${res.status} ${res.statusText}`);
    return res.json() as Promise<GHItem[]>;
}

function slugToName(slug: string): string {
    return slug
        .replace(/\.[^.]+$/, "") // strip extension
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function indent(lines: string, spaces = 4): string {
    return lines
        .split("\n")
        .map((l) => " ".repeat(spaces) + l)
        .join("\n");
}

function buildCategoryBlock(name: string, skills: Array<{ value: string; name: string }>): string {
    const skillLines = skills
        .map((s) => `        { value: ${JSON.stringify(s.value)}, name: ${JSON.stringify(s.name)} },`)
        .join("\n");
    return `    {\n        name: ${JSON.stringify(name)},\n        skills: [\n${skillLines}\n        ],\n    },`;
}

function injectSection(src: string, tag: string, block: string): string {
    const begin = `// BEGIN:${tag}`;
    const end = `// END:${tag}`;
    const re = new RegExp(`(${begin})[\\s\\S]*?(${end})`);
    if (!re.test(src)) throw new Error(`Markers ${begin} / ${end} not found in skills-catalog.ts`);
    return src.replace(re, `${begin}\n${block}\n    ${end}`);
}

async function main() {
    // ── ethskills ────────────────────────────────────────────────────────────
    console.log("🔍 Fetching ethskills (austintgriffith/ethskills)...");
    const ethItems = await githubContents("austintgriffith", "ethskills");
    const ethDirs = ethItems
        .filter((i) => i.type === "dir" && !i.name.startsWith(".") && !ETHSKILLS_SKIP.has(i.name))
        .map((i) => i.name)
        .sort();

    const ethSkills = ethDirs.map((dir) => ({
        value: `https://ethskills.com/${dir}/SKILL.md`,
        name: ETHSKILLS_NAME_MAP[dir] ?? slugToName(dir),
    }));
    console.log(`   ✓ ${ethSkills.length} skills: ${ethDirs.join(", ")}`);

    // ── arbitrum-dapp-skill ──────────────────────────────────────────────────
    console.log("🔍 Fetching arbitrum-dapp-skill (hummusonrails/arbitrum-dapp-skill)...");
    const arbRoot = await githubContents("hummusonrails", "arbitrum-dapp-skill");

    const arbSkills: Array<{ value: string; name: string }> = [];

    // Main SKILL.md
    if (arbRoot.some((i) => i.name === "SKILL.md" && i.type === "file")) {
        arbSkills.push({
            value: "https://raw.githubusercontent.com/hummusonrails/arbitrum-dapp-skill/main/SKILL.md",
            name: "Arbitrum dApp Development",
        });
    }

    // references/ sub-skills
    if (arbRoot.some((i) => i.name === "references" && i.type === "dir")) {
        const refs = await githubContents("hummusonrails", "arbitrum-dapp-skill", "references");
        for (const item of refs.filter((i) => i.type === "file" && i.name.endsWith(".md"))) {
            arbSkills.push({
                value: `https://raw.githubusercontent.com/hummusonrails/arbitrum-dapp-skill/main/references/${item.name}`,
                name: slugToName(item.name),
            });
        }
    }
    console.log(`   ✓ ${arbSkills.length} skills: ${arbSkills.map((s) => s.name).join(", ")}`);

    // ── Inject into catalog ──────────────────────────────────────────────────
    let src = await fs.readFile(CATALOG_PATH, "utf-8");
    src = injectSection(src, "ETHSKILLS", buildCategoryBlock("Ethereum Dev (ethskills.com)", ethSkills));
    src = injectSection(src, "ARBITRUM", buildCategoryBlock("Arbitrum (arbitrum-dapp-skill)", arbSkills));
    await fs.writeFile(CATALOG_PATH, src, "utf-8");

    console.log(`\n✅ skills-catalog.ts updated (${ethSkills.length + arbSkills.length} new skills added)`);
    console.log("   Commit the result to keep it in version control.");
}

main().catch((e) => {
    console.error("❌", e.message);
    process.exit(1);
});
