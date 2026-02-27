// Chain configs - SDK handles contract addresses internally
// x402 facilitator: PayAI (https://facilitator.payai.network)
// Supported: Base, Polygon
// Not supported: Ethereum, Arbitrum (no facilitator with x402 v2 support)
export const CHAINS = {
    // ============ MAINNETS ============
    "arbitrum-mainnet": {
        name: "Arbitrum One",
        chainId: 42161,
        rpcUrl: "https://arb1.arbitrum.io/rpc",
        scanPath: "arbitrum",
        x402Network: "eip155:42161",
        x402Supported: false, // No facilitator supports Arbitrum with x402 v2 (yet)
        facilitatorUrl: null,
        usdcAddress: null,
        identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as string | null,
        reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as string | null,
    },
    "eth-mainnet": {
        name: "Ethereum Mainnet",
        chainId: 1,
        rpcUrl: "https://ethereum-rpc.publicnode.com",
        scanPath: "mainnet",
        x402Network: "eip155:1",
        x402Supported: false, // No facilitator supports Ethereum mainnet
        facilitatorUrl: null,
        usdcAddress: null,
        identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as string | null,
        reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as string | null,
    },
    "base-mainnet": {
        name: "Base Mainnet",
        chainId: 8453,
        rpcUrl: "https://mainnet.base.org",
        scanPath: "base",
        x402Network: "eip155:8453",
        x402Supported: true,
        facilitatorUrl: "https://facilitator.payai.network",
        usdcAddress: null, // SDK has default
        identityRegistry: null as string | null,
        reputationRegistry: null as string | null,
    },
    "polygon-mainnet": {
        name: "Polygon Mainnet",
        chainId: 137,
        rpcUrl: "https://polygon-rpc.com",
        scanPath: "polygon",
        x402Network: "eip155:137",
        x402Supported: true,
        facilitatorUrl: "https://facilitator.payai.network",
        usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Native USDC
        usdcName: "USD Coin",
        usdcVersion: "2",
        identityRegistry: null as string | null,
        reputationRegistry: null as string | null,
    },
    // ============ TESTNETS ============
    "arbitrum-sepolia": {
        name: "Arbitrum Sepolia (Testnet)",
        chainId: 421614,
        rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
        scanPath: "arbitrum-sepolia",
        x402Network: "eip155:421614",
        x402Supported: false, // No facilitator supports Arbitrum Sepolia with x402 v2 (yet)
        facilitatorUrl: null,
        usdcAddress: null,
        identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as string | null,
        reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as string | null,
    },
    "eth-sepolia": {
        name: "Ethereum Sepolia (Testnet)",
        chainId: 11155111,
        rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
        scanPath: "sepolia",
        x402Network: "eip155:11155111",
        x402Supported: false, // No facilitator supports Ethereum Sepolia
        facilitatorUrl: null,
        usdcAddress: null,
        identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as string | null,
        reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as string | null,
    },
    "base-sepolia": {
        name: "Base Sepolia (Testnet)",
        chainId: 84532,
        rpcUrl: "https://sepolia.base.org",
        scanPath: "base-sepolia",
        x402Network: "eip155:84532",
        x402Supported: true,
        facilitatorUrl: "https://facilitator.payai.network",
        usdcAddress: null, // SDK has default
        identityRegistry: null as string | null,
        reputationRegistry: null as string | null,
    },
    "polygon-amoy": {
        name: "Polygon Amoy (Testnet)",
        chainId: 80002,
        rpcUrl: "https://rpc-amoy.polygon.technology",
        scanPath: "polygon-amoy",
        x402Network: "eip155:80002",
        x402Supported: true,
        facilitatorUrl: "https://facilitator.payai.network",
        usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // Circle testnet USDC
        usdcName: "USDC",
        usdcVersion: "2",
        identityRegistry: null as string | null,
        reputationRegistry: null as string | null,
    },
} as const;

export type ChainKey = keyof typeof CHAINS;

export const TRUST_MODELS = ["reputation", "crypto-economic", "tee-attestation"] as const;
export type TrustModel = (typeof TRUST_MODELS)[number];

// --- Chain helpers for prompts ---
export function getChainKeys(): ChainKey[] {
    return Object.keys(CHAINS) as ChainKey[];
}

export function getChainChoices(): { name: string; value: ChainKey }[] {
    return getChainKeys().map((key) => ({ name: CHAINS[key].name, value: key }));
}

// --- Agent ID validation (chainId:tokenId) ---
export const AGENT_ID_REGEX = /^\d+:\d+$/;
export const AGENT_ID_MESSAGE = "Agent ID (format chainId:tokenId, e.g. 421614:5)";

export function validateAgentId(v: string): true | string {
    return AGENT_ID_REGEX.test((v ?? "").trim()) ? true : `Use format chainId:tokenId (e.g. 421614:5)`;
}
