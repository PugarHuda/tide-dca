// Tide E2E lifecycle smoke test driven from CLI.
// Runs init_pool → init_window → setup_dca → commit → wait → trigger →
// execute_swap → claim against devnet using Fvys keypair as the sole user.
//
// Usage (per phase, idempotent — skips if state already advanced):
//   node scripts/qa-e2e.mjs init      → init_pool + init_window
//   node scripts/qa-e2e.mjs setup     → setup_dca_position
//   node scripts/qa-e2e.mjs commit    → commit_intent ($10)
//   node scripts/qa-e2e.mjs aggregate → trigger_aggregate (after window expiry)
//   node scripts/qa-e2e.mjs swap      → execute_swap (Jupiter CPI, may fail on devnet)
//   node scripts/qa-e2e.mjs claim     → claim_allocation
//   node scripts/qa-e2e.mjs status    → just report current state

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg");
const USDC_MINT = new PublicKey("BKQ9HAzw2rnfUXpm6BKz2yvH4ikwKhC8dkgt73A8LTSh");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

const conn = new Connection(RPC, "confirmed");

// Load Fvys keypair from default Solana CLI location.
function loadKeypair() {
  const p = path.join(os.homedir(), ".config", "solana", "id.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

const wallet = loadKeypair();
const owner = wallet.publicKey;

// ─── Helpers ───────────────────────────────────────────────────────────────
const enc = new TextEncoder();
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const info = (m) => console.log(`    ${m}`);
const section = (t) => console.log(`\n\x1b[36m━━ ${t}\x1b[0m`);

function discriminator(snakeName) {
  return createHash("sha256").update(`global:${snakeName}`).digest().subarray(0, 8);
}

function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

const [poolPda] = pda([enc.encode("pool"), USDC_MINT.toBuffer(), SOL_MINT.toBuffer()]);
const [positionPda] = pda([enc.encode("dca-position"), owner.toBuffer(), poolPda.toBuffer()]);

function findWindowPda(counter) {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64LE(BigInt(counter));
  return pda([enc.encode("window"), poolPda.toBuffer(), counterBuf])[0];
}
function findIntentPda(windowPubkey) {
  return pda([enc.encode("intent"), windowPubkey.toBuffer(), owner.toBuffer()])[0];
}
function findEscrowAuthorityPda(windowPubkey) {
  // Seeds: [b"escrow", window, b"authority"] — must match programs/tide
  return pda([enc.encode("escrow"), windowPubkey.toBuffer(), enc.encode("authority")])[0];
}

async function send(tx, label) {
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;
  tx.sign(wallet);
  const sim = await conn.simulateTransaction(tx);
  if (sim.value.err) {
    console.error("\nSimulation failed:");
    console.error(JSON.stringify(sim.value.err));
    if (sim.value.logs) {
      console.error("\nLogs:");
      sim.value.logs.forEach((l) => console.error("  " + l));
    }
    throw new Error(`${label} simulation failed`);
  }
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}

// ─── Account decoders (match programs/tide/src/state.rs) ──────────────────
function decodePool(data) {
  // programs/tide/src/state.rs Pool field order
  let o = 8;
  const authority = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const inputMint = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const targetMint = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const windowDuration = data.readBigInt64LE(o); o += 8;
  const minPoolSize = data.readBigUInt64LE(o); o += 8;
  const feeBps = data.readUInt16LE(o); o += 2;
  const totalVolume = data.readBigUInt64LE(o); o += 8;
  const totalSavings = data.readBigUInt64LE(o); o += 8;
  const activeWindow = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const windowCounter = data.readBigUInt64LE(o); o += 8;
  return { authority, inputMint, targetMint, activeWindow, windowCounter, windowDuration, minPoolSize, feeBps, totalVolume, totalSavings };
}
function decodeWindow(data) {
  // programs/tide/src/state.rs Window field order
  let o = 8;
  const pool = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const windowNumber = data.readBigUInt64LE(o); o += 8;
  const startTs = data.readBigInt64LE(o); o += 8;
  const endTs = data.readBigInt64LE(o); o += 8;
  const status = data.readUInt8(o); o += 1;
  const intentCount = data.readUInt32LE(o); o += 4;
  const totalCommitted = data.readBigUInt64LE(o); o += 8;
  o += 32; // aggregate_result_hash
  const acquired = data.readBigUInt64LE(o); o += 8;
  const slippageBps = data.readUInt16LE(o); o += 2;
  return { pool, windowNumber, status, startTs, endTs, totalCommitted, intentCount, acquired, slippageBps };
}
const STATUS = ["Open", "Aggregating", "Distributed", "Failed"];

async function getPool() {
  const a = await conn.getAccountInfo(poolPda);
  return a ? decodePool(a.data) : null;
}
async function getWindow(windowPubkey) {
  const a = await conn.getAccountInfo(windowPubkey);
  return a ? decodeWindow(a.data) : null;
}

// ─── Encryption stub matching lib/arcium.ts encryptIntent ────────────────
function encryptIntent({ amount, maxSlippageBps, userPubkey, windowPubkey }) {
  const nullifierData = enc.encode(`tide:nullifier:${userPubkey}:${windowPubkey}`);
  const nullifier = createHash("sha256").update(nullifierData).digest();
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(BigInt(amount));
  const slippageBuf = Buffer.alloc(2);
  slippageBuf.writeUInt16LE(maxSlippageBps);
  const combined = Buffer.concat([nullifier, amountBuf, slippageBuf]);
  return createHash("sha256").update(combined).digest();
}

// ─── Commands ─────────────────────────────────────────────────────────────

async function cmdStatus() {
  section("Wallet");
  info(`Pubkey: ${owner.toBase58()}`);
  const sol = await conn.getBalance(owner);
  info(`SOL: ${(sol / 1e9).toFixed(6)}`);
  const ownerAta = getAssociatedTokenAddressSync(USDC_MINT, owner);
  try {
    const bal = await conn.getTokenAccountBalance(ownerAta);
    info(`USDC: ${bal.value.uiAmount}`);
  } catch {
    info(`USDC ATA: not yet created`);
  }

  section("Pool");
  info(`Pool PDA: ${poolPda.toBase58()}`);
  const pool = await getPool();
  if (!pool) {
    warn(`Pool NOT initialized`);
    return;
  }
  ok(`Pool initialized`);
  info(`Authority:        ${pool.authority.toBase58()}`);
  info(`Window counter:   ${pool.windowCounter.toString()}`);
  info(`Window duration:  ${Number(pool.windowDuration)}s`);
  info(`Min pool size:    ${(Number(pool.minPoolSize) / 1e6).toFixed(2)} USDC`);
  info(`Total volume:     ${(Number(pool.totalVolume) / 1e6).toFixed(2)} USDC`);

  if (!pool.activeWindow.equals(PublicKey.default)) {
    section("Active window");
    const w = await getWindow(pool.activeWindow);
    if (w) {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Number(w.endTs) - now;
      info(`Window PDA:       ${pool.activeWindow.toBase58()}`);
      info(`Number:           #${w.windowNumber.toString()}`);
      info(`Status:           ${STATUS[w.status]}`);
      info(`Time remaining:   ${remaining > 0 ? `${Math.floor(remaining/60)}m ${remaining%60}s` : `EXPIRED ${-remaining}s ago`}`);
      info(`Committed:        ${(Number(w.totalCommitted) / 1e6).toFixed(2)} USDC`);
      info(`Intent count:     ${w.intentCount}`);
      info(`Acquired SOL:     ${(Number(w.acquired) / 1e9).toFixed(6)}`);
    }
  }

  section("My position");
  const posAccount = await conn.getAccountInfo(positionPda);
  if (posAccount) {
    ok(`Position exists at ${positionPda.toBase58()}`);
  } else {
    warn(`Position NOT yet set up`);
  }
}

async function cmdInit() {
  section("Phase 1: init_pool + init_window");
  const existing = await getPool();
  if (existing) {
    info(`Pool already exists, skipping init_pool. Window counter: ${existing.windowCounter}`);
  } else {
    info(`Initializing pool with 15-min window, $5 min, 5 bps fee...`);
    // Args: target_mint(32) + window_duration(i64,8) + min_pool_size(u64,8) + fee_bps(u16,2)
    const argBuf = Buffer.alloc(50);
    SOL_MINT.toBuffer().copy(argBuf, 0);
    argBuf.writeBigInt64LE(900n, 32);          // 15 min
    argBuf.writeBigUInt64LE(5_000_000n, 40);   // $5 min
    argBuf.writeUInt16LE(5, 48);               // 5 bps
    const data = Buffer.concat([discriminator("init_pool"), argBuf]);
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const tx = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }))
      .add(ix);
    const sig = await send(tx, "init_pool");
    ok(`init_pool confirmed: ${sig}`);
  }

  // init_window
  const pool2 = await getPool();
  if (!pool2) throw new Error("Pool still missing after init_pool");
  const counter = pool2.windowCounter;
  const windowPda = findWindowPda(counter);
  const wAcct = await conn.getAccountInfo(windowPda);
  if (wAcct) {
    info(`Window #${counter} already exists at ${windowPda.toBase58()}, skipping init_window`);
  } else {
    info(`Initializing window #${counter}...`);
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: poolPda, isSigner: false, isWritable: true },
        { pubkey: windowPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator("init_window"),
    });
    const tx = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }))
      .add(ix);
    const sig = await send(tx, "init_window");
    ok(`init_window confirmed: ${sig}`);
  }
}

