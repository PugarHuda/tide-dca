/**
 * Anchor program client wrapper for Tide.
 *
 * Provides:
 * - getProgram(provider) — typed Program instance
 * - PDA derivation helpers (pool, position, window, intent, escrow)
 * - Account fetch helpers
 *
 * TODO when IDL generated:
 * - Import Program type from `target/types/tide.ts`
 * - Replace `any` with proper types
 */

import { type AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import {
  TIDE_PROGRAM_ID,
  SEED_POOL,
  SEED_DCA_POSITION,
  SEED_WINDOW,
  SEED_INTENT,
  SEED_ESCROW,
} from "./constants";

/** Get typed Tide program instance. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTideProgram(provider: AnchorProvider): Program<any> {
  // TODO: import IDL from `target/idl/tide.json` after first `anchor build`
  // const idl = require("../target/idl/tide.json");
  // return new Program(idl, provider);
  throw new Error(
    "IDL not yet generated. Run `anchor build` first, then update this file to import target/idl/tide.json",
  );
}

// ─── PDA derivation helpers ───

export function findPoolPda(
  inputMint: PublicKey,
  targetMint: PublicKey,
  programId = TIDE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_POOL), inputMint.toBuffer(), targetMint.toBuffer()],
    programId,
  );
}

export function findDcaPositionPda(
  owner: PublicKey,
  pool: PublicKey,
  programId = TIDE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_DCA_POSITION), owner.toBuffer(), pool.toBuffer()],
    programId,
  );
}

export function findWindowPda(
  pool: PublicKey,
  windowNumber: bigint,
  programId = TIDE_PROGRAM_ID,
): [PublicKey, number] {
  // window_number serialized as little-endian 8 bytes
  const numberBuf = Buffer.alloc(8);
  numberBuf.writeBigUInt64LE(windowNumber);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_WINDOW), pool.toBuffer(), numberBuf],
    programId,
  );
}

export function findIntentPda(
  window: PublicKey,
  owner: PublicKey,
  programId = TIDE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_INTENT), window.toBuffer(), owner.toBuffer()],
    programId,
  );
}

export function findEscrowPda(
  window: PublicKey,
  programId = TIDE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_ESCROW), window.toBuffer()],
    programId,
  );
}

export function findEscrowAuthorityPda(
  window: PublicKey,
  programId = TIDE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_ESCROW), window.toBuffer(), Buffer.from("authority")],
    programId,
  );
}
