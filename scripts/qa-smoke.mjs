// Tide on-chain QA — runs through devnet state and reports what's healthy.
// Doesn't click buttons (can't), but verifies everything around them.
//
// Usage:  node scripts/qa-smoke.mjs

import { Connection, PublicKey } from "@solana/web3.js";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg");
const USDC_MINT = new PublicKey("BKQ9HAzw2rnfUXpm6BKz2yvH4ikwKhC8dkgt73A8LTSh");
const OLD_USDC_MINT = new PublicKey("4YhohVQ8RmudchbAe2UBXcrdduVYkuqyU7hHviz2MSvT");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
// Mint authority is the user's Phantom (post-rotation after E2E QA pass).
const EXPECTED_MINT_AUTHORITY = new PublicKey("3QfHXyficacGxrFjmPLYy7RYFhfxsCR8i1H73BdtQK79");
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const conn = new Connection(RPC, "confirmed");
const enc = new TextEncoder();

const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const fail = (msg) => console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
const warn = (msg) => console.log(`  \x1b[33m!\x1b[0m ${msg}`);
const info = (msg) => console.log(`    ${msg}`);
const section = (title) => console.log(`\n\x1b[36m━━ ${title}\x1b[0m`);

function findPda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

function decodePool(data) {
  // Field order from programs/tide/src/state.rs Pool
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
    authority, inputMint, targetMint, activeWindow,
    windowCounter, windowDuration, minPoolSize, feeBps, totalVolume, totalSavings,
  };
}

function decodeWindow(data) {
  // Field order from programs/tide/src/state.rs Window
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
  return {
    pool, windowNumber, status, startTs, endTs,
    totalCommitted, intentCount, acquired, slippageBps,
  };
}

const STATUS_LABELS = ["Open", "Aggregating", "Distributed", "Failed"];

