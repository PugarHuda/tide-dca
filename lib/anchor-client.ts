/**
 * PDA derivation helpers for the Tide program.
 *
 * Pure key-derivation only — no Anchor Program instance lives here. Tide's
 * frontend uses raw @solana/web3.js + hand-rolled discriminators in
 * lib/tide-actions.ts, so we never need a typed Program<T>. If IDL access
 * lands later, instantiate it directly from `target/idl/tide.json` at the
 * call site.
 */

import { PublicKey } from "@solana/web3.js";

import {
  TIDE_PROGRAM_ID,
  SEED_POOL,
  SEED_DCA_POSITION,
  SEED_WINDOW,
  SEED_INTENT,
  SEED_ESCROW,
} from "./constants";

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

/**
 * Escrow authority — the only custom PDA in the escrow set. Both input
 * (USDC) and output (target mint) escrows are standard ATAs owned by this
 * authority, so they're derived via @solana/spl-token's
 * getAssociatedTokenAddressSync(mint, authority, true) at the call site.
 */
export function findEscrowAuthorityPda(
  window: PublicKey,
  programId = TIDE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_ESCROW), window.toBuffer(), Buffer.from("authority")],
    programId,
  );
}
