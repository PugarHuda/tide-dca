/**
 * Raydium V3 routing — primary DEX backbone for Tide.
 *
 * Why Raydium:
 *   Raydium is the deepest CLMM + AMM venue on Solana, accounting for the
 *   majority of organic SOL/USDC liquidity. Tide's aggregate orders are
 *   often sized $100-$10K — directly within Raydium's sweet spot per pool.
 *
 * Architecture:
 *   1. Quote: Raydium V3 trade API (`api-v3.raydium.io` + `transaction-v1`)
 *   2. Execution: Caller's choice. The Anchor `execute_swap` ix is
 *      DEX-agnostic — pass any program id + route bytes and the escrow
 *      authority PDA signs the CPI. Raydium AMM v4 program id is
 *      `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8`.
 *   3. Fallback: For thin pairs (e.g., long-tail tokens not in a deep
 *      Raydium pool), the path falls through to a Jupiter aggregator
 *      route. Jupiter under the hood routes ~60-70% of its volume through
 *      Raydium, so the fallback rarely materially differs from a direct
 *      Raydium hit on common pairs.
 *
 * Mainnet endpoints:
 *   GET  https://transaction-v1.raydium.io/compute/swap-base-in
 *        ?inputMint&outputMint&amount&slippageBps&txVersion=V0
 *   POST https://transaction-v1.raydium.io/transaction/swap-base-in
 *        body: { computeUnitPriceMicroLamports, swapResponse, ... }
 *
 * Devnet:
 *   Raydium does NOT expose a devnet trading API. On-chain QA uses an
 *   SPL sync_native CPI as a "stand-in DEX" (see scripts/qa-e2e.mjs);
 *   the call surface stays identical to a real Raydium swap.
 *
 * Docs:
 *   https://docs.raydium.io/raydium/traders/trade-api
 *   https://github.com/raydium-io/raydium-sdk-V2
 */

import { PublicKey } from "@solana/web3.js";

const RAYDIUM_TRADE_API =
  process.env.NEXT_PUBLIC_RAYDIUM_API ?? "https://transaction-v1.raydium.io";

/** Raydium AMM v4 program — used as `dex_program` argument to execute_swap. */
export const RAYDIUM_AMM_V4_PROGRAM_ID = new PublicKey(
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
);

/** Raydium CLMM program — for concentrated-liquidity pools (USDC/SOL etc.). */
export const RAYDIUM_CLMM_PROGRAM_ID = new PublicKey(
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
);

export type RaydiumQuoteRequest = {
  inputMint: PublicKey;
  outputMint: PublicKey;
  /** Amount in input-token lamports (USDC has 6, so 1 USDC = 1_000_000). */
  amount: bigint;
  slippageBps: number;
};

/**
 * Raydium V3 swap-base-in compute response.
 * Trimmed to the fields Tide actually consumes — full schema includes
 * `routePlan`, `priceImpact`, etc., which we currently ignore.
 */
export type RaydiumQuote = {
  id: string;
  success: boolean;
  data: {
    swapType: "BaseIn" | "BaseOut";
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
    otherAmountThreshold: string;
    slippageBps: number;
    priceImpactPct: number;
    routePlan: Array<{
      poolId: string;
      inputMint: string;
      outputMint: string;
      feeMint: string;
      feeRate: number;
      feeAmount: string;
    }>;
  };
};

/**
 * Fetch a Raydium swap quote. Throws on non-2xx or `success: false`.
 *
 * Note: Raydium trade API is mainnet-only. On devnet this will return
 * "no route". Devnet QA bypasses this with the SPL sync_native stand-in.
 */
export async function fetchRaydiumQuote(
  req: RaydiumQuoteRequest,
): Promise<RaydiumQuote> {
  const url = new URL(`${RAYDIUM_TRADE_API}/compute/swap-base-in`);
  url.searchParams.set("inputMint", req.inputMint.toBase58());
  url.searchParams.set("outputMint", req.outputMint.toBase58());
  url.searchParams.set("amount", req.amount.toString());
  url.searchParams.set("slippageBps", String(req.slippageBps));
  url.searchParams.set("txVersion", "V0");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(
      `Raydium quote failed: ${response.status} ${response.statusText}`,
    );
  }
  const json = (await response.json()) as RaydiumQuote;
  if (!json.success) {
    throw new Error(`Raydium quote: success=false`);
  }
  return json;
}

/**
 * Construct swap-tx via Raydium's transaction endpoint.
 *
 * Returns the swap transaction as base64. Caller can either:
 *   - Forward the entire tx to wallet for signing (simpler), OR
 *   - Decompose into individual ix + ALT for use as `execute_swap`'s
 *     `jupiter_route_data` (parameter name predates DEX-agnostic generalization).
 *
 * The latter is what Tide does on-chain — the Anchor program treats the
 * route data + remaining_accounts as opaque.
 */
export async function fetchRaydiumSwapTx(
  quote: RaydiumQuote,
  payer: PublicKey,
  options: {
    /** Compute unit price (micro-lamports). 100k = ~$0.0001 typical. */
    computeUnitPriceMicroLamports?: number;
    /** Wrap/unwrap SOL automatically when SOL is on either side. */
    wrapSol?: boolean;
  } = {},
): Promise<{ transaction: string }> {
  const body = {
    swapResponse: quote,
    txVersion: "V0",
    wallet: payer.toBase58(),
    wrapSol: options.wrapSol ?? true,
    unwrapSol: options.wrapSol ?? true,
    computeUnitPriceMicroLamports: String(
      options.computeUnitPriceMicroLamports ?? 100_000,
    ),
  };

  const response = await fetch(
    `${RAYDIUM_TRADE_API}/transaction/swap-base-in`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Raydium swap-tx failed: ${response.status} ${response.statusText}`,
    );
  }
  const json = (await response.json()) as {
    success: boolean;
    data: Array<{ transaction: string }>;
  };
  if (!json.success || !json.data?.[0]?.transaction) {
    throw new Error("Raydium swap-tx: empty payload");
  }
  return { transaction: json.data[0].transaction };
}

export const RAYDIUM_DOCS_URL = "https://docs.raydium.io";
