#!/usr/bin/env tsx
/**
 * Tide Keeper — Off-Chain Window Coordinator
 *
 * Continuous process that:
 * 1. Polls active windows for expiry
 * 2. Triggers aggregate compute (Arcium MXE)
 * 3. Fetches optimal Jupiter route
 * 4. Calls execute_swap with route data
 * 5. Logs metrics
 *
 * In production: deploy via Helius webhooks + serverless function for reliability.
 * For hackathon demo: run as standalone Node.js process during demo window.
 *
 * Run: npx tsx scripts/keeper.ts
 *
 * Required env:
 *   HELIUS_DEVNET_RPC, KEEPER_KEYPAIR_PATH, TIDE_PROGRAM_ID
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { type AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import { fetchQuote, fetchSwapInstructions } from "../lib/jupiter";
// TODO: re-import once Arcium MXE is deployed and trigger_aggregate
// gets a real coordinator call. For now, the keeper is a placeholder
// for the post-MVP cron service.

// ─── Config ───

const POLL_INTERVAL_MS = 5_000; // 5 seconds
const RPC_URL =
  process.env.HELIUS_DEVNET_RPC ?? "https://api.devnet.solana.com";
const KEEPER_KEYPAIR_PATH =
  process.env.KEEPER_KEYPAIR_PATH ?? join(homedir(), ".config/solana/id.json");

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_TIDE_PROGRAM_ID ??
    "Tide1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
);

const USDC_MINT_DEVNET = new PublicKey(
  "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
);
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

// ─── State ───

interface KeeperState {
  connection: Connection;
  wallet: Wallet;
  poolPubkey: PublicKey;
  // program: Program<...>;  // TODO after IDL gen
}

// ─── Lifecycle ───

async function loadKeeper(): Promise<KeeperState> {
  console.log(`[keeper] connecting to ${RPC_URL}`);
  const connection = new Connection(RPC_URL, "confirmed");

  console.log(`[keeper] loading keypair from ${KEEPER_KEYPAIR_PATH}`);
  const keypairData = JSON.parse(readFileSync(KEEPER_KEYPAIR_PATH, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  const wallet = new Wallet(keypair);

  // Derive canonical pool PDA
  const [poolPubkey] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), USDC_MINT_DEVNET.toBuffer(), SOL_MINT.toBuffer()],
    PROGRAM_ID,
  );

  console.log(`[keeper] keeper wallet: ${keypair.publicKey.toBase58()}`);
  console.log(`[keeper] pool: ${poolPubkey.toBase58()}`);

  // Verify keeper has SOL for tx fees
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`[keeper] balance: ${(balance / 1e9).toFixed(4)} SOL`);
  if (balance < 0.01 * 1e9) {
    throw new Error("Keeper balance too low — airdrop SOL first");
  }

  return { connection, wallet, poolPubkey };
}

// ─── Main loop ───

async function pollAndAct(state: KeeperState) {
  // TODO: fetch Pool account → read activeWindow → fetch Window account
  // For scaffold:
  console.log(`[${timestamp()}] polling…`);

  // const pool = await state.program.account.pool.fetch(state.poolPubkey);
  // const window = await state.program.account.window.fetch(pool.activeWindow);

  // const now = Math.floor(Date.now() / 1000);

  // Phase 1: Check if window expired and needs aggregation
  // if (window.status === 0 && now >= window.endTs) {
  //   await handleWindowExpiry(state, pool.activeWindow, window);
  // }

  // Phase 2: Check if aggregation done, execute swap
  // if (window.status === 1) {
  //   await handleExecuteSwap(state, pool.activeWindow, window);
  // }
}

async function handleWindowExpiry(
  state: KeeperState,
  windowPubkey: PublicKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  window: any,
) {
  console.log(`[keeper] window expired, triggering aggregate: ${windowPubkey.toBase58()}`);

  // 1. Call trigger_aggregate instruction (flips status to Aggregating)
  // await state.program.methods.triggerAggregate()
  //   .accounts({ caller: state.wallet.publicKey, pool: state.poolPubkey, window: windowPubkey })
  //   .rpc();

  // 2. Trigger Arcium MXE compute (off-chain SDK call) — TODO when MXE is deployed
  const aggregateResult = { totalAmount: 0n, participantCount: 0 };
  void windowPubkey;

  console.log(
    `[keeper] aggregate result: ${aggregateResult.totalAmount} USDC, ${aggregateResult.participantCount} participants`,
  );
}

async function handleExecuteSwap(
  state: KeeperState,
  windowPubkey: PublicKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  window: any,
) {
  console.log(`[keeper] executing swap: ${windowPubkey.toBase58()}`);

  const totalAmount = BigInt(window.totalCommittedUsdc);
  const slippageBps = window.weightedAvgSlippageBps ?? 100;

  // 1. Fetch optimal Jupiter route
  const quote = await fetchQuote({
    inputMint: USDC_MINT_DEVNET,
    outputMint: SOL_MINT,
    amount: totalAmount,
    slippageBps,
    onlyDirectRoutes: true, // prefer direct for predictable execution
  });

  console.log(
    `[keeper] Jupiter quote: ${totalAmount} USDC → ${quote.outAmount} SOL (price impact ${quote.priceImpactPct}%)`,
  );

  // 2. Get swap instructions for CPI
  const swapInstructions = await fetchSwapInstructions(quote, state.wallet.publicKey);

  // 3. Call execute_swap with route data
  // const minAcquired = (BigInt(quote.outAmount) * 99n) / 100n; // 1% safety margin
  // await state.program.methods
  //   .executeSwap(serializeRouteData(swapInstructions), new BN(minAcquired.toString()))
  //   .accounts({ ... })
  //   .rpc();

  void swapInstructions; // avoid unused var
  console.log(`[keeper] ✓ swap executed`);
}

// ─── Utilities ───

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

// ─── Entry point ───

async function main() {
  console.log("─".repeat(50));
  console.log("Tide Keeper — Off-Chain Window Coordinator");
  console.log("─".repeat(50));

  const state = await loadKeeper();

  console.log(`[keeper] starting poll loop (interval: ${POLL_INTERVAL_MS}ms)`);
  console.log("");

  // Polling loop
  setInterval(async () => {
    try {
      await pollAndAct(state);
    } catch (err) {
      console.error(`[${timestamp()}] error:`, err);
    }
  }, POLL_INTERVAL_MS);

  // Run once immediately
  await pollAndAct(state);

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\n[keeper] shutting down");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[keeper] fatal:", err);
  process.exit(1);
});
