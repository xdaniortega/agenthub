/**
 * Archetype Test Suite
 *
 * Verifies that each archetype generates the correct files,
 * system prompts, skills, and default features.
 */

import { describe, it, expect } from 'vitest';
import {
    generateTestAgent,
    readGeneratedFile,
    fileExists,
} from './utils/test-helpers.js';

// ─── DeFi Strategist ─────────────────────────────────────────────────────────

describe('Archetype: defi-strategist', () => {
    it('generates correct system prompt and OASF skills', async () => {
        const projectDir = await generateTestAgent({
            chain: 'arbitrum-sepolia',
            features: ['a2a'],
            archetype: 'defi-strategist',
            projectName: 'archetype-defi',
        });

        // agent.ts should use the DeFi Strategist system prompt
        const agentTs = await readGeneratedFile(projectDir, 'src/agent.ts');
        expect(agentTs).toContain('DeFi strategist');

        // register.ts must have all four DeFi skills pre-populated
        const registerTs = await readGeneratedFile(projectDir, 'src/register.ts');
        expect(registerTs).toContain("agent.addSkill('defi/yield_analysis')");
        expect(registerTs).toContain("agent.addSkill('defi/protocol_risk_assessment')");
        expect(registerTs).toContain("agent.addSkill('defi/liquidity_analysis')");
        expect(registerTs).toContain("agent.addSkill('defi/token_economics')");

        // package.json: a2a deps present, mcp deps absent
        const pkg = JSON.parse(await readGeneratedFile(projectDir, 'package.json'));
        expect(pkg.dependencies['express']).toBeDefined();
        expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeUndefined();

        // No MCP server file (not a default feature for this archetype)
        expect(await fileExists(projectDir, 'src/mcp-server.ts')).toBe(false);

        // A2A server should be present
        expect(await fileExists(projectDir, 'src/a2a-server.ts')).toBe(true);
    }, 30000);
});

// ─── Technical Writer ─────────────────────────────────────────────────────────

describe('Archetype: technical-writer', () => {
    it('generates correct system prompt, skills, and MCP server', async () => {
        const projectDir = await generateTestAgent({
            chain: 'arbitrum-sepolia',
            features: ['a2a', 'mcp'],
            archetype: 'technical-writer',
            projectName: 'archetype-technical-writer',
        });

        // agent.ts should reference technical writing
        const agentTs = await readGeneratedFile(projectDir, 'src/agent.ts');
        expect(agentTs).toContain('technical writer');

        // register.ts must have all four writing skills
        const registerTs = await readGeneratedFile(projectDir, 'src/register.ts');
        expect(registerTs).toContain("agent.addSkill('technical_writing/documentation')");
        expect(registerTs).toContain("agent.addSkill('technical_writing/tutorial_creation')");
        expect(registerTs).toContain("agent.addSkill('technical_writing/smart_contract_documentation')");
        expect(registerTs).toContain("agent.addSkill('technical_writing/api_documentation')");

        // Both A2A and MCP files should exist
        expect(await fileExists(projectDir, 'src/a2a-server.ts')).toBe(true);
        expect(await fileExists(projectDir, 'src/mcp-server.ts')).toBe(true);
        expect(await fileExists(projectDir, 'src/tools.ts')).toBe(true);

        // package.json: both express and MCP SDK present
        const pkg = JSON.parse(await readGeneratedFile(projectDir, 'package.json'));
        expect(pkg.dependencies['express']).toBeDefined();
        expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
        expect(pkg.scripts['start:a2a']).toBeDefined();
        expect(pkg.scripts['start:mcp']).toBeDefined();
    }, 30000);
});

// ─── Custom ───────────────────────────────────────────────────────────────────

describe('Archetype: custom', () => {
    it('generates generic system prompt with no pre-filled skills', async () => {
        const projectDir = await generateTestAgent({
            chain: 'eth-sepolia',
            features: ['a2a'],
            archetype: 'custom',
            projectName: 'archetype-custom',
        });

        // agent.ts should use the generic "helpful AI assistant" prompt
        const agentTs = await readGeneratedFile(projectDir, 'src/agent.ts');
        expect(agentTs).toContain('helpful AI assistant');

        // register.ts: skills are commented out (no skills selected)
        const registerTs = await readGeneratedFile(projectDir, 'src/register.ts');
        expect(registerTs).toContain('// agent.addSkill(');

        // No orchestrator-era files
        expect(await fileExists(projectDir, 'src/registry-service.ts')).toBe(false);
        expect(await fileExists(projectDir, 'src/orchestrator.ts')).toBe(false);
    }, 30000);

    it('includes selected custom skills in register.ts', async () => {
        const projectDir = await generateTestAgent({
            chain: 'arbitrum-sepolia',
            features: ['a2a'],
            archetype: 'custom',
            projectName: 'archetype-custom-skills',
            skills: ['defi/yield_analysis', 'nlp/summarization'],
        });

        const registerTs = await readGeneratedFile(projectDir, 'src/register.ts');
        expect(registerTs).toContain("agent.addSkill('defi/yield_analysis')");
        expect(registerTs).toContain("agent.addSkill('nlp/summarization')");
    }, 30000);
});

// ─── Shared across all archetypes ─────────────────────────────────────────────

describe('All archetypes: shared structure', () => {
    it.each([
        ['defi-strategist', 'arbitrum-sepolia'],
        ['technical-writer', 'arbitrum-sepolia'],
        ['custom', 'eth-sepolia'],
    ] as const)('%s on %s generates required base files', async (archetype, chain) => {
        const projectDir = await generateTestAgent({
            chain,
            features: ['a2a'],
            archetype,
            projectName: `shared-${archetype}`,
        });

        expect(await fileExists(projectDir, 'package.json')).toBe(true);
        expect(await fileExists(projectDir, '.env')).toBe(true);
        expect(await fileExists(projectDir, 'src/register.ts')).toBe(true);
        expect(await fileExists(projectDir, 'src/agent.ts')).toBe(true);
        expect(await fileExists(projectDir, '.8004.json')).toBe(true);
        expect(await fileExists(projectDir, 'tsconfig.json')).toBe(true);

        // package.json must have the register script and SDK dep
        const pkg = JSON.parse(await readGeneratedFile(projectDir, 'package.json'));
        expect(pkg.scripts['register']).toBe('tsx src/register.ts');
        expect(pkg.dependencies['@blockbyvlog/agent0-sdk']).toBeDefined();
    }, 30000);
});
