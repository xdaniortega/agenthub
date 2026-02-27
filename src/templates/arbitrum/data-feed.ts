/**
 * Template generator for the Data Oracle scaffold file.
 * Produces src/data-feed.ts in the generated project.
 */

export function generateDataFeed(): string {
    return `/**
 * Data Feed
 *
 * Reads on-chain data from Arbitrum and exposes it via the MCP server.
 * Supports The Graph subgraph queries and direct contract reads via viem.
 *
 * Add new data sources by implementing the DataSource interface and
 * registering them in the DATA_SOURCES map below.
 */

import 'dotenv/config';
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { defineChain } from 'viem';

// ============================================================================
// Chain setup
// ============================================================================

const chainId = parseInt(process.env.CHAIN_ID ?? '421614', 10);

const arbitrumChain = defineChain({
  id: chainId,
  name: chainId === 42161 ? 'Arbitrum One' : 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc'] } },
});

export const publicClient = createPublicClient({
  chain: arbitrumChain,
  transport: http(),
});

// ============================================================================
// Data types
// ============================================================================

export interface OracleDataPoint {
  source: string;
  key: string;
  value: unknown;
  fetchedAt: string; // ISO 8601 timestamp
  isStale: boolean;
}

export interface DataSource {
  name: string;
  fetch: () => Promise<OracleDataPoint[]>;
}

// ============================================================================
// Built-in data sources
// ============================================================================

/** Reads ETH balance and block number — always available, good for health checks */
const chainMetricsSource: DataSource = {
  name: 'chain-metrics',
  fetch: async () => {
    const [blockNumber, gasPrice] = await Promise.all([
      publicClient.getBlockNumber(),
      publicClient.getGasPrice(),
    ]);

    const now = new Date().toISOString();
    return [
      {
        source: 'chain-metrics',
        key: 'blockNumber',
        value: blockNumber.toString(),
        fetchedAt: now,
        isStale: false,
      },
      {
        source: 'chain-metrics',
        key: 'gasPriceGwei',
        value: parseFloat(formatUnits(gasPrice, 9)).toFixed(4),
        fetchedAt: now,
        isStale: false,
      },
    ];
  },
};

/**
 * Example: read an ERC-20 token's total supply.
 * Replace TOKEN_ADDRESS with your target contract.
 */
const erc20MetricsSource: DataSource = {
  name: 'erc20-metrics',
  fetch: async () => {
    const tokenAddress = process.env.TOKEN_ADDRESS as \`0x\${string}\` | undefined;
    if (!tokenAddress) return [];

    const erc20Abi = parseAbi([
      'function totalSupply() view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
    ]);

    try {
      const [totalSupply, decimals, symbol] = await Promise.all([
        publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'totalSupply' }),
        publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }),
        publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'symbol' }),
      ]);

      return [{
        source: 'erc20-metrics',
        key: \`\${symbol}/totalSupply\`,
        value: formatUnits(totalSupply, decimals),
        fetchedAt: new Date().toISOString(),
        isStale: false,
      }];
    } catch {
      return [];
    }
  },
};

/**
 * The Graph subgraph query helper.
 * Set SUBGRAPH_URL in .env to enable this source.
 *
 * Example subgraphs on Arbitrum:
 *   Uniswap v3: https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-arbitrum
 */
const subgraphSource: DataSource = {
  name: 'subgraph',
  fetch: async () => {
    const subgraphUrl = process.env.SUBGRAPH_URL;
    if (!subgraphUrl) return [];

    const query = \`
      {
        factories(first: 1) {
          poolCount
          txCount
          totalVolumeUSD
        }
      }
    \`;

    try {
      const res = await fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(10_000),
      });

      const { data } = await res.json() as { data: { factories: Array<{ poolCount: string; txCount: string; totalVolumeUSD: string }> } };
      const factory = data?.factories?.[0];
      if (!factory) return [];

      const now = new Date().toISOString();
      return [
        { source: 'subgraph', key: 'poolCount', value: factory.poolCount, fetchedAt: now, isStale: false },
        { source: 'subgraph', key: 'txCount', value: factory.txCount, fetchedAt: now, isStale: false },
        { source: 'subgraph', key: 'totalVolumeUSD', value: factory.totalVolumeUSD, fetchedAt: now, isStale: false },
      ];
    } catch {
      return [];
    }
  },
};

// ============================================================================
// Source registry
// Add new DataSource implementations here.
// ============================================================================

export const DATA_SOURCES: Record<string, DataSource> = {
  'chain-metrics': chainMetricsSource,
  'erc20-metrics': erc20MetricsSource,
  subgraph: subgraphSource,
};

// ============================================================================
// Public API
// ============================================================================

/** Fetch all registered data sources in parallel. */
export async function fetchAll(): Promise<OracleDataPoint[]> {
  const results = await Promise.all(Object.values(DATA_SOURCES).map((s) => s.fetch()));
  return results.flat();
}

/** Fetch a single data source by name. */
export async function fetchSource(name: string): Promise<OracleDataPoint[]> {
  const source = DATA_SOURCES[name];
  if (!source) throw new Error(\`Unknown data source: \${name}. Available: \${Object.keys(DATA_SOURCES).join(', ')}\`);
  return source.fetch();
}
`;
}

/** Oracle-specific MCP tools — replaces the generic tools.ts for data-oracle agents */
export function generateOracleTools(): string {
    return `/**
 * Oracle MCP Tools
 *
 * Exposes data feed queries as MCP tools for Claude Desktop, Cursor, and
 * other MCP-compatible clients. Each tool maps to a data-feed.ts operation.
 *
 * To add a new tool:
 *   1. Add a tool definition to the 'tools' array
 *   2. Add the implementation in handleToolCall()
 *   3. Optionally add a matching DataSource in src/data-feed.ts
 */

import { fetchAll, fetchSource } from './data-feed.js';

// ============================================================================
// Tool definitions (shown to MCP clients as available capabilities)
// ============================================================================

export const tools = [
  {
    name: 'get_all_data',
    description: 'Fetch all oracle data points from every registered source',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_source_data',
    description: 'Fetch data from a specific oracle source (chain-metrics, erc20-metrics, subgraph)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          description: 'Data source name: chain-metrics | erc20-metrics | subgraph',
        },
      },
      required: ['source'],
    },
  },
  {
    name: 'get_block_number',
    description: 'Get the current Arbitrum block number',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// ============================================================================
// Tool implementations
// ============================================================================

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_all_data': {
      const data = await fetchAll();
      return { dataPoints: data, count: data.length };
    }

    case 'get_source_data': {
      const source = args.source as string;
      const data = await fetchSource(source);
      return { source, dataPoints: data };
    }

    case 'get_block_number': {
      const data = await fetchSource('chain-metrics');
      const block = data.find((d) => d.key === 'blockNumber');
      return { blockNumber: block?.value ?? null };
    }

    default:
      throw new Error(\`Unknown tool: \${name}\`);
  }
}
`;
}
