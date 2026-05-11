#!/usr/bin/env node
/**
 * Tide Seed Loop — Auto-cycle real on-chain windows on devnet.
 *
 * Polls the deployed Tide program every POLL_INTERVAL_MS and advances the
 * window state machine to keep `/dashboard` looking alive:
 *
 *   - Open + not expired + 0 intents     →  commit_intent ($10 USDC)
 *   - Open + not expired + ≥1 intents    →  wait
 *   - Open + expired                      →  trigger_aggregate
 *   - Aggregating (devnet can't swap)    →  init new window (orphan the prev)
 *   - Distributed / Failed                →  init new window
 *
 * Each on-chain action is delegated to scripts/qa-e2e.mjs phases so the
 * tx-construction logic stays single-sourced. The loop just orchestrates.
 *
 * Why orphan the Aggregating window: Jupiter v6 quote API has no devnet
 * coverage for our test mint, so execute_swap can't complete on devnet
 * without a custom workaround. The state machine itself is exercised by
 * trigger_aggregate; init_window doesn't gate on previous-window-finalized
 * (verified empirically — pool counter advanced from 3→4 with window #2
 * still in Aggregating).
 *
 * Usage:
 *   node scripts/seed-loop.mjs                # default 60s poll
 *   POLL_INTERVAL_MS=30000 node scripts/seed-loop.mjs
 *
 * Run in a long-lived terminal during demo prep. SIGINT (Ctrl-C) shuts
 * down cleanly.
 *
 * Cost guard: each commit_intent burns $10 USDC. The loop tracks burn
 * and will stop calling commit when wallet USDC < MIN_USDC_BALANCE so
 * you don't drain the funded wallet overnight.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// ─── Config ─────────────────────────────────────────────────────────────────

const RPC = process.env.HELIUS_DEVNET_RPC ?? "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg");
const USDC_MINT = new PublicKey("BKQ9HAzw2rnfUXpm6BKz2yvH4ikwKhC8dkgt73A8LTSh");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 60_000);
const MIN_USDC_BALANCE = Number(process.env.MIN_USDC_BALANCE ?? 50); // stop committing below this
const MIN_SOL_BALANCE = Number(process.env.MIN_SOL_BALANCE ?? 0.1); // stop everything below this

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const QA_SCRIPT = path.join(SCRIPT_DIR, "qa-e2e.mjs");

const conn = new Connection(RPC, "confirmed");
const enc = new TextEncoder();
const STATUS = ["Open", "Aggregating", "Distributed", "Failed"];

// ─── PDA derivation ─────────────────────────────────────────────────────────

const [POOL_PDA] = PublicKey.findProgramAddressSync(
  [enc.encode("pool"), USDC_MINT.toBuffer(), SOL_MINT.toBuffer()],
  PROGRAM_ID,
);

// ─── Owner pubkey from CLI keypair ──────────────────────────────────────────

const { Keypair } = await import("@solana/web3.js");
const OWNER = (() => {
  const p = path.join(os.homedir(), ".config", "solana", "id.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw)).publicKey;
})();

// ─── Account decoders (mirror programs/tide/src/state.rs) ──────────────────

function decodePool(data) {
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
  return {
    authority, inputMint, targetMint, activeWindow, windowCounter,
    windowDuration, minPoolSize, feeBps, totalVolume, totalSavings,
  };
}

function decodeWindow(data) {
  let o = 8;
  o += 32; // pool
  const windowNumber = data.readBigUInt64LE(o); o += 8;
  const startTs = data.readBigInt64LE(o); o += 8;
  const endTs = data.readBigInt64LE(o); o += 8;
  const status = data.readUInt8(o); o += 1;
  const intentCount = data.readUInt32LE(o); o += 4;
  const totalCommitted = data.readBigUInt64LE(o); o += 8;
  o += 32; // aggregate_result_hash
  const acquired = data.readBigUInt64LE(o); o += 8;
  const slippageBps = data.readUInt16LE(o); o += 2;
  return { windowNumber, startTs, endTs, status, intentCount, totalCommitted, acquired, slippageBps };
}

// ─── State fetch ────────────────────────────────────────────────────────────

async function getPool() {
  const a = await conn.getAccountInfo(POOL_PDA);
  return a ? decodePool(a.data) : null;
}

async function getWindow(pubkey) {
  const a = await conn.getAccountInfo(pubkey);
  return a ? decodeWindow(a.data) : null;
}

async function getBalances() {
  const sol = await conn.getBalance(OWNER);
  let usdc = 0;
  try {
    const ata = getAssociatedTokenAddressSync(USDC_MINT, OWNER);
    const bal = await conn.getTokenAccountBalance(ata);
    usdc = bal.value.uiAmount ?? 0;
  } catch (err) {
    // "TokenAccountNotFoundError" / 0x0 result is fine — wallet doesn't
    // own a USDC ATA yet, balance is genuinely 0. Anything else (RPC
    // timeout, 429, deserialization error) we surface so the operator
    // can tell "no USDC" from "RPC dropped a tick" instead of falsely
    // pausing commits via the MIN_USDC_BALANCE guard.
    const msg = err instanceof Error ? err.message : String(err);
    const isAtaMissing =
      /could not find account|account not found|TokenAccountNotFound/i.test(msg);
    if (!isAtaMissing) {
      console.warn(`[${ts()}] USDC balance fetch failed (RPC?): ${msg}`);
    }
  }
  return { sol: sol / 1e9, usdc };
}

// ─── Phase delegate (calls qa-e2e.mjs) ──────────────────────────────────────

function runPhase(phase) {
  const result = spawnSync("node", [QA_SCRIPT, phase], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function extractSig(stdout) {
  const m = stdout.match(/confirmed:\s+([1-9A-HJ-NP-Za-km-z]{40,90})/);
  return m ? m[1] : null;
}

// ─── Logging ────────────────────────────────────────────────────────────────

const ts = () => new Date().toISOString().slice(11, 19);
const line = (msg) => console.log(`[${ts()}] ${msg}`);
const action = (msg, extra = "") => console.log(`[${ts()}] \x1b[36m▸\x1b[0m ${msg}${extra ? "  " + extra : ""}`);
const success = (msg) => console.log(`[${ts()}] \x1b[32m✓\x1b[0m ${msg}`);
const warn = (msg) => console.log(`[${ts()}] \x1b[33m!\x1b[0m ${msg}`);
const error = (msg) => console.log(`[${ts()}] \x1b[31m✗\x1b[0m ${msg}`);

// ─── Decision engine ────────────────────────────────────────────────────────

async function tick(stats) {
  const balances = await getBalances();

  if (balances.sol < MIN_SOL_BALANCE) {
    error(`SOL ${balances.sol.toFixed(4)} below min ${MIN_SOL_BALANCE} — pause loop, airdrop more`);
    return;
  }

  const pool = await getPool();
  if (!pool) {
    error(`Pool not found at ${POOL_PDA.toBase58()} — run qa-e2e init first`);
    return;
  }

  const windowPubkey = pool.activeWindow;
  if (windowPubkey.equals(PublicKey.default)) {
    action(`No active window → init`);
    const r = runPhase("init");
    if (r.ok) {
      const sig = extractSig(r.stdout);
      success(`init_window confirmed${sig ? ` ${sig.slice(0, 16)}…` : ""}`);
      stats.initCount++;
    } else {
      error(`init failed:\n${r.stderr || r.stdout}`);
    }
    return;
  }

  const win = await getWindow(windowPubkey);
  if (!win) {
    warn(`active_window ${windowPubkey.toBase58()} not loadable, skipping`);
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const remaining = Number(win.endTs) - now;
  const expired = remaining <= 0;
  const statusLabel = STATUS[win.status];

  // Compact periodic state line (every tick — useful when nothing acts)
  const remainStr = expired
    ? `EXPIRED ${-remaining}s ago`
    : `${Math.floor(remaining / 60)}m ${remaining % 60}s left`;
  line(
    `pool counter=${pool.windowCounter} active=#${win.windowNumber} status=${statusLabel} ` +
    `intents=${win.intentCount} committed=$${(Number(win.totalCommitted) / 1e6).toFixed(2)} ` +
    `${remainStr} | wallet ${balances.sol.toFixed(3)} SOL · ${balances.usdc} USDC`,
  );

  // Decision tree
  if (win.status === 0 /* Open */) {
    if (expired) {
      // Window past expiry → aggregate (permissionless ix)
      // Only valid if intentCount > 0 AND totalCommitted >= minPoolSize
      const meetsThreshold = win.totalCommitted >= pool.minPoolSize;
      if (win.intentCount === 0 || !meetsThreshold) {
        action(
          `expired with ${win.intentCount} intents · committed $${(Number(win.totalCommitted) / 1e6).toFixed(2)} ` +
          `< min $${(Number(pool.minPoolSize) / 1e6).toFixed(2)} → init new window (orphan this one)`,
        );
        const r = runPhase("init");
        if (r.ok) {
          const sig = extractSig(r.stdout);
          success(`init_window confirmed${sig ? ` ${sig.slice(0, 16)}…` : ""}`);
          stats.initCount++;
        } else {
          error(`init failed:\n${r.stderr || r.stdout}`);
        }
        return;
      }
      action(`window expired with ${win.intentCount} intents · $${(Number(win.totalCommitted) / 1e6).toFixed(2)} → trigger_aggregate`);
      const r = runPhase("aggregate");
      if (r.ok) {
        const sig = extractSig(r.stdout);
        success(`trigger_aggregate confirmed${sig ? ` ${sig.slice(0, 16)}…` : ""}`);
        stats.aggregateCount++;
      } else {
        error(`aggregate failed:\n${r.stderr || r.stdout}`);
      }
      return;
    }
    if (win.intentCount === 0) {
      // Open + fresh + nobody has committed → seed an intent
      if (balances.usdc < MIN_USDC_BALANCE) {
        warn(`USDC ${balances.usdc} below min ${MIN_USDC_BALANCE} — skip commit (mint more test USDC)`);
        return;
      }
      action(`fresh window with 0 intents → commit_intent ($10)`);
      const r = runPhase("commit");
      if (r.ok) {
        const sig = extractSig(r.stdout);
        success(`commit_intent confirmed${sig ? ` ${sig.slice(0, 16)}…` : ""}`);
        stats.commitCount++;
      } else {
        error(`commit failed:\n${r.stderr || r.stdout}`);
      }
      return;
    }
    // Open + has intents + not expired → wait
    return;
  }

  if (win.status === 1 /* Aggregating */) {
    // On devnet we can't execute_swap (no Jupiter quote for test mint).
    // Open a fresh window — orphans this one in Aggregating, which is
    // honest demo content (state machine works, devnet just lacks swap
    // liquidity).
    action(`status=Aggregating · devnet swap blocked → init new window (orphan #${win.windowNumber})`);
    const r = runPhase("init");
    if (r.ok) {
      const sig = extractSig(r.stdout);
      success(`init_window confirmed${sig ? ` ${sig.slice(0, 16)}…` : ""}`);
      stats.initCount++;
    } else {
      error(`init failed:\n${r.stderr || r.stdout}`);
    }
    return;
  }

  if (win.status === 2 /* Distributed */ || win.status === 3 /* Failed */) {
    action(`status=${statusLabel} → init new window`);
    const r = runPhase("init");
    if (r.ok) {
      const sig = extractSig(r.stdout);
      success(`init_window confirmed${sig ? ` ${sig.slice(0, 16)}…` : ""}`);
      stats.initCount++;
    } else {
      error(`init failed:\n${r.stderr || r.stdout}`);
    }
    return;
  }
}

// ─── Main loop ──────────────────────────────────────────────────────────────

async function main() {
  console.log("─".repeat(72));
  console.log("Tide Seed Loop");
  console.log(`  RPC:      ${RPC}`);
  console.log(`  Pool:     ${POOL_PDA.toBase58()}`);
  console.log(`  Owner:    ${OWNER.toBase58()}`);
  console.log(`  Interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`  Min USDC: $${MIN_USDC_BALANCE}  ·  Min SOL: ${MIN_SOL_BALANCE}`);
  console.log("─".repeat(72));

  const stats = { initCount: 0, commitCount: 0, aggregateCount: 0, startTs: Date.now() };

  process.on("SIGINT", () => {
    const elapsed = Math.floor((Date.now() - stats.startTs) / 1000);
    console.log("\n");
    line(`shutdown · ran ${elapsed}s · ` +
      `${stats.initCount} init · ${stats.commitCount} commits · ${stats.aggregateCount} aggregates`);
    process.exit(0);
  });

  // Run once immediately, then poll
  await tick(stats).catch((e) => error(`tick threw: ${e.message}`));
  setInterval(() => {
    tick(stats).catch((e) => error(`tick threw: ${e.message}`));
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
