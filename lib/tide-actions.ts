/**
 * Raw transaction builders for Tide on-chain actions.
 *
 * We bypass Anchor's `Program<T>` abstraction here because IDL generation
 * via `anchor build` requires Solana platform-tools which need Windows
 * Developer Mode (cargo-build-sbf cannot create symlinks otherwise).
 *
 * Each builder hand-encodes:
 *   1. Anchor instruction discriminator: sha256("global:<snake_name>")[..8]
 *   2. Borsh-serialized args (u64 = 8 bytes LE, u16 = 2 bytes LE, [u8;N] = raw)
 *
 * Once `anchor build` works locally and `target/idl/tide.json` exists, this
 * file can be deleted in favor of `program.methods.<name>().rpc()`.
 */

import { sha256 } from "@noble/hashes/sha256";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Signer,
} from "@solana/web3.js";

import {
  TIDE_PROGRAM_ID,
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
  CURRENT_NETWORK,
  SOL_MINT,
} from "./constants";
import { findDcaPositionPda, findPoolPda, findWindowPda } from "./anchor-client";

/** Anchor instruction discriminator: first 8 bytes of sha256("global:<name>"). */
function discriminator(snakeName: string): Buffer {
  const hash = sha256(new TextEncoder().encode(`global:${snakeName}`));
  return Buffer.from(hash.slice(0, 8));
}

const USDC_MINT =
  CURRENT_NETWORK === "mainnet" ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;

/** Wallet shape we accept — matches @solana/wallet-adapter-react's WalletContextState subset. */
export interface SignerWallet {
  publicKey: PublicKey | null;
  signTransaction?: <T extends Transaction>(tx: T) => Promise<T>;
  sendTransaction?: (
    tx: Transaction,
    connection: Connection,
    options?: { signers?: Signer[] },
  ) => Promise<string>;
}

export type SetupDcaParams = {
  amountPerWindowUsdc: number; // human-readable USDC (will convert to 6-decimal lamports)
  maxSlippageBps: number;
};

export type SubmitResult =
  | { ok: true; signature: string; poolPda: PublicKey; positionPda: PublicKey }
  | { ok: false; error: string };

/**
 * Submit setup_dca_position instruction.
 *
 * Pre-conditions:
 * - Pool for (USDC, target_mint=SOL) must already exist on chain. If not,
 *   admin must run init_pool first (separate flow / admin script).
 *
 * Returns transaction signature on success.
 */
export async function submitSetupDcaPosition(
  connection: Connection,
  wallet: SignerWallet,
  params: SetupDcaParams,
): Promise<SubmitResult> {
  if (!wallet.publicKey) {
    return { ok: false, error: "Wallet not connected" };
  }
  if (!wallet.sendTransaction) {
    return { ok: false, error: "Wallet does not support sendTransaction" };
  }

  const owner = wallet.publicKey;
  const [poolPda] = findPoolPda(USDC_MINT, SOL_MINT);
  const [positionPda] = findDcaPositionPda(owner, poolPda);

  // Encode args: u64 (amount_per_window) + u16 (max_slippage_bps)
  const amountLamports = BigInt(Math.round(params.amountPerWindowUsdc * 1_000_000));
  const argBuf = Buffer.alloc(10);
  argBuf.writeBigUInt64LE(amountLamports, 0);
  argBuf.writeUInt16LE(params.maxSlippageBps, 8);

  const data = Buffer.concat([discriminator("setup_dca_position"), argBuf]);

  const ix = new TransactionInstruction({
    programId: TIDE_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: poolPda, isSigner: false, isWritable: false },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }))
    .add(ix);

  try {
    const signature = await wallet.sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");
    return { ok: true, signature, poolPda, positionPda };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Submit commit_intent. Requires an open Window already exists for the pool.
 *
 * Currently builder-only — does NOT include token transfer accounts (escrow
 * setup) so this will fail on chain until we wire SPL associated token PDAs.
 * Tracked as TODO for the demo pivot.
 */
export async function submitCommitIntent(
  _connection: Connection,
  _wallet: SignerWallet,
  _params: { encryptedIntentHash: Uint8Array; amountUsdc: number },
): Promise<SubmitResult> {
  return {
    ok: false,
    error:
      "commit_intent wiring pending — needs SPL ATA derivation + escrow account list. See lib/tide-actions.ts TODO.",
  };
}

/** Compute the next window PDA from a pool's current `windowCounter` field. */
export function nextWindowPda(poolPda: PublicKey, currentCounter: bigint) {
  return findWindowPda(poolPda, currentCounter);
}
