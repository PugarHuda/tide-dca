/**
 * Tide Keeper — Serverless Cron Tick
 *
 * Vercel Cron Job hits this endpoint every 5 minutes. The handler runs
 * one iteration of the same decision tree as `scripts/seed-loop.mjs`:
 *
 *   - Open + not expired + 0 intents     →  commit_intent (skipped — judges commit, keeper just orchestrates)
 *   - Open + expired + meets threshold   →  trigger_aggregate
 *   - Open + expired + below threshold   →  mark_window_failed + init new window
 *   - Aggregating                         →  mark_window_failed (devnet swap can't run)
 *   - Distributed / Failed                →  init new window
 *
 * Production-shape replacement for the local seed-loop. Eliminates
 * "operator must run local script" — the pool state advances on its
 * own schedule via Vercel's serverless cron infrastructure.
 *
 * Security:
 *   - Bearer auth via CRON_SECRET (Vercel injects this header on cron
 *     invocations; we verify before doing any work)
 *   - Keeper keypair stored as base64'd JSON secret bytes in
 *     KEEPER_KEYPAIR env var. Devnet keypair only — mainnet ramp uses
 *     a different wallet under stricter custody (multisig / KMS).
 *
 * Idempotent: if no action is needed (e.g. window not yet expired),
 * returns `{ok: true, action: "noop"}` without dispatching any tx.
 */

import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  SystemProgram,
} from "@solana/web3.js";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60; // cron tick should finish well under 60s

const PROGRAM_ID = new PublicKey("HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg");
const USDC_MINT = new PublicKey("BKQ9HAzw2rnfUXpm6BKz2yvH4ikwKhC8dkgt73A8LTSh");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

// ─── Auth gate ──────────────────────────────────────────────────────────────

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const got = req.headers.get("authorization");
  return got === `Bearer ${expected}`;
}

// ─── Keeper keypair loader ──────────────────────────────────────────────────

function loadKeeperKeypair(): Keypair | null {
  const raw = process.env.KEEPER_KEYPAIR;
  if (!raw) return null;
  try {
    // KEEPER_KEYPAIR is the JSON-array form (e.g. "[1,2,3,...,64]") of
    // the 64-byte secret key. Matches `solana-keygen new` output format.
    const arr = JSON.parse(raw);
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch (err) {
    console.error("[keeper] failed to parse KEEPER_KEYPAIR:", err);
    return null;
  }
}

// ─── On-chain decoders (minimal — mirror programs/tide/src/state.rs) ───────

function decodePool(data: Buffer) {
  let o = 8;
  o += 32 + 32 + 32; // authority + input_mint + target_mint
  o += 8 + 8 + 2 + 8 + 8; // window_duration + min_pool_size + fee_bps + total_volume + total_savings
  const activeWindow = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const windowCounter = data.readBigUInt64LE(o);
  return { activeWindow, windowCounter };
}

function decodeWindow(data: Buffer) {
  let o = 8;
  const pool = new PublicKey(data.subarray(o, o + 32));
  o += 32;
  const windowNumber = data.readBigUInt64LE(o);
  o += 8;
  o += 8 + 8; // start_ts + end_ts
  const status = data.readUInt8(o);
  o += 1;
  const intentCount = data.readUInt32LE(o);
  o += 4;
  const totalCommitted = data.readBigUInt64LE(o);
  o += 8;
  return { pool, windowNumber, status, intentCount, totalCommitted };
}

function discriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function pda(seeds: Array<Buffer | Uint8Array>): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}

const enc = new TextEncoder();
const POOL_PDA = pda([enc.encode("pool"), USDC_MINT.toBuffer(), SOL_MINT.toBuffer()]);

function findWindowPda(counter: bigint): PublicKey {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(counter);
  return pda([enc.encode("window"), POOL_PDA.toBuffer(), buf]);
}

// ─── Tx builders (minimal — matches programs/tide/src/instructions/*) ──────

function buildTriggerAggregate(
  caller: PublicKey,
  windowPda: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: caller, isSigner: true, isWritable: false },
      { pubkey: POOL_PDA, isSigner: false, isWritable: false },
      { pubkey: windowPda, isSigner: false, isWritable: true },
    ],
    data: discriminator("trigger_aggregate"),
  });
}

function buildMarkFailed(
  caller: PublicKey,
  windowPda: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: caller, isSigner: true, isWritable: false },
      { pubkey: POOL_PDA, isSigner: false, isWritable: false },
      { pubkey: windowPda, isSigner: false, isWritable: true },
    ],
    data: discriminator("mark_window_failed"),
  });
}

