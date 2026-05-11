#!/usr/bin/env node
/**
 * One-shot: mint test USDC from the deploy-authority wallet to any
 * recipient pubkey. Used to bootstrap users who lack devnet USDC.
 *
 * Run: node scripts/mint-to-wallet.mjs <recipient_pubkey> <amount_usdc>
 *
 * Example: node scripts/mint-to-wallet.mjs 3QfHXyf...QK79 100
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const RPC = "https://api.devnet.solana.com";
const USDC_MINT = new PublicKey("BKQ9HAzw2rnfUXpm6BKz2yvH4ikwKhC8dkgt73A8LTSh");

const [recipientArg, amountArg] = process.argv.slice(2);
if (!recipientArg || !amountArg) {
  console.error("Usage: node scripts/mint-to-wallet.mjs <recipient> <amount_usdc>");
  process.exit(1);
}

const recipient = new PublicKey(recipientArg);
const amountUsdc = parseFloat(amountArg);
const amountLamports = BigInt(Math.round(amountUsdc * 1_000_000));

const conn = new Connection(RPC, "confirmed");

const authority = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(
        path.join(os.homedir(), ".config", "solana", "id.json"),
        "utf8",
      ),
    ),
  ),
);

console.log(`Authority:  ${authority.publicKey.toBase58()}`);
console.log(`Recipient:  ${recipient.toBase58()}`);
console.log(`Amount:     $${amountUsdc.toFixed(2)} (${amountLamports} lamports)`);

const recipientAta = getAssociatedTokenAddressSync(USDC_MINT, recipient);
console.log(`ATA:        ${recipientAta.toBase58()}`);

const tx = new Transaction()
  .add(
    createAssociatedTokenAccountIdempotentInstruction(
      authority.publicKey,
      recipientAta,
      recipient,
      USDC_MINT,
    ),
  )
  .add(
    createMintToInstruction(
      USDC_MINT,
      recipientAta,
      authority.publicKey,
      amountLamports,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

const { blockhash } = await conn.getLatestBlockhash("confirmed");
tx.recentBlockhash = blockhash;
tx.feePayer = authority.publicKey;
tx.sign(authority);

const sig = await conn.sendRawTransaction(tx.serialize());
await conn.confirmTransaction(sig, "confirmed");

console.log(`\n✓ mint confirmed: ${sig}`);
console.log(`  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
