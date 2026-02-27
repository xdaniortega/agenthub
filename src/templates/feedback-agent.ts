/**
 * Templates and extras for Feedback Agent type only.
 * Used when agentType === "feedback-agent"; base templates stay generic.
 */

import { CHAINS, AGENT_ID_MESSAGE, AGENT_ID_REGEX, validateAgentId } from "../config.js";

/** Merge into package.json: adds the "feedback" script */
export function getPackageJsonExtras(): { scripts: { feedback: string } } {
    return { scripts: { feedback: "tsx src/give-feedback.ts" } };
}

/** Block to append to .env for Feedback Agent */
export function getEnvBlock(): string {
    return `
# Optional: FEEDBACK_PRIVATE_KEY = wallet for \`npm run feedback\` (must not own the agent you rate).
# FEEDBACK_PRIVATE_KEY=
`;
}

/** Line to add in README "Project Structure" under src/ */
export function getReadmeStructureLine(): string {
    return "│   └── give-feedback.ts  # Give feedback to other agents (npm run feedback)";
}

/** README section for Feedback Agent */
export function getReadmeSection(): string {
    return `### Give feedback to another agent

Run \`npm run feedback\` to submit reputation feedback for other agents. You'll be prompted for chain, agent ID (chainId:tokenId), value (1–100), and tags. Self-feedback is not allowed.`;
}

const CHAINS_LIST_JSON = JSON.stringify(
    Object.entries(CHAINS).map(([key, c]) => ({ key, name: c.name, chainId: c.chainId, rpcUrl: c.rpcUrl }))
);
const AGENT_ID_VALIDATE_ERROR = String(validateAgentId(""));

/** Generates the full content of src/give-feedback.ts for Feedback Agent projects */
export function generateGiveFeedbackScript(): string {
    return `/**
 * Give feedback to another agent (Feedback Agent).
 * Uses FEEDBACK_PRIVATE_KEY if set, else AGENT_PRIVATE_KEY, else PRIVATE_KEY.
 * Reviewer wallet must NOT own the agent you're rating (self-feedback not allowed).
 * Run with: npm run feedback
 */

import path from 'path';
import { config } from 'dotenv';
config({ path: path.join(process.cwd(), '..', '..', '.env') });
config({ path: path.join(process.cwd(), '..', '.env.shared') });
config();

import inquirer from 'inquirer';
import { SDK } from '@blockbyvlog/agent0-sdk';

const CHAINS_LIST = ${CHAINS_LIST_JSON};

async function main() {
    // Use only agent/reviewer key—never PRIVATE_KEY (master) or you get "Self-feedback not allowed"
    const privateKey = process.env.FEEDBACK_PRIVATE_KEY?.trim() || process.env.AGENT_PRIVATE_KEY?.trim();
    if (!privateKey) {
        console.error('Set FEEDBACK_PRIVATE_KEY or AGENT_PRIVATE_KEY in this project\\'s .env.');
        console.error('Do not use PRIVATE_KEY (master) for feedback—the contract blocks self-feedback.');
        process.exit(1);
    }

    const answers = await inquirer.prompt<{
        chainKey: string;
        agentId: string;
        value: number;
        tag1: string;
        tag2: string;
    }>([
        {
            type: 'list',
            name: 'chainKey',
            message: 'Chain where the target agent is registered:',
            choices: CHAINS_LIST.map((c: { key: string; name: string }) => ({ name: c.name, value: c.key })),
        },
        {
            type: 'input',
            name: 'agentId',
            message: '${AGENT_ID_MESSAGE}:',
            validate: (v: string) =>
                /${AGENT_ID_REGEX.source}/.test((v ?? '').trim()) ? true : '${AGENT_ID_VALIDATE_ERROR.replace(/'/g, "\\'")}',
        },
        {
            type: 'input',
            name: 'value',
            message: 'Feedback value (1–100):',
            default: 85,
            validate: (v: string) => {
                const n = parseInt(v, 10);
                if (Number.isNaN(n) || n < 1 || n > 100) return 'Enter a number between 1 and 100';
                return true;
            },
        },
        {
            type: 'input',
            name: 'tag1',
            message: 'Tag 1 (optional):',
            default: 'general',
        },
        {
            type: 'input',
            name: 'tag2',
            message: 'Tag 2 (optional):',
            default: '',
        },
    ]);

    const chain = CHAINS_LIST.find((c: { key: string }) => c.key === answers.chainKey);
    if (!chain) {
        console.error('Unknown chain');
        process.exit(1);
    }

    const rpcUrl = (process.env.RPC_URL || chain.rpcUrl).trim();
    const pinataJwt = process.env.PINATA_JWT?.trim();
    const sdk = new SDK({
        chainId: chain.chainId,
        rpcUrl,
        privateKey,
        ...(pinataJwt ? { ipfs: 'pinata' as const, pinataJwt } : {}),
    });

    const agentId = answers.agentId.trim();
    const value = Number(answers.value);
    const tag1 = answers.tag1.trim() || undefined;
    const tag2 = answers.tag2.trim() || undefined;

    console.log('Submitting feedback...');
    try {
        const tx = await sdk.giveFeedback(agentId, value, tag1, tag2);
        await tx.waitConfirmed();
        console.log('Feedback submitted successfully.');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Feedback failed:', msg);
        if (msg.includes('Self-feedback') || msg.includes('self-feedback')) {
            console.error('Self-feedback is not allowed. Use a different wallet (not the agent owner).');
        }
        process.exit(1);
    }
}

main();
`;
}
