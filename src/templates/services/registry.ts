import type { WizardAnswers } from "../../wizard.js";
import { CHAINS } from "../../config.js";

export function generateRegistryService(answers: WizardAnswers): string {
    const chain = CHAINS[answers.chain];
    const identityAddr = chain.identityRegistry ?? "null";
    const reputationAddr = chain.reputationRegistry ?? "null";

    return `/**
 * Registry Service — reads the ERC-8004 Identity Registry and Reputation Registry on-chain.
 *
 * Uses viem for lightweight on-chain reads.
 * Configure via environment variables:
 *   IDENTITY_REGISTRY_ADDRESS, REPUTATION_REGISTRY_ADDRESS, RPC_URL, CHAIN_ID
 */

import 'dotenv/config';
import { createPublicClient, createWalletClient, http, parseAbi, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';

// ============================================================================
// ABI fragments
// ============================================================================

const identityRegistryAbi = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getAgentWallet(uint256 tokenId) view returns (address)',
]);

const reputationRegistryAbi = parseAbi([
  'function getSummary(uint256 agentId) view returns (uint256 totalFeedback, uint256 averageScore, uint256 lastFeedbackTimestamp)',
  'function readAllFeedback(uint256 agentId) view returns (tuple(address reviewer, uint256 score, string[] tags, string feedbackURI, uint256 timestamp)[])',
  'function giveFeedback(uint256 agentId, uint256 score, string[] tags, string feedbackURI, bytes32 feedbackHash, bytes authSignature, uint256 authExpiry, uint256 authMaxIndex)',
]);

// ============================================================================
// Types
// ============================================================================

export interface AgentInfo {
  agentId: number;
  name: string;
  description: string;
  skills: string[];
  endpoints: { type: string; url: string }[];
  reputation: ReputationSummary;
}

export interface ReputationSummary {
  totalFeedback: number;
  averageScore: number;
  lastFeedbackTimestamp: number;
}

export interface FeedbackEntry {
  reviewer: string;
  score: number;
  tags: string[];
  feedbackURI: string;
  timestamp: number;
}

// ============================================================================
// Client setup
// ============================================================================

function getChainDef(chainId: number, rpcUrl: string) {
  return defineChain({
    id: chainId,
    name: 'ERC-8004 Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

export function createRegistryClient(chainId?: number, rpcUrl?: string) {
  const resolvedChainId = chainId ?? parseInt(process.env.CHAIN_ID ?? '${chain.chainId}');
  const resolvedRpcUrl = rpcUrl ?? process.env.RPC_URL ?? '${chain.rpcUrl}';
  const chainDef = getChainDef(resolvedChainId, resolvedRpcUrl);
  return createPublicClient({ chain: chainDef, transport: http(resolvedRpcUrl) });
}

function getIdentityAddress(): \`0x\${string}\` {
  const addr = process.env.IDENTITY_REGISTRY_ADDRESS ?? '${identityAddr}';
  if (!addr || addr === 'null') throw new Error('IDENTITY_REGISTRY_ADDRESS not set — registry not available on this chain');
  return addr as \`0x\${string}\`;
}

function getReputationAddress(): \`0x\${string}\` {
  const addr = process.env.REPUTATION_REGISTRY_ADDRESS ?? '${reputationAddr}';
  if (!addr || addr === 'null') throw new Error('REPUTATION_REGISTRY_ADDRESS not set — registry not available on this chain');
  return addr as \`0x\${string}\`;
}

// ============================================================================
// discoverAgents — read Identity Registry and match by OASF skills
// ============================================================================

export async function discoverAgents(skills?: string[]): Promise<AgentInfo[]> {
  const client = createRegistryClient();
  const identityAddress = getIdentityAddress();

  const totalSupply = await client.readContract({
    address: identityAddress,
    abi: identityRegistryAbi,
    functionName: 'totalSupply',
  });

  const limit = Math.min(Number(totalSupply), 50); // cap at 50 for now
  const agents: AgentInfo[] = [];

  for (let i = 0; i < limit; i++) {
    try {
      const agentId = await client.readContract({
        address: identityAddress,
        abi: identityRegistryAbi,
        functionName: 'tokenByIndex',
        args: [BigInt(i)],
      });

      const tokenURI = await client.readContract({
        address: identityAddress,
        abi: identityRegistryAbi,
        functionName: 'tokenURI',
        args: [agentId],
      });

      // Fetch registration file from IPFS
      let regFile: Record<string, unknown>;
      try {
        const ipfsUrl = tokenURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
        const res = await fetch(ipfsUrl);
        regFile = await res.json();
      } catch {
        continue; // skip agents with unresolvable URIs
      }

      const agentSkills: string[] = (regFile.skills as string[]) ?? [];

      // Filter by skills if provided
      if (skills && skills.length > 0) {
        const matches = skills.some(s => agentSkills.some(as => as.includes(s) || s.includes(as)));
        if (!matches) continue;
      }

      const reputation = await getReputation(Number(agentId));

      agents.push({
        agentId: Number(agentId),
        name: (regFile.name as string) ?? \`Agent #\${agentId}\`,
        description: (regFile.description as string) ?? '',
        skills: agentSkills,
        endpoints: (regFile.services as { type: string; url: string }[]) ?? [],
        reputation,
      });
    } catch {
      // skip individual errors
    }
  }

  return agents;
}

// ============================================================================
// getReputation — Reputation Registry summary
// ============================================================================

export async function getReputation(agentId: number): Promise<ReputationSummary> {
  const client = createRegistryClient();
  const reputationAddress = getReputationAddress();

  const [totalFeedback, averageScore, lastFeedbackTimestamp] = await client.readContract({
    address: reputationAddress,
    abi: reputationRegistryAbi,
    functionName: 'getSummary',
    args: [BigInt(agentId)],
  });

  return {
    totalFeedback: Number(totalFeedback),
    averageScore: Number(averageScore),
    lastFeedbackTimestamp: Number(lastFeedbackTimestamp),
  };
}

// ============================================================================
// getDetailedFeedback — all feedback entries for an agent
// ============================================================================

export async function getDetailedFeedback(agentId: number): Promise<FeedbackEntry[]> {
  const client = createRegistryClient();
  const reputationAddress = getReputationAddress();

  const entries = await client.readContract({
    address: reputationAddress,
    abi: reputationRegistryAbi,
    functionName: 'readAllFeedback',
    args: [BigInt(agentId)],
  });

  return entries.map((e: { reviewer: string; score: bigint; tags: string[]; feedbackURI: string; timestamp: bigint }) => ({
    reviewer: e.reviewer,
    score: Number(e.score),
    tags: e.tags,
    feedbackURI: e.feedbackURI,
    timestamp: Number(e.timestamp),
  }));
}

// ============================================================================
// giveFeedback — write feedback on-chain
//
// NOTE: The Reputation Registry requires an authSignature from the agent being
// rated. In the full A2A flow, the server agent sends this auth as part of its
// response. Pass authSignature, authExpiry, and authMaxIndex received from the
// agent's A2A response into this function.
// ============================================================================

export async function giveFeedback(
  agentId: number,
  score: number,
  tags: string[],
  comment: string,
  authSignature: \`0x\${string}\`,
  authExpiry: number,
  authMaxIndex: number,
): Promise<string> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY not set');

  const rpcUrl = process.env.RPC_URL ?? '${chain.rpcUrl}';
  const chainId = parseInt(process.env.CHAIN_ID ?? '${chain.chainId}');
  const chainDef = getChainDef(chainId, rpcUrl);

  const account = privateKeyToAccount(privateKey as \`0x\${string}\`);
  const walletClient = createWalletClient({ account, chain: chainDef, transport: http(rpcUrl) });

  // Upload comment to IPFS via Pinata
  let feedbackURI = '';
  let feedbackHash: \`0x\${string}\` = '0x0000000000000000000000000000000000000000000000000000000000000000';

  const pinataJwt = process.env.PINATA_JWT;
  if (pinataJwt && comment) {
    const payload = { comment, agentId, score, tags, timestamp: Date.now() };
    const payloadStr = JSON.stringify(payload);
    feedbackHash = keccak256(toBytes(payloadStr)) as \`0x\${string}\`;

    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: { Authorization: \`Bearer \${pinataJwt}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinataContent: payload }),
    });
    const data = await res.json() as { IpfsHash: string };
    feedbackURI = \`ipfs://\${data.IpfsHash}\`;
  }

  const reputationAddress = getReputationAddress();

  const hash = await walletClient.writeContract({
    address: reputationAddress,
    abi: reputationRegistryAbi,
    functionName: 'giveFeedback',
    args: [BigInt(agentId), BigInt(score), tags, feedbackURI, feedbackHash, authSignature, BigInt(authExpiry), BigInt(authMaxIndex)],
  });

  return hash;
}
`;
}