async function cmdSetup() {
  section("Phase 2: setup_dca_position");
  const exists = await conn.getAccountInfo(positionPda);
  if (exists) {
    info(`Position already exists, skipping setup`);
    return;
  }
  // Args: amount_per_window(u64,8) + max_slippage_bps(u16,2)
  const argBuf = Buffer.alloc(10);
  argBuf.writeBigUInt64LE(10_000_000n, 0); // $10 per window
  argBuf.writeUInt16LE(100, 8);             // 1% slippage
  const data = Buffer.concat([discriminator("setup_dca_position"), argBuf]);
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
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
  const sig = await send(tx, "setup_dca");
  ok(`setup_dca_position confirmed: ${sig}`);
}

async function cmdCommit() {
  section("Phase 3: commit_intent ($10)");
  const pool = await getPool();
  if (!pool) throw new Error("Pool not initialized");
  const windowPda = pool.activeWindow;
  if (windowPda.equals(PublicKey.default)) throw new Error("No active window");
  const win = await getWindow(windowPda);
  if (!win) throw new Error("Window account missing");
  if (win.status !== 0) throw new Error(`Window not Open (status=${STATUS[win.status]})`);

  const intentPda = findIntentPda(windowPda);
  const existing = await conn.getAccountInfo(intentPda);
  if (existing) {
    info(`Intent already committed, skipping`);
    return;
  }

  const escrowAuthority = findEscrowAuthorityPda(windowPda);
  const ownerInputAta = getAssociatedTokenAddressSync(USDC_MINT, owner);
  const escrowInputAta = getAssociatedTokenAddressSync(USDC_MINT, escrowAuthority, true);

  const intentHash = encryptIntent({
    amount: 10_000_000n,
    maxSlippageBps: 100,
    userPubkey: owner.toBase58(),
    windowPubkey: windowPda.toBase58(),
  });

  const argBuf = Buffer.alloc(40);
  intentHash.copy(argBuf, 0);
  argBuf.writeBigUInt64LE(10_000_000n, 32);
  const data = Buffer.concat([discriminator("commit_intent"), argBuf]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: false },
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: windowPda, isSigner: false, isWritable: true },
      { pubkey: intentPda, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: ownerInputAta, isSigner: false, isWritable: true },
      { pubkey: escrowAuthority, isSigner: false, isWritable: false },
      { pubkey: escrowInputAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }))
    .add(ix);
  const sig = await send(tx, "commit_intent");
  ok(`commit_intent confirmed: ${sig}`);
}

