/**
 * Template generator for the Trading Agent scaffold file.
 * Produces src/trading-engine.ts in the generated project.
 */

export function generateTradingEngine(): string {
    return `/**
 * Trading Engine
 *
 * Reads live price data from Chainlink price feeds on Arbitrum and provides
 * helpers for position sizing, slippage estimation, and risk checks.
 *
 * Extend this file with your own DEX interactions (Uniswap v3, Camelot, etc.)
 *
 * Chainlink feed addresses (Arbitrum One):
 *   ETH/USD  0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612
 *   BTC/USD  0x6ce185539D5B95F8b7b1B2E8EF93aE044E0e10b2
 *   ARB/USD  0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D7
 *
 * For Arbitrum Sepolia testnet feeds, see:
 *   https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum&page=1
 */

import 'dotenv/config';
import { createPublicClient, http, parseAbi } from 'viem';
import { defineChain } from 'viem';

// ============================================================================
// Chain setup — reads RPC_URL from .env so the same code works on
// both Arbitrum Sepolia (testnet) and Arbitrum One (mainnet).
// ============================================================================

const chainId = parseInt(process.env.CHAIN_ID ?? '421614', 10); // default: Arbitrum Sepolia

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
// Chainlink AggregatorV3 interface (minimal — only what we need)
// ============================================================================

const aggregatorV3Abi = parseAbi([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
]);

// ============================================================================
// Price feed registry
// Add new feeds here as needed. The key is the trading pair label.
// ============================================================================

export const PRICE_FEEDS: Record<string, \`0x\${string}\`> = {
  // Override via PRICE_FEED_ETH_USD env var so testnet/mainnet addresses
  // can be set without code changes.
  'ETH/USD': (process.env.PRICE_FEED_ETH_USD ?? '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612') as \`0x\${string}\`,
  'BTC/USD': (process.env.PRICE_FEED_BTC_USD ?? '0x6ce185539D5B95F8b7b1B2E8EF93aE044E0e10b2') as \`0x\${string}\`,
  'ARB/USD': (process.env.PRICE_FEED_ARB_USD ?? '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D7') as \`0x\${string}\`,
};

// ============================================================================
// Price reading
// ============================================================================

export interface PriceData {
  pair: string;
  price: number;       // USD price as a plain number (adjusted for decimals)
  updatedAt: Date;
  isStale: boolean;    // true if price is older than STALENESS_THRESHOLD_S
}

/** How old a price can be before we treat it as stale (default: 3 minutes) */
const STALENESS_THRESHOLD_S = parseInt(process.env.PRICE_STALENESS_S ?? '180', 10);

/**
 * Read the latest price from a Chainlink feed.
 * Returns null if the feed address is not set or the call fails.
 */
export async function getPrice(pair: string): Promise<PriceData | null> {
  const feedAddress = PRICE_FEEDS[pair];
  if (!feedAddress) {
    console.warn(\`[trading-engine] No feed registered for \${pair}\`);
    return null;
  }

  try {
    const [roundData, decimals] = await Promise.all([
      publicClient.readContract({ address: feedAddress, abi: aggregatorV3Abi, functionName: 'latestRoundData' }),
      publicClient.readContract({ address: feedAddress, abi: aggregatorV3Abi, functionName: 'decimals' }),
    ]);

    const [, answer, , updatedAt] = roundData;
    const price = Number(answer) / 10 ** decimals;
    const updatedAtDate = new Date(Number(updatedAt) * 1000);
    const ageS = (Date.now() / 1000) - Number(updatedAt);

    return { pair, price, updatedAt: updatedAtDate, isStale: ageS > STALENESS_THRESHOLD_S };
  } catch (err) {
    console.error(\`[trading-engine] Failed to read \${pair} price:\`, err);
    return null;
  }
}

/**
 * Fetch all registered price feeds in parallel.
 */
export async function getAllPrices(): Promise<PriceData[]> {
  const results = await Promise.all(Object.keys(PRICE_FEEDS).map(getPrice));
  return results.filter((r): r is PriceData => r !== null);
}

// ============================================================================
// Risk helpers
// ============================================================================

export interface RiskParams {
  /** Maximum fraction of portfolio to risk on a single trade (e.g. 0.02 = 2%) */
  maxRiskFraction: number;
  /** Stop-loss distance as a fraction of entry price (e.g. 0.05 = 5%) */
  stopLossDistance: number;
  /** Portfolio value in USD */
  portfolioValueUsd: number;
}

/**
 * Kelly-inspired position sizing: given risk params, return the max position
 * size in USD that keeps the risk-per-trade within the defined limit.
 */
export function calcPositionSize(params: RiskParams): number {
  const riskAmountUsd = params.portfolioValueUsd * params.maxRiskFraction;
  return riskAmountUsd / params.stopLossDistance;
}

/**
 * Estimate price impact / slippage for a trade of \`sizeUsd\` against a pool
 * with \`liquidityUsd\` depth. Returns an approximate slippage fraction.
 *
 * This is a simplified model. For production use, query the actual pool.
 */
export function estimateSlippage(sizeUsd: number, liquidityUsd: number): number {
  if (liquidityUsd <= 0) return 1; // worst case
  // Simple square-root impact model: impact ≈ size / (2 * liquidity)
  return Math.min(sizeUsd / (2 * liquidityUsd), 0.5);
}
`;
}
