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
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type Signer,
} from "@solana/web3.js";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import {
  TIDE_PROGRAM_ID,
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
  CURRENT_NETWORK,
  SOL_MINT,
} from "./constants";
import {
  findDcaPositionPda,
  findEscrowAuthorityPda,
  findIntentPda,
  findPoolPda,
  findWindowPda,
} from "./anchor-client";
import { fetchQuote, fetchSwapInstructions } from "./jupiter";

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
  signTransaction?: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  sendTransaction?: (
    tx: Transaction | VersionedTransaction,
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

// ─── Admin: init_pool ────────────────────────────────────────────────────────
//
// One-time call per (input_mint, target_mint) pair. Defaults below match the
// constants used elsewhere in the app: USDC -> SOL, 1-hour windows, 100 USDC
// minimum aggregate, 5 bps protocol fee.

export type InitPoolParams = {
  targetMint?: PublicKey;
  windowDurationSeconds?: number; // default 3600
  minPoolSizeUsdc?: number;       // human-readable USDC; default 100
  feeBps?: number;                // default 5
};

export async function submitInitPool(
  connection: Connection,
  wallet: SignerWallet,
  params: InitPoolParams = {},
): Promise<SubmitResult> {
  if (!wallet.publicKey) return { ok: false, error: "Wallet not connected" };
  if (!wallet.sendTransaction) return { ok: false, error: "Wallet does not support sendTransaction" };

  const targetMint = params.targetMint ?? SOL_MINT;
  const windowDurationSeconds = BigInt(params.windowDurationSeconds ?? 3600);
  const minPoolSizeUsdc = BigInt(Math.round((params.minPoolSizeUsdc ?? 100) * 1_000_000));
  const feeBps = params.feeBps ?? 5;

  const authority = wallet.publicKey;
  const [poolPda] = findPoolPda(USDC_MINT, targetMint);

  // Args: target_mint (32) + window_duration (i64, 8) + min_pool_size (u64, 8) + fee_bps (u16, 2)
  const argBuf = Buffer.alloc(50);
  targetMint.toBuffer().copy(argBuf, 0);
  argBuf.writeBigInt64LE(windowDurationSeconds, 32);
  argBuf.writeBigUInt64LE(minPoolSizeUsdc, 40);
  argBuf.writeUInt16LE(feeBps, 48);

  const data = Buffer.concat([discriminator("init_pool"), argBuf]);

  const ix = new TransactionInstruction({
    programId: TIDE_PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: poolPda, isSigner: false, isWritable: true },
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
    return { ok: true, signature, poolPda, positionPda: poolPda };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Admin/cron: init_window ─────────────────────────────────────────────────
//
// Permissionless. Caller must pass the current `windowCounter` so we can
// derive the next Window PDA — read it from a `usePool()`-fed Pool account.

export async function submitInitWindow(
  connection: Connection,
  wallet: SignerWallet,
  poolPda: PublicKey,
  currentWindowCounter: bigint,
): Promise<SubmitResult> {
  if (!wallet.publicKey) return { ok: false, error: "Wallet not connected" };
  if (!wallet.sendTransaction) return { ok: false, error: "Wallet does not support sendTransaction" };

  const caller = wallet.publicKey;
  const [windowPda] = findWindowPda(poolPda, currentWindowCounter);

  const data = discriminator("init_window");

  const ix = new TransactionInstruction({
    programId: TIDE_PROGRAM_ID,
    keys: [
      { pubkey: caller, isSigner: true, isWritable: true },
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: windowPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }))
    .add(ix);

  try {
    const signature = await wallet.sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");
    return { ok: true, signature, poolPda, positionPda: windowPda };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── User: claim_allocation ──────────────────────────────────────────────────
//
// Pulls user's pro-rata wrapped-SOL share out of the window's output escrow
// into their own wSOL ATA. Atomically prepends an idempotent ATA-create so
// first-time claimers don't fail with "Account does not exist".
//
// Caller must already know the Window PDA + window_number — useCurrentWindow()
// in the dashboard already exposes both.

export type ClaimAllocationParams = {
  poolPda: PublicKey;
  windowPda: PublicKey;
  windowNumber: bigint;
  /** Target token mint. Defaults to wrapped SOL. */
  targetMint?: PublicKey;
};

export async function submitClaimAllocation(
  connection: Connection,
  wallet: SignerWallet,
  params: ClaimAllocationParams,
): Promise<SubmitResult> {
  if (!wallet.publicKey) return { ok: false, error: "Wallet not connected" };
  if (!wallet.sendTransaction) return { ok: false, error: "Wallet does not support sendTransaction" };

  const owner = wallet.publicKey;
  const targetMint = params.targetMint ?? SOL_MINT;

  const [intentPda] = findIntentPda(params.windowPda, owner);
  const [positionPda] = findDcaPositionPda(owner, params.poolPda);
  const [escrowAuthority] = findEscrowAuthorityPda(params.windowPda);

  // Output escrow + user output are both standard ATAs now.
  const escrowOutputAta = getAssociatedTokenAddressSync(targetMint, escrowAuthority, true);
  const ownerOutputAta = getAssociatedTokenAddressSync(targetMint, owner);

  // Prepend idempotent ATA create — no-op if already exists.
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    owner,
    ownerOutputAta,
    owner,
    targetMint,
  );

  const claimIx = new TransactionInstruction({
    programId: TIDE_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: targetMint, isSigner: false, isWritable: false },
      { pubkey: intentPda, isSigner: false, isWritable: true },
      { pubkey: params.windowPda, isSigner: false, isWritable: false },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: escrowOutputAta, isSigner: false, isWritable: true },
      { pubkey: escrowAuthority, isSigner: false, isWritable: false },
      { pubkey: ownerOutputAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: discriminator("claim_allocation"),
  });

  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }))
    .add(createAtaIx)
    .add(claimIx);

  try {
    const signature = await wallet.sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");
    return { ok: true, signature, poolPda: params.poolPda, positionPda };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Operator: trigger_aggregate ─────────────────────────────────────────────
//
// Permissionless. Flips current window from status 0 (Open) to status 1
// (Aggregating) once the window has expired and the aggregate threshold is
// met. Required precondition for execute_swap.

export async function submitTriggerAggregate(
  connection: Connection,
  wallet: SignerWallet,
  poolPda: PublicKey,
  windowPda: PublicKey,
): Promise<SubmitResult> {
  if (!wallet.publicKey) return { ok: false, error: "Wallet not connected" };
  if (!wallet.sendTransaction) return { ok: false, error: "Wallet does not support sendTransaction" };

  const ix = new TransactionInstruction({
    programId: TIDE_PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: poolPda, isSigner: false, isWritable: false },
      { pubkey: windowPda, isSigner: false, isWritable: true },
    ],
    data: discriminator("trigger_aggregate"),
  });

  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }))
    .add(ix);

  try {
    const signature = await wallet.sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");
    return { ok: true, signature, poolPda, positionPda: windowPda };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Operator: execute_swap (Jupiter CPI passthrough) ───────────────────────
//
// Off-chain: fetch a Jupiter swap-instructions response with userPublicKey =
// escrow_authority and destinationTokenAccount = escrow_output_ata. The
// returned `swapInstruction` is what we forward as remaining_accounts +
// jupiter_route_data — Anchor then invoke_signed's it under the
// escrow_authority PDA.
//
// We send as a v0 VersionedTransaction with Jupiter's address lookup tables
// resolved on the client. Without ALTs, multi-hop Jupiter routes blow past
// the legacy ~35-pubkey limit. With ALTs, references to common accounts
// (token programs, AMM pools, ATA program, etc.) collapse to 1-byte indices.

export type ExecuteSwapParams = {
  poolPda: PublicKey;
  windowPda: PublicKey;
  windowNumber: bigint;
  totalCommittedUsdc: bigint;
  /** User-asserted floor for tokens received. */
  minAcquiredAmount: bigint;
  /** Slippage tolerance in bps for the Jupiter quote. */
  slippageBps?: number;
  targetMint?: PublicKey;
};

export async function submitExecuteSwap(
  connection: Connection,
  wallet: SignerWallet,
  params: ExecuteSwapParams,
): Promise<SubmitResult> {
  if (!wallet.publicKey) return { ok: false, error: "Wallet not connected" };
  if (!wallet.sendTransaction) return { ok: false, error: "Wallet does not support sendTransaction" };

  const caller = wallet.publicKey;
  const targetMint = params.targetMint ?? SOL_MINT;
  const slippageBps = params.slippageBps ?? 50;

  const [escrowAuthority] = findEscrowAuthorityPda(params.windowPda);
  const escrowInputAta = getAssociatedTokenAddressSync(USDC_MINT, escrowAuthority, true);
  const escrowOutputAta = getAssociatedTokenAddressSync(targetMint, escrowAuthority, true);

  // 1. Fetch Jupiter quote — ExactIn with escrow's full USDC balance.
  //    No onlyDirectRoutes restriction now that we send as v0 + ALT.
  let quote;
  try {
    quote = await fetchQuote({
      inputMint: USDC_MINT,
      outputMint: targetMint,
      amount: params.totalCommittedUsdc,
      slippageBps,
    });
  } catch (err) {
    return {
      ok: false,
      error: `Jupiter quote failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 2. Fetch raw swap instructions + the Jupiter-curated lookup tables.
  let jupiterIx;
  let lookupTableAddresses: string[] = [];
  try {
    const swapResponse = await fetchSwapInstructions(quote, escrowAuthority, {
      destinationTokenAccount: escrowOutputAta,
    });
    jupiterIx = swapResponse.swapInstruction;
    lookupTableAddresses = swapResponse.addressLookupTableAddresses ?? [];
  } catch (err) {
    return {
      ok: false,
      error: `Jupiter swap-instructions failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 3. Resolve ALT pubkeys to AddressLookupTableAccount instances on the wire.
  //    getAddressLookupTable resolves cluster-wide; null means table doesn't
  //    exist on this cluster (devnet vs mainnet drift is the usual cause).
  const lookupTables: AddressLookupTableAccount[] = [];
  for (const addr of lookupTableAddresses) {
    try {
      const res = await connection.getAddressLookupTable(new PublicKey(addr));
      if (res.value) lookupTables.push(res.value);
    } catch {
      // Soft-fail per ALT — Jupiter sometimes returns mainnet ALT addresses
      // even when quoted from devnet API. Skipping a missing one is OK as
      // long as the route's accounts are still resolvable inline.
    }
  }

  // 4. Build execute_swap data: discriminator + Vec<u8> (route data) + u64 (min_acquired)
  //    Borsh Vec<u8> = u32 length prefix + bytes.
  const routeDataBytes = Buffer.from(jupiterIx.data, "base64");
  const argBuf = Buffer.alloc(4 + routeDataBytes.length + 8);
  argBuf.writeUInt32LE(routeDataBytes.length, 0);
  routeDataBytes.copy(argBuf, 4);
  argBuf.writeBigUInt64LE(params.minAcquiredAmount, 4 + routeDataBytes.length);

  const data = Buffer.concat([discriminator("execute_swap"), argBuf]);

  // 5. Map Jupiter accounts to our remaining_accounts (preserving flags).
  const jupiterRemaining = jupiterIx.accounts.map((a) => ({
    pubkey: new PublicKey(a.pubkey),
    isSigner: a.isSigner,
    isWritable: a.isWritable,
  }));

  // 6. Fixed accounts in ExecuteSwap struct order.
  const fixedKeys = [
    { pubkey: caller, isSigner: true, isWritable: true },
    { pubkey: params.poolPda, isSigner: false, isWritable: true },
    { pubkey: params.windowPda, isSigner: false, isWritable: true },
    { pubkey: USDC_MINT, isSigner: false, isWritable: false },
    { pubkey: targetMint, isSigner: false, isWritable: false },
    { pubkey: escrowAuthority, isSigner: false, isWritable: false },
    { pubkey: escrowInputAta, isSigner: false, isWritable: true },
    { pubkey: escrowOutputAta, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(jupiterIx.programId), isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  const tideIx = new TransactionInstruction({
    programId: TIDE_PROGRAM_ID,
    keys: [...fixedKeys, ...jupiterRemaining],
    data,
  });

  // 7. Compile to v0 message with Jupiter's lookup tables.
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: caller,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
      tideIx,
    ],
  }).compileToV0Message(lookupTables);

  const tx = new VersionedTransaction(message);

  try {
    const signature = await wallet.sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");
    return { ok: true, signature, poolPda: params.poolPda, positionPda: params.windowPda };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