async function main() {
  console.log("\x1b[1m\nTide devnet QA — on-chain state report\x1b[0m");
  console.log(`RPC: ${RPC}\n`);

  // ─── 1. Program deployed ────────────────────────────────────────────────
  section("Program deployment");
  const program = await conn.getAccountInfo(PROGRAM_ID);
  if (!program) {
    fail(`Program ${PROGRAM_ID.toBase58()} NOT deployed`);
    process.exit(1);
  }
  ok(`Program ${PROGRAM_ID.toBase58()} deployed`);
  info(`Owner: ${program.owner.toBase58()}`);
  info(`Executable: ${program.executable}`);
  info(`Data size: ${program.data.length} bytes`);

  // ─── 2. Test USDC mint ──────────────────────────────────────────────────
  section("Test USDC mint (current)");
  const mintInfo = await conn.getAccountInfo(USDC_MINT);
  if (!mintInfo) {
    fail(`Mint ${USDC_MINT.toBase58()} NOT found on devnet`);
    process.exit(1);
  }
  ok(`Mint exists: ${USDC_MINT.toBase58()}`);
  if (!mintInfo.owner.equals(TOKEN_PROGRAM)) {
    fail(`Wrong owner: ${mintInfo.owner.toBase58()}`);
  } else {
    ok(`Owned by SPL Token program`);
  }
  // SPL Mint layout: mint_authority_option(4) + mint_authority(32) + supply(8)
  //                  + decimals(1) + is_initialized(1) + freeze_authority_option(4)
  //                  + freeze_authority(32) = 82 bytes
  const md = mintInfo.data;
  const mintAuthOpt = md.readUInt32LE(0);
  const mintAuth = mintAuthOpt === 1 ? new PublicKey(md.subarray(4, 36)) : null;
  const supply = md.readBigUInt64LE(36);
  const decimals = md.readUInt8(44);
  const isInitialized = md.readUInt8(45) === 1;
  info(`Decimals: ${decimals}`);
  info(`Initialized: ${isInitialized}`);
  info(`Supply: ${(Number(supply) / 1_000_000).toLocaleString()} USDC`);
  if (mintAuth) {
    if (mintAuth.equals(EXPECTED_MINT_AUTHORITY)) {
      ok(`Mint authority = ${EXPECTED_MINT_AUTHORITY.toBase58()} (Phantom user) ✓`);
    } else {
      fail(`Mint authority MISMATCH: ${mintAuth.toBase58()} (expected ${EXPECTED_MINT_AUTHORITY.toBase58()})`);
    }
  } else {
    fail(`Mint authority disabled — cannot mint via /admin`);
  }

  // Old mint (just verify it exists, no further checks)
  section("Test USDC mint (previous, orphaned)");
  const oldMintInfo = await conn.getAccountInfo(OLD_USDC_MINT);
  if (oldMintInfo) {
    info(`Old mint ${OLD_USDC_MINT.toBase58()} still on chain (harmless, no longer referenced by UI)`);
  } else {
    info(`Old mint not found (cleaned up)`);
  }

  // ─── 3. Pool PDA ────────────────────────────────────────────────────────
  section("Pool state (USDC → SOL)");
  const [poolPda] = findPda([
    enc.encode("pool"),
    USDC_MINT.toBuffer(),
    SOL_MINT.toBuffer(),
  ]);
  info(`Pool PDA: ${poolPda.toBase58()}`);
  const poolAccount = await conn.getAccountInfo(poolPda);
  if (!poolAccount) {
    warn(`Pool NOT initialized for current mint pair`);
    info(`→ User needs to: /admin → Initialize Pool (15 min)`);
    info(`(Once init'd, the rest of this report becomes meaningful)`);
    return;
  }
  ok(`Pool initialized`);
  let pool;
  try {
    pool = decodePool(poolAccount.data);
  } catch (err) {
    fail(`Failed to decode pool data: ${err.message}`);
    info(`Account size: ${poolAccount.data.length}`);
    return;
  }
  info(`Authority:        ${pool.authority.toBase58()}`);
  info(`Window counter:   ${pool.windowCounter.toString()}`);
  info(`Window duration:  ${Number(pool.windowDuration)}s (${Number(pool.windowDuration) / 60} min)`);
  info(`Min pool size:    ${(Number(pool.minPoolSize) / 1_000_000).toFixed(2)} USDC`);
  info(`Fee:              ${pool.feeBps} bps`);
  info(`Total volume:     ${(Number(pool.totalVolume) / 1_000_000).toFixed(2)} USDC`);
  info(`Active window:    ${pool.activeWindow.toBase58()}`);

  if (Number(pool.windowDuration) === 900) {
    ok(`Window duration = 15 min (matches user's choice)`);
  } else if (Number(pool.windowDuration) === 3600) {
    warn(`Window duration = 1 hour (default, NOT 15 min — may need fresh pool)`);
  }

  // ─── 4. Active window ───────────────────────────────────────────────────
  section("Active window state");
  if (pool.activeWindow.equals(PublicKey.default)) {
    warn(`No active window set in pool`);
    info(`→ User needs to: /admin → Open Next Window`);
    return;
  }
  const windowAccount = await conn.getAccountInfo(pool.activeWindow);
  if (!windowAccount) {
    fail(`Active window PDA references nonexistent account`);
    return;
  }
  ok(`Active window account exists`);
  let win;
  try {
    win = decodeWindow(windowAccount.data);
  } catch (err) {
    fail(`Failed to decode window: ${err.message}`);
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const nowDate = new Date(now * 1000).toISOString();
  const startDate = new Date(Number(win.startTs) * 1000).toISOString();
  const endDate = new Date(Number(win.endTs) * 1000).toISOString();
  const remaining = Number(win.endTs) - now;

  info(`Window number:      #${win.windowNumber.toString()}`);
  info(`Status:             ${STATUS_LABELS[win.status] ?? win.status}`);
  info(`Started:            ${startDate}`);
  info(`Ends:               ${endDate}`);
  info(`Now:                ${nowDate}`);
  if (remaining > 0) {
    info(`Time remaining:     ${Math.floor(remaining / 60)}m ${remaining % 60}s`);
  } else {
    info(`Expired:            ${-remaining}s ago`);
  }
  info(`Total committed:    ${(Number(win.totalCommitted) / 1_000_000).toFixed(2)} USDC`);
  info(`Intent count:       ${win.intentCount}`);
  info(`Acquired (target):  ${(Number(win.acquired) / 1e9).toFixed(6)} SOL (raw lamports/9 decimals)`);

  // ─── 5. Lifecycle suggestion ────────────────────────────────────────────
  section("What user needs to do next");
  const expired = remaining <= 0;
  const thresholdMet = win.totalCommitted >= pool.minPoolSize;

  if (win.status === 0) { // Open
    if (!expired) {
      info(`→ Window still OPEN. Users can commit_intent until ${endDate}.`);
      if (win.intentCount === 0) {
        info(`→ No commits yet. Test path: /setup → Start DCA → /dashboard → Commit`);
      } else {
        info(`→ ${win.intentCount} commit(s) so far, $${(Number(win.totalCommitted) / 1_000_000).toFixed(2)} aggregated.`);
        if (!thresholdMet) {
          warn(`Below threshold ($${(Number(pool.minPoolSize) / 1_000_000).toFixed(2)} required). Need additional commits.`);
        }
      }
    } else {
      info(`→ Window EXPIRED.`);
      if (thresholdMet) {
        info(`→ Threshold met. Ready for: /admin → Trigger Aggregate`);
      } else {
        warn(`Below threshold ($${(Number(win.totalCommitted) / 1_000_000).toFixed(2)} of $${(Number(pool.minPoolSize) / 1_000_000).toFixed(2)} required).`);
        info(`→ trigger_aggregate will revert with PoolTooSmall (Custom 6010).`);
        info(`→ Mitigation: more commits from another wallet, OR re-init pool with smaller min_pool_size.`);
      }
    }
  } else if (win.status === 1) { // Aggregating
    info(`→ Window AGGREGATING. Ready for: /admin → Execute Swap`);
  } else if (win.status === 2) { // Distributed
    ok(`Window DISTRIBUTED. Users can /dashboard → Claim`);
    info(`→ Acquired ${(Number(win.acquired) / 1e9).toFixed(6)} SOL — pro-rata claim available.`);
  } else if (win.status === 3) { // Failed
    fail(`Window FAILED. Inspect tx logs to diagnose.`);
  }

  console.log("");
}

main().catch((err) => {
  console.error("\x1b[31m\nQA script crashed:\x1b[0m", err);
  process.exit(1);
});