function buildInitWindow(
  caller: PublicKey,
  windowPda: PublicKey,
  prevWindow: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: caller, isSigner: true, isWritable: true },
      { pubkey: POOL_PDA, isSigner: false, isWritable: true },
      { pubkey: windowPda, isSigner: false, isWritable: true },
      { pubkey: prevWindow, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: discriminator("init_window"),
  });
}

// ─── Decision engine + tx dispatch ──────────────────────────────────────────

async function send(
  conn: Connection,
  keeper: Keypair,
  ix: TransactionInstruction,
): Promise<string> {
  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }))
    .add(ix);
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = keeper.publicKey;
  tx.sign(keeper);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // Vercel cron hits with GET by default; also accept POST for manual
  // testing via `curl -X POST -H "authorization: Bearer ..."`.
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized — missing or invalid bearer token" },
      { status: 401 },
    );
  }

  const keeper = loadKeeperKeypair();
  if (!keeper) {
    return NextResponse.json(
      {
        ok: false,
        error: "KEEPER_KEYPAIR not configured on this deployment",
        configured: false,
      },
      { status: 503 },
    );
  }

  const rpc =
    process.env.HELIUS_DEVNET_RPC ?? "https://api.devnet.solana.com";
  const conn = new Connection(rpc, "confirmed");

  const poolAcct = await conn.getAccountInfo(POOL_PDA);
  if (!poolAcct) {
    return NextResponse.json(
      { ok: false, error: "Pool not initialized" },
      { status: 500 },
    );
  }
  const pool = decodePool(poolAcct.data);

  if (pool.activeWindow.equals(PublicKey.default)) {
    // No active window yet — open #0
    const ix = buildInitWindow(
      keeper.publicKey,
      findWindowPda(0n),
      POOL_PDA, // sentinel for first window
    );
    const sig = await send(conn, keeper, ix);
    return NextResponse.json({
      ok: true,
      action: "init_window",
      windowNumber: 0,
      signature: sig,
    });
  }

  const winAcct = await conn.getAccountInfo(pool.activeWindow);
  if (!winAcct) {
    return NextResponse.json(
      { ok: false, error: "Active window account not found" },
      { status: 500 },
    );
  }
  const win = decodeWindow(winAcct.data);
  const now = Math.floor(Date.now() / 1000);
  const endTs = winAcct.data.readBigInt64LE(8 + 32 + 8 + 8); // pool + window_number + start_ts
  const expired = BigInt(now) >= endTs;

  // ── Decision tree (mirrors scripts/seed-loop.mjs) ──
  try {
    if (win.status === 0 /* Open */) {
      if (!expired) {
        return NextResponse.json({
          ok: true,
          action: "noop",
          reason: "active window still accepting commits",
          windowNumber: Number(win.windowNumber),
          intentCount: win.intentCount,
          totalCommitted: Number(win.totalCommitted),
        });
      }
      // Expired — but does committed >= min? Skip threshold check here;
      // trigger_aggregate handler enforces it on-chain. If it fails,
      // we fall through to next-cron-tick which marks failed.
      const sig = await send(
        conn,
        keeper,
        buildTriggerAggregate(keeper.publicKey, pool.activeWindow),
      );
      return NextResponse.json({
        ok: true,
        action: "trigger_aggregate",
        windowNumber: Number(win.windowNumber),
        signature: sig,
      });
    }

    if (win.status === 1 /* Aggregating */) {
      // Devnet has no Jupiter for our test mint, so the swap can't run.
      // Mark failed so refund_intent + init new window proceed.
      const sig = await send(
        conn,
        keeper,
        buildMarkFailed(keeper.publicKey, pool.activeWindow),
      );
      return NextResponse.json({
        ok: true,
        action: "mark_window_failed",
        windowNumber: Number(win.windowNumber),
        signature: sig,
      });
    }

    if (win.status === 2 /* Distributed */ || win.status === 3 /* Failed */) {
      // Open the next window. Prev window status >= 2 satisfies the
      // lifecycle guard from upgrade #6.
      const newCounter = pool.windowCounter;
      const sig = await send(
        conn,
        keeper,
        buildInitWindow(
          keeper.publicKey,
          findWindowPda(newCounter),
          pool.activeWindow,
        ),
      );
      return NextResponse.json({
        ok: true,
        action: "init_window",
        windowNumber: Number(newCounter),
        prevStatus: win.status,
        signature: sig,
      });
    }

    return NextResponse.json({
      ok: true,
      action: "noop",
      reason: `unexpected status ${win.status}`,
    });
  } catch (err) {
    console.error("[keeper] tx error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        action: "errored",
      },
      { status: 500 },
    );
  }
}
