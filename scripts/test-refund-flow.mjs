#!/usr/bin/env node
/**
 * End-to-end test for the new mark_window_failed + refund_intent flow.
 *
 * Preconditions: a Window in Open status with intent_count >= 1 and
 *                threshold met (so trigger_aggregate succeeds).
 *
 * Flow:
 *   1. trigger_aggregate         status: Open(0) → Aggregating(1)
 *   2. mark_window_failed (NEW)  status: Aggregating(1) → Failed(3)
 *   3. refund_intent (NEW)       transfers intent.amount USDC back to user
 *
 * Verifies the new audit-finding fix: previously a stuck Aggregating
 * window orphaned user funds with no recovery path. Now Failed is a
 * reachable terminal state with a working refund instruction.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg");
const USDC_MINT = new PublicKey("BKQ9HAzw2rnfUXpm6BKz2yvH4ikwKhC8dkgt73A8LTSh");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

const conn = new Connection(RPC, "confirmed");
const enc = new TextEncoder();
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`    ${m}`);
const section = (t) => console.log(`\n\x1b[36m━━ ${t}\x1b[0m`);

function disc(name) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}
function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

function loadKeypair() {
  const p = path.join(os.homedir(), ".config", "solana", "id.json");
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8"))),
  );
}

async function send(tx, signer, label) {
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = signer.publicKey;
  tx.sign(signer);
  const sim = await conn.simulateTransaction(tx);
  if (sim.value.err) {
    console.error(`\n${label} simulation failed:`);
    console.error(JSON.stringify(sim.value.err));
    (sim.value.logs ?? []).forEach((l) => console.error("  " + l));
    throw new Error(`${label} simulation failed`);
  }
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}

function decodePool(data) {
  let o = 8;
  const authority = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const inputMint = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const targetMint = new PublicKey(data.subarray(o, o + 32)); o += 32;
  o += 8 + 8 + 2 + 8 + 8;
  const activeWindow = new PublicKey(data.subarray(o, o + 32));
  return { authority, inputMint, targetMint, activeWindow };
}
function decodeWindow(data) {
  let o = 8;
  o += 32; // pool
  const windowNumber = data.readBigUInt64LE(o); o += 8;
  o += 8 + 8; // start, end
  const status = data.readUInt8(o); o += 1;
  const intentCount = data.readUInt32LE(o); o += 4;
  const totalCommitted = data.readBigUInt64LE(o);
  return { windowNumber, status, intentCount, totalCommitted };
}

async function main() {
  const wallet = loadKeypair();
  const owner = wallet.publicKey;
  console.log(`Wallet: ${owner.toBase58()}`);

  const [poolPda] = pda([enc.encode("pool"), USDC_MINT.toBuffer(), SOL_MINT.toBuffer()]);
  const poolAcct = await conn.getAccountInfo(poolPda);
  if (!poolAcct) throw new Error("Pool not initialized");
  const pool = decodePool(poolAcct.data);
  const windowPda = pool.activeWindow;
  const winAcct = await conn.getAccountInfo(windowPda);
  if (!winAcct) throw new Error("Active window not found");
  const win = decodeWindow(winAcct.data);

  section("Initial state");
  info(`Active window:  ${windowPda.toBase58()}`);
  info(`Window number:  #${win.windowNumber.toString()}`);
  info(`Status:         ${["Open", "Aggregating", "Distributed", "Failed"][win.status] ?? win.status}`);
  info(`Intent count:   ${win.intentCount}`);
  info(`Committed USDC: $${(Number(win.totalCommitted) / 1e6).toFixed(2)}`);

  const ownerAta = getAssociatedTokenAddressSync(USDC_MINT, owner);
  const beforeBal = await conn.getTokenAccountBalance(ownerAta).catch(() => ({ value: { amount: "0" } }));
  info(`Wallet USDC before: $${(Number(beforeBal.value.amount) / 1e6).toFixed(2)}`);

  // Phase 1: trigger_aggregate (if needed)
  if (win.status === 0) {
    section("Phase 1: trigger_aggregate");
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: owner, isSigner: true, isWritable: false },
        { pubkey: poolPda, isSigner: false, isWritable: false },
        { pubkey: windowPda, isSigner: false, isWritable: true },
      ],
      data: disc("trigger_aggregate"),
    });
    const sig = await send(new Transaction().add(ix), wallet, "trigger_aggregate");
    ok(`trigger_aggregate confirmed: ${sig}`);
  } else if (win.status === 1) {
    info(`Window already in Aggregating — skipping trigger_aggregate`);
  } else {
    fail(`Window status=${win.status} not eligible for fail/refund test`);
    return;
  }

  // Phase 2: mark_window_failed (NEW)
  section("Phase 2: mark_window_failed (NEW ix)");
  const failIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: poolPda, isSigner: false, isWritable: false },
      { pubkey: windowPda, isSigner: false, isWritable: true },
    ],
    data: disc("mark_window_failed"),
  });
  const failSig = await send(new Transaction().add(failIx), wallet, "mark_window_failed");
  ok(`mark_window_failed confirmed: ${failSig}`);

  // Re-read window to verify status=3
  const winAfterFail = decodeWindow((await conn.getAccountInfo(windowPda)).data);
  if (winAfterFail.status !== 3) {
    fail(`Expected status=3 (Failed), got ${winAfterFail.status}`);
    return;
  }
  ok(`Window status now: Failed (3)`);

  // Phase 3: refund_intent (NEW)
  section("Phase 3: refund_intent (NEW ix)");
  const [intentPda] = pda([enc.encode("intent"), windowPda.toBuffer(), owner.toBuffer()]);
  const [escrowAuthority] = pda([enc.encode("escrow"), windowPda.toBuffer(), enc.encode("authority")]);
  const escrowAta = getAssociatedTokenAddressSync(USDC_MINT, escrowAuthority, true);

  const refundIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: intentPda, isSigner: false, isWritable: true },
      { pubkey: windowPda, isSigner: false, isWritable: false },
      { pubkey: escrowAta, isSigner: false, isWritable: true },
      { pubkey: escrowAuthority, isSigner: false, isWritable: false },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: disc("refund_intent"),
  });
  const refundSig = await send(new Transaction().add(refundIx), wallet, "refund_intent");
  ok(`refund_intent confirmed: ${refundSig}`);

  // Verify balance increased by intent.amount
  const afterBal = await conn.getTokenAccountBalance(ownerAta);
  const delta = (Number(afterBal.value.amount) - Number(beforeBal.value.amount)) / 1e6;
  info(`Wallet USDC after:  $${(Number(afterBal.value.amount) / 1e6).toFixed(2)}`);
  info(`Delta: +$${delta.toFixed(2)}`);

  if (delta > 0) {
    ok(`Refund flow validated end-to-end ✓`);
  } else {
    fail(`Expected positive delta, got ${delta}`);
  }
}

main().catch((err) => {
  console.error("\nTest failed:", err);
  process.exit(1);
});
