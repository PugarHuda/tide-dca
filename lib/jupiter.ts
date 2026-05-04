/**
 * Jupiter v6 integration for Tide aggregate swaps.
 *
 * Tide uses Jupiter to execute the aggregate swap (sum of all encrypted intents
 * → target token). Use IOC (immediate-or-cancel) flag to prevent partial fills.
 *
 * Docs: https://station.jup.ag/docs/swap-api/get-quote
 */

import { PublicKey } from "@solana/web3.js";

const JUPITER_API_BASE =
  process.env.NEXT_PUBLIC_JUPITER_API ?? "https://quote-api.jup.ag/v6";

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // base64-encoded versioned transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
}

export interface JupiterQuoteParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: bigint; // in input mint lamports
  slippageBps: number;
  swapMode?: "ExactIn" | "ExactOut";
  /** Restrict to specific DEXes for predictable execution. */
  dexes?: string[];
  /** Restrict route plan to direct routes only (fewer hops, lower MEV surface). */
  onlyDirectRoutes?: boolean;
  /** Use dynamic slippage estimation. */
  dynamicSlippage?: boolean;
}

/** Fetch best swap route + quote from Jupiter. */
export async function fetchQuote(params: JupiterQuoteParams): Promise<JupiterQuote> {
  const url = new URL(`${JUPITER_API_BASE}/quote`);
  url.searchParams.set("inputMint", params.inputMint.toBase58());
  url.searchParams.set("outputMint", params.outputMint.toBase58());
  url.searchParams.set("amount", params.amount.toString());
  url.searchParams.set("slippageBps", params.slippageBps.toString());
  url.searchParams.set("swapMode", params.swapMode ?? "ExactIn");

  if (params.onlyDirectRoutes) {
    url.searchParams.set("onlyDirectRoutes", "true");
  }
  if (params.dexes && params.dexes.length > 0) {
    url.searchParams.set("dexes", params.dexes.join(","));
  }
  if (params.dynamicSlippage) {
    url.searchParams.set("dynamicSlippage", "true");
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Jupiter quote failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/** Get serialized swap transaction from Jupiter to be CPI'd from Anchor. */
export async function fetchSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: PublicKey,
): Promise<JupiterSwapResponse> {
  const response = await fetch(`${JUPITER_API_BASE}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: userPublicKey.toBase58(),
      wrapAndUnwrapSol: true,
      computeUnitPriceMicroLamports: "auto",
      // For Tide: we want IOC behavior
      // Note: Jupiter doesn't have explicit IOC, use Jito bundle for atomicity
    }),
  });
  if (!response.ok) {
    throw new Error(`Jupiter swap failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export interface JupiterSwapInstruction {
  programId: string;
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  data: string; // base64
}

export interface JupiterSwapInstructionsResponse {
  computeBudgetInstructions: JupiterSwapInstruction[];
  setupInstructions: JupiterSwapInstruction[];
  swapInstruction: JupiterSwapInstruction;
  cleanupInstruction: JupiterSwapInstruction | null;
  addressLookupTableAddresses: string[];
}

/**
 * Fetch raw swap instructions for CPI passthrough from Anchor.
 *
 * We use this (not /swap which returns a full tx) because Tide forwards
 * swapInstruction.data as `jupiter_route_data` and swapInstruction.accounts
 * as `remaining_accounts`. The setup/cleanup instructions are bypassed —
 * Tide handles input/output via its own escrow ATAs and does not need
 * Jupiter's wSOL wrapping helpers.
 */
export async function fetchSwapInstructions(
  quote: JupiterQuote,
  userPublicKey: PublicKey,
  options: { destinationTokenAccount?: PublicKey } = {},
): Promise<JupiterSwapInstructionsResponse> {
  const body: Record<string, unknown> = {
    quoteResponse: quote,
    userPublicKey: userPublicKey.toBase58(),
    // We're calling from inside our own program — Jupiter's wSOL helpers add
    // setup/cleanup ixs we don't pass through, so disable.
    wrapAndUnwrapSol: false,
  };
  if (options.destinationTokenAccount) {
    body.destinationTokenAccount = options.destinationTokenAccount.toBase58();
  }

  const response = await fetch(`${JUPITER_API_BASE}/swap-instructions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `Jupiter swap-instructions failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

/** Calculate effective slippage from quote (output amount vs spot reference). */
export function calculateEffectiveSlippageBps(
  quote: JupiterQuote,
  spotPrice: bigint,
): number {
  const outAmount = BigInt(quote.outAmount);
  const inAmount = BigInt(quote.inAmount);
  if (inAmount === 0n || spotPrice === 0n) return 0;

  const expectedOut = (inAmount * 1_000_000n) / spotPrice; // assuming 6-decimal scale for spot
  const slippage = ((expectedOut - outAmount) * 10_000n) / expectedOut;
  return Number(slippage);
}
