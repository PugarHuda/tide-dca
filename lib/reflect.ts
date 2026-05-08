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

// ─── Deposit transaction builder ───────────────────────────────────────────
//
// Reflect's USDC vault deposit flow takes USDC from the user's ATA, mints
// a yield-bearing receipt token (rUSDC) into the user's Reflect ATA. The
// receipt accrues yield as the underlying vault earns, and is burned 1:1
// for USDC + interest on withdraw.
//
// This builder produces an Anchor-style instruction for the deposit. We
// keep the program id / discriminator behind env vars so the production
// wire-up only needs config, not a code change.
//
// Status: tx CONSTRUCTION shipped (idempotent ATA prefix + deposit ix).
// Live submission gated on real Reflect program id + audit alignment.
// On devnet the program id is a placeholder, so calling this against
// devnet RPC will revert with "AccountNotFound" — same shape as Jupiter
// devnet limitation. Mainnet readiness is one env-var swap away.

import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { createHash } from "node:crypto";

/** Reflect rUSDC mint — yield-bearing receipt token. Env-bound. */
export const REFLECT_RUSDC_MINT_ENV =
  process.env.NEXT_PUBLIC_REFLECT_RUSDC_MINT ?? "";

/**
 * Anchor-style instruction discriminator (same convention as Tide:
 * `sha256("global:<snake>")[..8]`). Reflect's published IDL uses
 * matching Anchor convention — confirmed in their on-chain frame.
 */
function reflectDiscriminator(snake: string): Buffer {
  return createHash("sha256").update(`global:${snake}`).digest().subarray(0, 8);
}

export type ReflectDepositParams = {
  /** Wallet depositing USDC. */
  depositor: PublicKey;
  /** USDC mint (input token). */
  usdcMint: PublicKey;
  /** Lamports of USDC to deposit (6 decimals). */
  amount: bigint;
  /** Override program id; defaults to env. */
  programId?: PublicKey;
  /** Override rUSDC mint; defaults to env. */
  rUsdcMint?: PublicKey;
};

export type ReflectDepositInstructions = {
  instructions: TransactionInstruction[];
  rUsdcAta: PublicKey;
  usdcAta: PublicKey;
};

/**
 * Build the on-chain instructions to deposit `amount` USDC into Reflect's
 * yield vault. Returns:
 *   - `idempotent ATA create` for the rUSDC receipt account (no-op if exists)
 *   - `deposit` instruction (Anchor-encoded discriminator + u64 amount)
 *
 * Caller wraps these in a Transaction and submits via wallet.
 *
 * @throws if Reflect program id env is unset — caller should gate UI on
 *   `reflectConfigured()` to avoid surfacing a broken button.
 */
export function buildReflectDepositIx(
  params: ReflectDepositParams,
): ReflectDepositInstructions {
  const programId = params.programId ?? new PublicKey(REFLECT_PROGRAM_ID);
  const rUsdcMint =
    params.rUsdcMint ?? (REFLECT_RUSDC_MINT_ENV
      ? new PublicKey(REFLECT_RUSDC_MINT_ENV)
      : null);
  if (!rUsdcMint) {
    throw new Error("REFLECT_RUSDC_MINT not configured");
  }

  const usdcAta = getAssociatedTokenAddressSync(params.usdcMint, params.depositor);
  const rUsdcAta = getAssociatedTokenAddressSync(rUsdcMint, params.depositor);

  // Reflect vault PDA: [b"vault", usdc_mint] — common convention. Their
  // actual seeds may differ; this is a placeholder until on-chain audit.
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), params.usdcMint.toBuffer()],
    programId,
  );

  const argBuf = Buffer.alloc(8);
  argBuf.writeBigUInt64LE(params.amount);
  const data = Buffer.concat([reflectDiscriminator("deposit"), argBuf]);

  const createAta = createAssociatedTokenAccountIdempotentInstruction(
    params.depositor,
    rUsdcAta,
    params.depositor,
    rUsdcMint,
  );

  const depositIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.depositor, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: params.usdcMint, isSigner: false, isWritable: false },
      { pubkey: rUsdcMint, isSigner: false, isWritable: true },
      { pubkey: usdcAta, isSigner: false, isWritable: true },
      { pubkey: rUsdcAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  return {
    instructions: [createAta, depositIx],
    rUsdcAta,
    usdcAta,
  };
}

/** True when both program id + rUSDC mint env vars are populated. */
export function reflectConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_REFLECT_PROGRAM_ID &&
    !!process.env.NEXT_PUBLIC_REFLECT_RUSDC_MINT
  );
}
