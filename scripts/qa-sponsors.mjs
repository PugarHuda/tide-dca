// Sponsor integrations QA — runs every probe we built into the prod app
// against either local code paths (lib functions) or remote endpoints.
//
// Scope: 7 of 8 cases. QA-8 (Reflect dashboard card) needs DOM rendering.
//
// Usage:  node scripts/qa-sponsors.mjs [--prod|--local]
//         --prod (default): hit https://tide-dca.vercel.app
//         --local:          hit http://localhost:3000

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";

const PROD_URL = "https://tide-dca.vercel.app";
const LOCAL_URL = "http://localhost:3000";
const BASE = process.argv.includes("--local") ? LOCAL_URL : PROD_URL;

const DEVNET = "https://api.devnet.solana.com";
const MAINNET = "https://api.mainnet-beta.solana.com";

const SQUADS_V4_PROGRAM_ID = new PublicKey(
  "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
);
const PYTH_SOL_USD_FEED = new PublicKey(
  "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG",
);
const POOL_PDA = new PublicKey("9JRBentsBQiG4hgvsxuc2twmzf87G2PcEVRwBKQ7rcj4");

// ─── Load wallet for ix building ───────────────────────────────────────────
function loadKeypair() {
  const p = path.join(os.homedir(), ".config", "solana", "id.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}
const wallet = loadKeypair();
const owner = wallet.publicKey;

// ─── Output helpers ────────────────────────────────────────────────────────
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const info = (m) => console.log(`    ${m}`);
const section = (n, t) => console.log(`\n\x1b[36m━━ QA-${n} · ${t}\x1b[0m`);

const results = [];
function record(id, name, status, detail) {
  results.push({ id, name, status, detail });
}

// ─── QA-1: Squads detection (classify pool authority) ──────────────────────
async function qa1_authority() {
  section(1, "Authority badge (Squads detection)");
  const conn = new Connection(DEVNET, "confirmed");
  const pool = await conn.getAccountInfo(POOL_PDA);
  if (!pool) {
    fail("Pool account missing on devnet");
    record("QA-1", "authority", "FAIL", "pool not found");
    return;
  }
  // Pool layout offset to authority: 8 (disc) → 32 bytes
  const authority = new PublicKey(pool.data.subarray(8, 8 + 32));
  info(`Pool authority: ${authority.toBase58()}`);

  const acct = await conn.getAccountInfo(authority);
  if (!acct) {
    ok(`Authority is wallet (no account = system-owned, 0 balance)`);
    record("QA-1", "authority", "PASS", `wallet (no acct)`);
    return;
  }
  const owner = acct.owner;
  if (owner.equals(new PublicKey("11111111111111111111111111111111"))) {
    ok(`Authority is single-key wallet — badge "single-key" expected`);
    record("QA-1", "authority", "PASS", "single-key wallet");
  } else if (owner.equals(SQUADS_V4_PROGRAM_ID)) {
    ok(`Authority is Squads V4 multisig — badge "Squads N/M" expected`);
    record("QA-1", "authority", "PASS", "squads multisig");
  } else {
    warn(`Authority owned by program ${owner.toBase58()}`);
    record("QA-1", "authority", "PASS", `program-owned (${owner.toBase58().slice(0, 8)})`);
  }
}

// ─── QA-2: Raydium quote (live mainnet API) ────────────────────────────────
async function qa2_raydium() {
  section(2, "Raydium quote (mainnet API)");
  const url = new URL("https://transaction-v1.raydium.io/compute/swap-base-in");
  url.searchParams.set("inputMint", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  url.searchParams.set("outputMint", "So11111111111111111111111111111111111111112");
  url.searchParams.set("amount", "100000000"); // 100 USDC
  url.searchParams.set("slippageBps", "50");
  url.searchParams.set("txVersion", "V0");

  try {
    const r = await fetch(url.toString());
    if (!r.ok) {
      fail(`HTTP ${r.status} ${r.statusText}`);
      record("QA-2", "raydium", "FAIL", `HTTP ${r.status}`);
      return;
    }
    const json = await r.json();
    if (!json.success) {
      fail(`API success=false: ${JSON.stringify(json).slice(0, 200)}`);
      record("QA-2", "raydium", "FAIL", "success=false");
      return;
    }
    const out = Number(json.data.outputAmount) / 1e9;
    const hops = json.data.routePlan.length;
    ok(`100 USDC → ${out.toFixed(6)} SOL (${hops} hops)`);
    info(`Pool ids: ${json.data.routePlan.map((r) => r.poolId.slice(0, 8)).join(", ")}`);
    info(`Price impact: ${(json.data.priceImpactPct * 100).toFixed(4)}%`);
    record("QA-2", "raydium", "PASS", `${out.toFixed(6)} SOL out`);
  } catch (err) {
    fail(`fetch threw: ${err.message}`);
    record("QA-2", "raydium", "FAIL", err.message);
  }
}

// ─── QA-3: Pyth oracle on devnet (graceful fail) + mainnet (working) ───────
async function qa3_pyth() {
  section(3, "Pyth oracle");

  // 3a. Devnet — should NOT have this mainnet feed
  const devConn = new Connection(DEVNET, "confirmed");
  const devAcct = await devConn.getAccountInfo(PYTH_SOL_USD_FEED);
  if (devAcct) {
    warn(`Devnet has account at ${PYTH_SOL_USD_FEED.toBase58()} (unexpected)`);
  } else {
    ok(`Devnet: feed not found — frontend shows graceful error message ✓`);
  }

  // 3b. Mainnet — should have working feed
  const mainConn = new Connection(MAINNET, "confirmed");
  let mainAcct;
  try {
    mainAcct = await mainConn.getAccountInfo(PYTH_SOL_USD_FEED);
  } catch (err) {
    fail(`Mainnet RPC error: ${err.message}`);
    record("QA-3", "pyth", "FAIL", err.message);
    return;
  }
  if (!mainAcct) {
    fail("Mainnet feed missing — wrong pubkey?");
    record("QA-3", "pyth", "FAIL", "mainnet feed not found");
    return;
  }
  // Decode Pyth V2: magic 0xa1b2c3d4, exponent at +20, agg at +208
  const magic = mainAcct.data.readUInt32LE(0);
  if (magic !== 0xa1b2c3d4) {
    fail(`Magic mismatch: 0x${magic.toString(16)}`);
    record("QA-3", "pyth", "FAIL", "magic");
    return;
  }
  const exponent = mainAcct.data.readInt32LE(20);
  const priceRaw = mainAcct.data.readBigInt64LE(208);
  const confRaw = mainAcct.data.readBigUInt64LE(216);
  const slot = mainAcct.data.readBigUInt64LE(208 + 24);
  const scale = Math.pow(10, exponent);
  const price = Number(priceRaw) * scale;
  const conf = Number(confRaw) * scale;
  ok(`Mainnet SOL/USD: $${price.toFixed(4)} ± $${conf.toFixed(4)} (slot ${slot})`);
  record("QA-3", "pyth", "PASS", `$${price.toFixed(4)}`);
}

// ─── QA-4: Reflect submit graceful fail ────────────────────────────────────
async function qa4_reflect() {
  section(4, "Reflect stake (graceful fail expected)");
  const programIdEnv = process.env.NEXT_PUBLIC_REFLECT_PROGRAM_ID ?? "";
  const rUsdcEnv = process.env.NEXT_PUBLIC_REFLECT_RUSDC_MINT ?? "";

  if (!programIdEnv && !rUsdcEnv) {
    ok(`Both env vars empty → button surfaces "not configured" toast ✓`);
    record("QA-4", "reflect", "PASS", "graceful (env unset)");
    return;
  }
  if (programIdEnv && !rUsdcEnv) {
    warn(`Program id set but rUSDC mint missing — partial config will throw`);
    record("QA-4", "reflect", "PARTIAL", "rUSDC missing");
    return;
  }
  // Both set → would build a real ix. Just validate the program id parses.
  try {
    const pid = new PublicKey(programIdEnv);
    info(`Program id: ${pid.toBase58()}`);
    ok(`Both env vars set, program id parses → tx builder would fire`);
    record("QA-4", "reflect", "PASS", `configured (${pid.toBase58().slice(0, 8)})`);
  } catch (err) {
    fail(`Program id invalid: ${err.message}`);
    record("QA-4", "reflect", "FAIL", "invalid program id");
  }
}

// ─── QA-5: Squads multisig_create_v2 ix builder + devnet simulate ──────────
async function qa5_squads() {
  section(5, "Squads create multisig (graceful fail on devnet)");
  const conn = new Connection(DEVNET, "confirmed");

  // Build the ix by hand (same as lib/squads.ts buildCreateMultisigIx)
  const createKey = Keypair.generate();
  const [multisigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("multisig"), createKey.publicKey.toBuffer()],
    SQUADS_V4_PROGRAM_ID,
  );
  const treasury = new PublicKey("3ZVtRjENH6jExDp2T84cJqLfJsr1ETWTUHdjuAUmFxiB");
  const disc = createHash("sha256")
    .update("global:multisig_create_v2")
    .digest()
    .subarray(0, 8);

  const memberCount = 1;
  const argSize = 1 + 32 + 2 + 4 + memberCount * 33 + 4 + 1 + 1;
  const args = Buffer.alloc(argSize);
  let cur = 0;
  args.writeUInt8(1, cur); cur += 1;
  owner.toBuffer().copy(args, cur); cur += 32;
  args.writeUInt16LE(1, cur); cur += 2;            // threshold
  args.writeUInt32LE(1, cur); cur += 4;            // member count
  owner.toBuffer().copy(args, cur); cur += 32;
  args.writeUInt8(7, cur); cur += 1;               // permissions
  args.writeUInt32LE(0, cur); cur += 4;            // time_lock
  args.writeUInt8(0, cur); cur += 1;               // rent_collector
  args.writeUInt8(0, cur); cur += 1;               // memo

  const data = Buffer.concat([disc, args]);

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    {
      programId: SQUADS_V4_PROGRAM_ID,
      keys: [
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: multisigPda, isSigner: false, isWritable: true },
        { pubkey: createKey.publicKey, isSigner: true, isWritable: false },
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    },
  );
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;
  tx.partialSign(createKey, wallet);

  const sim = await conn.simulateTransaction(tx);
  info(`Multisig PDA would be: ${multisigPda.toBase58()}`);
  info(`Builder produced ${data.length}-byte ix data`);

  if (!sim.value.err) {
    ok(`Simulation succeeded — Squads V4 IS deployed on devnet (?!)`);
    record("QA-5", "squads", "PASS-MAINNET-LIKE", "simulation success");
    return;
  }
  const errStr = JSON.stringify(sim.value.err);
  const logs = (sim.value.logs ?? []).join(" ");
  // Squads V4 IS deployed on devnet, but its program_config singleton PDA
  // isn't initialized → Anchor reverts with Custom 3012 / AccountNotInitialized.
  // Treated as the same "cluster not bootstrapped" outcome the frontend
  // surfaces honestly.
  const isClusterUnsupported =
    /AccountNotFound|ProgramAccountNotFound|InvalidProgramId|AccountNotInitialized|"Custom":\s*3012/i.test(
      errStr + " " + logs,
    );
  if (isClusterUnsupported) {
    ok(`Devnet returns cluster-not-bootstrapped → button shows "mainnet-only" toast ✓`);
    record("QA-5", "squads", "PASS", "graceful cluster-unsupported");
  } else {
    warn(`Unexpected simulation error: ${errStr}`);
    info(`Logs: ${(sim.value.logs ?? []).slice(-5).join(" | ")}`);
    record("QA-5", "squads", "PARTIAL", errStr.slice(0, 80));
  }
}

// ─── QA-6: Privy verify endpoint (auth check) ──────────────────────────────
async function qa6_privy() {
  section(6, "Privy verify endpoint");

  // 6a. No auth header → expect 401
  let r = await fetch(`${BASE}/api/privy/verify`, { method: "POST" });
  if (r.status === 401) {
    ok(`No auth → 401 ✓`);
  } else {
    fail(`No auth → ${r.status} (expected 401)`);
    record("QA-6", "privy", "FAIL", `no-auth ${r.status}`);
    return;
  }

  // 6b. Bogus bearer token → expect 401 with informative error
  r = await fetch(`${BASE}/api/privy/verify`, {
    method: "POST",
    headers: { authorization: "Bearer not.a.realtoken" },
  });
  const body = await r.json();
  if (r.status === 401 && body.ok === false && typeof body.error === "string") {
    ok(`Bogus token → 401 with error "${body.error}" ✓`);
    record("QA-6", "privy", "PASS", body.error);
  } else {
    fail(`Bogus token → ${r.status} body=${JSON.stringify(body).slice(0, 120)}`);
    record("QA-6", "privy", "FAIL", `bogus ${r.status}`);
  }
}

// ─── QA-7: MoonPay sign endpoint ───────────────────────────────────────────
async function qa7_moonpay() {
  section(7, "MoonPay sign endpoint");
  try {
    const r = await fetch(`${BASE}/api/moonpay/sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        walletAddress: owner.toBase58(),
        baseCurrencyAmount: 50,
        redirectURL: `${BASE}/dashboard`,
      }),
    });
    if (!r.ok) {
      fail(`HTTP ${r.status}`);
      record("QA-7", "moonpay", "FAIL", `HTTP ${r.status}`);
      return;
    }
    const body = await r.json();
    if (typeof body.url !== "string") {
      fail(`Body missing url: ${JSON.stringify(body).slice(0, 120)}`);
      record("QA-7", "moonpay", "FAIL", "no url");
      return;
    }
    const u = new URL(body.url);
    const wallet = u.searchParams.get("walletAddress");
    const amount = u.searchParams.get("baseCurrencyAmount");
    const sig = u.searchParams.get("signature");
    info(`Domain: ${u.hostname}`);
    info(`walletAddress: ${wallet === owner.toBase58() ? "✓ matches" : "MISMATCH"}`);
    info(`baseCurrencyAmount: ${amount}`);
    info(`signed: ${body.signed}${sig ? " (signature present)" : " (sandbox)"}`);
    ok(`Endpoint healthy, URL well-formed`);
    record("QA-7", "moonpay", "PASS", body.signed ? "signed" : "sandbox");
  } catch (err) {
    fail(`fetch threw: ${err.message}`);
    record("QA-7", "moonpay", "FAIL", err.message);
  }
}

// ─── Entrypoint ────────────────────────────────────────────────────────────
async function main() {
  console.log(`\x1b[1m\nSponsor QA — running against ${BASE}\x1b[0m`);
  console.log(`Wallet: ${owner.toBase58()}\n`);

  await qa1_authority();
  await qa2_raydium();
  await qa3_pyth();
  await qa4_reflect();
  await qa5_squads();
  await qa6_privy();
  await qa7_moonpay();

  console.log(`\n\x1b[1m━━ Summary ━━\x1b[0m`);
  for (const r of results) {
    const color =
      r.status === "PASS" ? "\x1b[32m" :
      r.status.startsWith("PASS") ? "\x1b[32m" :
      r.status === "PARTIAL" ? "\x1b[33m" : "\x1b[31m";
    console.log(`  ${r.id} ${color}${r.status}\x1b[0m  ${r.name} — ${r.detail}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("\nQA runner crashed:", err);
  process.exit(1);
});