async function cmdAggregate() {
  section("Phase 4: trigger_aggregate");
  const pool = await getPool();
  if (!pool) throw new Error("Pool not initialized");
  const windowPda = pool.activeWindow;
  const win = await getWindow(windowPda);
  if (!win) throw new Error("Window missing");
  const now = Math.floor(Date.now() / 1000);
  const remaining = Number(win.endTs) - now;
  if (remaining > 0) {
    fail(`Window not yet expired (${Math.floor(remaining/60)}m ${remaining%60}s remaining)`);
    return;
  }
  if (win.status !== 0) {
    info(`Window already aggregated (status=${STATUS[win.status]}), skipping`);
    return;
  }
  if (win.totalCommitted < pool.minPoolSize) {
    fail(`Below threshold: ${(Number(win.totalCommitted)/1e6).toFixed(2)} of ${(Number(pool.minPoolSize)/1e6).toFixed(2)} required`);
    return;
  }

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: poolPda, isSigner: false, isWritable: false },
      { pubkey: windowPda, isSigner: false, isWritable: true },
    ],
    data: discriminator("trigger_aggregate"),
  });
  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }))
    .add(ix);
  const sig = await send(tx, "trigger_aggregate");
  ok(`trigger_aggregate confirmed: ${sig}`);
}

