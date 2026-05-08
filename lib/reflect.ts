/**
 * Reflect Protocol integration — idle escrow yield.
 *
 * Mechanism:
 *   Between commit_intent and execute_swap, USDC sits idle in the window's
 *   escrow ATA for ~window_duration_seconds (e.g., 15 min for fast pools,
 *   1 hour default). For an active pool with $10K aggregate, that's
 *   ~$10K * 5% APY * (1h / 8760h) ≈ $0.0057 per window — tiny per cycle,
 *   but compounds across thousands of cycles per year.
 *
 *   Reflect Protocol (https://reflect.app) provides yield-bearing wrapped
 *   USDC. Tide's plan: wrap escrow USDC during commit, unwrap before
 *   execute_swap, distribute yield pro-rata via fee bucket adjustment.
 *
 * Status:
 *   - Frontend yield calculator: shipped (this file)
 *   - On-chain CPI: pending Reflect program ABI compatibility check
 *
 * Honest framing in UI: "Planned — escrow yield earnings will accrue to
 * the protocol fee bucket until pro-rata distribution is wired."
 */

/** Reflect's published USDC vault APY. Adjust when their dashboard reports. */
export const REFLECT_USDC_APY = 0.052; // 5.2% (target — Reflect quotes vary)

/** Reflect program id on Solana mainnet (read from env, falls back to TBD). */
export const REFLECT_PROGRAM_ID =
  process.env.NEXT_PUBLIC_REFLECT_PROGRAM_ID ?? "ReflectTBDxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

/**
 * Compute estimated yield on idle escrow USDC for a single window.
 *
 * @param escrowUsdcLamports — total USDC committed this window (6 decimals)
 * @param windowSeconds — how long USDC sits idle before swap
 * @returns lamports of yield earned this window
 */
export function estimateWindowYield(
  escrowUsdcLamports: bigint,
  windowSeconds: number,
): bigint {
  if (escrowUsdcLamports === 0n || windowSeconds === 0) return 0n;
  const yearSec = 365 * 24 * 60 * 60;
  // BigInt arithmetic — multiply then divide to preserve precision
  const numerator = escrowUsdcLamports * BigInt(Math.round(REFLECT_USDC_APY * 1e6)) * BigInt(windowSeconds);
  const denominator = BigInt(1e6) * BigInt(yearSec);
  return numerator / denominator;
}

/**
 * Annualize a per-window yield estimate based on the pool cadence.
 * E.g., 15-min windows fire 96/day = 35,040/year. Useful for marketing copy
 * that compares "Tide DCA + Reflect yield" to "raw DCA".
 */
export function projectAnnualYield(
  escrowUsdcLamports: bigint,
  windowSeconds: number,
): bigint {
  if (escrowUsdcLamports === 0n || windowSeconds === 0) return 0n;
  const cyclesPerYear = (365 * 24 * 60 * 60) / windowSeconds;
  return estimateWindowYield(escrowUsdcLamports, windowSeconds) * BigInt(Math.floor(cyclesPerYear));
}

export const REFLECT_DOCS_URL = "https://reflect.app";
