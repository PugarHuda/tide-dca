#!/usr/bin/env node
/**
 * One-shot: mark_window_failed on the current Aggregating window.
 *
 * Mirrors the inline ix we use in test-refund-flow but standalone so
 * the seed-loop / qa-e2e can invoke it explicitly when a window can't
 * complete via execute_swap (which is permanent on devnet because
 * Jupiter has no quote API for our test mint).
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
} from "@solana/web3.js";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg");
const USDC_MINT = new PublicKey("BKQ9HAzw2rnfUXpm6BKz2yvH4ikwKhC8dkgt73A8LTSh");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

const conn = new Connection(RPC, "confirmed");
const enc = new TextEncoder();

function disc(name) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}
function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

const wallet = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(
        path.join(os.homedir(), ".config", "solana", "id.json"),
        "utf8",
      ),
    ),
  ),
);
const owner = wallet.publicKey;

const [poolPda] = pda([enc.encode("pool"), USDC_MINT.toBuffer(), SOL_MINT.toBuffer()]);
const poolAcct = await conn.getAccountInfo(poolPda);
if (!poolAcct) throw new Error("Pool not initialized");

// decode active_window from pool data (Pool layout: 8 disc + 32 auth +
// 32 input_mint + 32 target_mint + 8 + 8 + 2 + 8 + 8 = 138, then
// active_window at offset 138)
const data = poolAcct.data;
const activeWindow = new PublicKey(data.subarray(138, 138 + 32));

console.log(`Pool:          ${poolPda.toBase58()}`);
console.log(`Active window: ${activeWindow.toBase58()}`);

const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: owner, isSigner: true, isWritable: false },
    { pubkey: poolPda, isSigner: false, isWritable: false },
    { pubkey: activeWindow, isSigner: false, isWritable: true },
  ],
  data: disc("mark_window_failed"),
});

const tx = new Transaction().add(ix);
const { blockhash } = await conn.getLatestBlockhash("confirmed");
tx.recentBlockhash = blockhash;
tx.feePayer = owner;
tx.sign(wallet);

const sim = await conn.simulateTransaction(tx);
if (sim.value.err) {
  console.error("\nSimulation failed:", JSON.stringify(sim.value.err));
  (sim.value.logs ?? []).forEach((l) => console.error("  " + l));
  process.exit(1);
}

const sig = await conn.sendRawTransaction(tx.serialize());
await conn.confirmTransaction(sig, "confirmed");
console.log(`\n✓ mark_window_failed confirmed: ${sig}`);
console.log(`  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
