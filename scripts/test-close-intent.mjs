#!/usr/bin/env node
/**
 * One-shot driver: call close_intent on the settled intent at window #6
 * (which was refunded earlier in test-refund-flow). Produces a pinned
 * devnet tx for the /demo page's step 7 + audit evidence that
 * close_intent works against a real claimed/refunded intent.
 *
 * Targets the specific Intent PDA derived from:
 *   - window: A3TjAdJsBoz4pm1qRHxQXTS6ZfViCgeBiWXdJfzpJA5R (window #6)
 *   - owner: Fvys... (deploy authority, the user who refunded)
 *
 * After this script runs, the Intent account is closed and its rent is
 * swept back to the owner's lamport balance. Re-running fails because
 * the account no longer exists.
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
const WINDOW_6 = new PublicKey("A3TjAdJsBoz4pm1qRHxQXTS6ZfViCgeBiWXdJfzpJA5R");

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

const [intentPda] = pda([
  enc.encode("intent"),
  WINDOW_6.toBuffer(),
  owner.toBuffer(),
]);

console.log(`Owner:  ${owner.toBase58()}`);
console.log(`Window: ${WINDOW_6.toBase58()} (#6, status should be Failed)`);
console.log(`Intent: ${intentPda.toBase58()}`);

const intentAcct = await conn.getAccountInfo(intentPda);
if (!intentAcct) {
  console.log("\nIntent account doesn't exist (already closed?). Nothing to do.");
  process.exit(0);
}
console.log(`Intent rent: ${intentAcct.lamports} lamports (≈${(intentAcct.lamports / 1e9).toFixed(6)} SOL)`);

const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: WINDOW_6, isSigner: false, isWritable: false },
    { pubkey: intentPda, isSigner: false, isWritable: true },
  ],
  data: disc("close_intent"),
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

console.log(`\n✓ close_intent confirmed: ${sig}`);
console.log(`  https://explorer.solana.com/tx/${sig}?cluster=devnet`);

const after = await conn.getAccountInfo(intentPda);
console.log(
  `\nIntent account after close: ${after ? `STILL EXISTS (${after.lamports} lamports)` : "✓ CLOSED (rent swept to owner)"}`,
);