async function cmdSwap() {
  section("Phase 5: execute_swap (devnet — sync_native simulated swap)");
  info(`Jupiter v6 quote API has no devnet support. Instead we exercise the`);
  info(`execute_swap ix path via a real SPL Token sync_native CPI:`);
  info(`  1. Pre-fund escrow_output_ata (wSOL) with native SOL lamports`);
  info(`  2. CPI sync_native → updates token amount to match lamports`);
  info(`This validates: PDA signing, status transition, slippage check,`);
  info(`tokens_acquired persistence, total_volume accumulation. The only`);
  info(`difference vs mainnet is *who* puts wSOL in the output ATA — Jupiter`);
  info(`vs us topping up. Anchor doesn't care, the lifecycle proceeds.`);

  const pool = await getPool();
  if (!pool) throw new Error("Pool missing");
  const windowPda = pool.activeWindow;
  // After init_window #1, active_window points at #1, but window #0 is what
  // we want to settle (it's in Aggregating). Find it:
  const w0Pda = findWindowPda(0n);
  const win = await getWindow(w0Pda);
  if (!win) throw new Error("Window #0 missing");
  if (win.status !== 1) {
    warn(`Window #0 status = ${STATUS[win.status]} (expected Aggregating). Skipping.`);
    return;
  }

  const escrowAuthority = findEscrowAuthorityPda(w0Pda);
  const escrowInputAta = getAssociatedTokenAddressSync(USDC_MINT, escrowAuthority, true);
  const escrowOutputAta = getAssociatedTokenAddressSync(SOL_MINT, escrowAuthority, true);

  // Tx 1: create output ATA (idempotent) + fund with native lamports
  info(``);
  info(`tx 1: create wSOL ATA + transfer 10,000,000 lamports (0.01 SOL)`);
  const fundTx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }))
    .add(createAssociatedTokenAccountIdempotentInstruction(
      owner, escrowOutputAta, escrowAuthority, SOL_MINT,
    ))
    .add(SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: escrowOutputAta,
      lamports: 10_000_000,
    }));
  const fundSig = await send(fundTx, "fund_output_ata");
  ok(`Funded output ATA: ${fundSig}`);

  // Tx 2: execute_swap with jupiter_program = TOKEN_PROGRAM_ID + route_data = sync_native
  info(``);
  info(`tx 2: execute_swap → CPI SPL sync_native (PDA-signed)`);

  // Borsh args: Vec<u8> route_data (1 byte = 17 for SyncNative) + u64 min_acquired
  const routeData = Buffer.from([17]); // SPL Token instruction 17 = SyncNative
  const argBuf = Buffer.alloc(4 + routeData.length + 8);
  argBuf.writeUInt32LE(routeData.length, 0);
  routeData.copy(argBuf, 4);
  argBuf.writeBigUInt64LE(1n, 4 + routeData.length); // min_acquired = 1 lamport
  const data = Buffer.concat([discriminator("execute_swap"), argBuf]);

  // Fixed accounts (matches programs/tide/src/instructions/execute_swap.rs)
  const fixedKeys = [
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: poolPda, isSigner: false, isWritable: true },
    { pubkey: w0Pda, isSigner: false, isWritable: true },
    { pubkey: USDC_MINT, isSigner: false, isWritable: false },
    { pubkey: SOL_MINT, isSigner: false, isWritable: false },
    { pubkey: escrowAuthority, isSigner: false, isWritable: false },
    { pubkey: escrowInputAta, isSigner: false, isWritable: true },
    { pubkey: escrowOutputAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // jupiter_program = SPL Token
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];

  // remaining_accounts: SyncNative ix expects [wsol_ata]
  const remainingKeys = [
    { pubkey: escrowOutputAta, isSigner: false, isWritable: true },
  ];

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [...fixedKeys, ...remainingKeys],
    data,
  });

  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
    .add(ix);

  const sig = await send(tx, "execute_swap");
  ok(`execute_swap confirmed: ${sig}`);
}

