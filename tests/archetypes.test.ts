/**
 * Archetype Test Suite
 *
 * Verifies that each archetype generates the correct files, dependencies,
 * system prompts, and MCP tools.
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import {
    generateTestAgent,
    readGeneratedFile,
    fileExists,
    TEST_BASE_DIR,
} from './utils/test-helpers.js';

describe('Archetype: research', () => {
    let projectDir: string;

    it('generates files with research-specific content', async () => {
        projectDir = await generateTestAgent({
            chain: 'eth-sepolia',
            features: ['a2a', 'mcp'],
            archetype: 'research',
            projectName: 'archetype-research',
        });

        // agent.ts should contain the research system prompt
        const agentTs = await readGeneratedFile(projectDir, 'src/agent.ts');
        expect(agentTs).toContain('Research Agent');
        expect(agentTs).toContain('research');

        // tools.ts should include research tools
        const toolsTs = await readGeneratedFile(projectDir, 'src/tools.ts');
        expect(toolsTs).toContain('web_search');
        expect(toolsTs).toContain('summarize_url');
        expect(toolsTs).toContain('generate_report');

        // package.json should include cheerio
        const pkg = JSON.parse(await readGeneratedFile(projectDir, 'package.json'));
        expect(pkg.dependencies['cheerio']).toBeDefined();

        // register.ts should include OASF skills uncommented
        const registerTs = await readGeneratedFile(projectDir, 'src/register.ts');
        expect(registerTs).toContain("agent.addSkill('natural_language_processing/natural_language_generation/summarization')");
        expect(registerTs).toContain("agent.addDomain('technology/information_retrieval')");
    }, 30000);
});

describe('Archetype: code', () => {
    it('generates files with code-agent-specific content', async () => {
        const projectDir = await generateTestAgent({
            chain: 'eth-sepolia',
            features: ['a2a', 'mcp'],
            archetype: 'code',
            projectName: 'archetype-code',
        });

        const agentTs = await readGeneratedFile(projectDir, 'src/agent.ts');
        expect(agentTs).toContain('Code Agent');

        const toolsTs = await readGeneratedFile(projectDir, 'src/tools.ts');
        expect(toolsTs).toContain('generate_code');
        expect(toolsTs).toContain('review_code');
        expect(toolsTs).toContain('explain_code');
        expect(toolsTs).toContain('debug_code');

        const registerTs = await readGeneratedFile(projectDir, 'src/register.ts');
        expect(registerTs).toContain("agent.addSkill('analytical_skills/coding_skills/text_to_code')");
    }, 30000);
});

describe('Archetype: document', () => {
    it('generates files with document-agent-specific content', async () => {
        const projectDir = await generateTestAgent({
            chain: 'eth-sepolia',
            features: ['a2a', 'mcp'],
            archetype: 'document',
            projectName: 'archetype-document',
        });

        const agentTs = await readGeneratedFile(projectDir, 'src/agent.ts');
        expect(agentTs).toContain('Document Agent');

        const toolsTs = await readGeneratedFile(projectDir, 'src/tools.ts');
        expect(toolsTs).toContain('analyze_document');
        expect(toolsTs).toContain('extract_entities');
        expect(toolsTs).toContain('transform_content');
    }, 30000);
});

describe('Archetype: orchestrator', () => {
    it('generates registry-service.ts, orchestrator.ts, and correct scripts', async () => {
        const projectDir = await generateTestAgent({
            chain: 'arbitrum-sepolia',
            features: ['a2a'],
            archetype: 'orchestrator',
            projectName: 'archetype-orchestrator',
        });

        // Extra files must be generated
        expect(await fileExists(projectDir, 'src/registry-service.ts')).toBe(true);
        expect(await fileExists(projectDir, 'src/orchestrator.ts')).toBe(true);

        // package.json should include viem, chalk, and orchestrator scripts
        const pkg = JSON.parse(await readGeneratedFile(projectDir, 'package.json'));
        expect(pkg.dependencies['viem']).toBeDefined();
        expect(pkg.dependencies['chalk']).toBeDefined();
        expect(pkg.scripts['start:orchestrator']).toBeDefined();
        expect(pkg.scripts['discover']).toBeDefined();
        expect(pkg.scripts['feedback']).toBeDefined();

        // .env should include registry addresses
        const env = await readGeneratedFile(projectDir, '.env');
        expect(env).toContain('IDENTITY_REGISTRY_ADDRESS');
        expect(env).toContain('REPUTATION_REGISTRY_ADDRESS');

        // register.ts should have OASF skills
        const registerTs = await readGeneratedFile(projectDir, 'src/register.ts');
        expect(registerTs).toContain("agent.addSkill('agent_coordination/task_delegation')");
    }, 30000);
});

describe('Archetype: custom (backwards compatibility)', () => {
    it('generates the same output as before (no extra files, generic prompt)', async () => {
        const projectDir = await generateTestAgent({
            chain: 'eth-sepolia',
            features: ['a2a', 'mcp'],
            archetype: 'custom',
            projectName: 'archetype-custom',
        });

        // No orchestrator-specific files
        expect(await fileExists(projectDir, 'src/registry-service.ts')).toBe(false);
        expect(await fileExists(projectDir, 'src/orchestrator.ts')).toBe(false);

        // agent.ts should have the generic system prompt
        const agentTs = await readGeneratedFile(projectDir, 'src/agent.ts');
        expect(agentTs).toContain('helpful AI assistant');

        // register.ts skills should be commented out
        const registerTs = await readGeneratedFile(projectDir, 'src/register.ts');
        expect(registerTs).toContain('// agent.addSkill(');
    }, 30000);
});
