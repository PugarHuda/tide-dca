/**
 * Tide shared constants.
 */

import { PublicKey } from "@solana/web3.js";

/** Safe PublicKey constructor — falls back to default (all-zero pubkey) on invalid input. */
function safePubkey(
  addr: string | undefined,
  fallback: PublicKey = PublicKey.default,
): PublicKey {
  if (!addr) return fallback;
  try {
    return new PublicKey(addr);
  } catch {
    return fallback;
  }
}

// Program ID — placeholder. Run `anchor keys list` after first build,
// set NEXT_PUBLIC_TIDE_PROGRAM_ID di .env.local dengan real value.
export const TIDE_PROGRAM_ID = safePubkey(
  process.env.NEXT_PUBLIC_TIDE_PROGRAM_ID,
);

// USDC mints.
// Devnet: custom test mint we control (Circle's faucet is region-blocked
// for some users). Mint authority = pool admin wallet, so /admin can mint
// fresh test USDC into any wallet via the SPL MintTo instruction.
// Decimals: 6 (matches real USDC).
export const USDC_MINT_DEVNET = new PublicKey(
  "4YhohVQ8RmudchbAe2UBXcrdduVYkuqyU7hHviz2MSvT",
);
export const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

// SOL native mint (wrapped)
export const SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112",
);

// Jupiter program (mainnet — devnet uses different)
export const JUPITER_PROGRAM_ID = new PublicKey(
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
);

// PDA seeds — match Anchor program
export const SEED_POOL = "pool";
export const SEED_DCA_POSITION = "dca-position";
export const SEED_WINDOW = "window";
export const SEED_INTENT = "intent";
export const SEED_ESCROW = "escrow";

// Pool config
export const DEFAULT_WINDOW_DURATION_SECONDS = 3600; // 1 hour
export const DEFAULT_FEE_BPS = 5; // 0.05%
export const DEFAULT_MIN_POOL_SIZE_USDC = 100_000_000n; // 100 USDC

// Subscription / DCA limits
export const DCA_AMOUNT_LIMITS = {
  MIN: 1_000_000n, // 1 USDC minimum
  MAX: 100_000_000_000n, // 100K USDC maximum per window
} as const;

export const SLIPPAGE_LIMITS = {
  MIN: 10, // 0.1% bps
  MAX: 1000, // 10% bps
  DEFAULT: 100, // 1% bps
} as const;

// Sponsor branding
export const SPONSOR_INTEGRATIONS = {
  arcium: "Encrypted intent storage + aggregate compute (mechanism core)",
  phantom: "Default wallet + grand prize sponsor + 20M users",
  privy: "Embedded wallet for non-crypto user onboarding",
  moonpay: "Fiat → USDC direct top-up to pool",
  reflect: "Yield-bearing on idle escrowed USDC",
} as const;

// Network
export type Network = "devnet" | "mainnet" | "localnet";

export const RPC_URLS: Record<Network, string> = {
  devnet:
    process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC ??
    "https://api.devnet.solana.com",
  mainnet:
    process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC ??
    "https://api.mainnet-beta.solana.com",
  localnet: "http://127.0.0.1:8899",
};

export const CURRENT_NETWORK: Network =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Network) ?? "devnet";

// Window status enum (matches Anchor program)
export enum WindowStatus {
  Open = 0,
  Aggregating = 1,
  Distributed = 2,
  Failed = 3,
}