async function cmdClaim() {
  section("Phase 6: claim_allocation");
  const pool = await getPool();
  if (!pool) throw new Error("Pool missing");
  const w0Pda = findWindowPda(0n);
  const win = await getWindow(w0Pda);
  if (!win) throw new Error("Window #0 missing");
  if (win.status !== 2) {
    warn(`Window #0 status = ${STATUS[win.status]} (expected Distributed). Run 'swap' first.`);
    return;
  }

  const intentPda = findIntentPda(w0Pda);
  const escrowAuthority = findEscrowAuthorityPda(w0Pda);
  const escrowOutputAta = getAssociatedTokenAddressSync(SOL_MINT, escrowAuthority, true);
  const ownerOutputAta = getAssociatedTokenAddressSync(SOL_MINT, owner);

  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    owner, ownerOutputAta, owner, SOL_MINT,
  );

  const claimIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SOL_MINT, isSigner: false, isWritable: false },
      { pubkey: intentPda, isSigner: false, isWritable: true },
      { pubkey: w0Pda, isSigner: false, isWritable: false },
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

  const sig = await send(tx, "claim_allocation");
  ok(`claim_allocation confirmed: ${sig}`);
}

// ─── Entrypoint ───────────────────────────────────────────────────────────
const cmd = process.argv[2] ?? "status";
const cmds = {
  status: cmdStatus,
  init: cmdInit,
  setup: cmdSetup,
  commit: cmdCommit,
  aggregate: cmdAggregate,
  swap: cmdSwap,
  claim: cmdClaim,
  all: async () => {
    await cmdInit();
    await cmdSetup();
    await cmdCommit();
    await cmdStatus();
  },
};
const fn = cmds[cmd];
if (!fn) {
  console.error(`Unknown command: ${cmd}. Available: ${Object.keys(cmds).join(", ")}`);
  process.exit(1);
}
fn().then(() => process.exit(0)).catch((err) => {
  console.error("\n\x1b[31mError:\x1b[0m", err.message ?? err);
  process.exit(1);
});
