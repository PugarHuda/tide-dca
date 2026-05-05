"use client";

/**
 * Admin / cron-runner page for Tide.
 *
 * Two operations live here:
 *   1. init_pool   — one-time, creates the canonical USDC -> SOL pool.
 *   2. init_window — permissionless, opens the next aggregation cycle.
 *
 * Anyone can call init_window once a cycle completes, but in practice this
 * page is the operator's "hit button to advance" tool until we run a cron.
 *
 * NOT shown in the main nav — admin reaches it by URL.
 */

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { useCurrentWindow, usePool } from "@/lib/hooks";
import {
  submitExecuteSwap,
  submitInitPool,
  submitInitWindow,
  submitTriggerAggregate,
} from "@/lib/tide-actions";
import { formatUsdc, shortAddress } from "@/lib/utils";

type ActionState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; signature: string }
  | { kind: "error"; message: string };

export default function AdminPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { pool, poolPubkey, loading: poolLoading } = usePool();
  const { window: currentWindow, windowPubkey } = useCurrentWindow();

  const [poolState, setPoolState] = useState<ActionState>({ kind: "idle" });
  const [windowState, setWindowState] = useState<ActionState>({ kind: "idle" });
  const [aggregateState, setAggregateState] = useState<ActionState>({ kind: "idle" });
  const [swapState, setSwapState] = useState<ActionState>({ kind: "idle" });

  const handleInitPool = async () => {
    setPoolState({ kind: "submitting" });
    const result = await submitInitPool(connection, wallet, {});
    setPoolState(
      result.ok
        ? { kind: "success", signature: result.signature }
        : { kind: "error", message: result.error },
    );
  };

  const handleInitWindow = async () => {
    if (!pool) {
      setWindowState({ kind: "error", message: "Pool not initialized. Run init_pool first." });
      return;
    }
    setWindowState({ kind: "submitting" });
    const result = await submitInitWindow(connection, wallet, poolPubkey, pool.windowCounter);
    setWindowState(
      result.ok
        ? { kind: "success", signature: result.signature }
        : { kind: "error", message: result.error },
    );
  };

  const handleTriggerAggregate = async () => {
    if (!windowPubkey) {
      setAggregateState({ kind: "error", message: "No active window." });
      return;
    }
    setAggregateState({ kind: "submitting" });
    const result = await submitTriggerAggregate(connection, wallet, poolPubkey, windowPubkey);
    setAggregateState(
      result.ok
        ? { kind: "success", signature: result.signature }
        : { kind: "error", message: result.error },
    );
  };

  const handleExecuteSwap = async () => {
    if (!windowPubkey || !currentWindow) {
      setSwapState({ kind: "error", message: "No active window." });
      return;
    }
    setSwapState({ kind: "submitting" });
    // Min acquired = 0 here is unsafe in production; for MVP we trust the
    // Jupiter quote's slippage guard (passed inside swap-instructions). To
    // tighten this, call fetchQuote first and pass otherAmountThreshold.
    const result = await submitExecuteSwap(connection, wallet, {
      poolPda: poolPubkey,
      windowPda: windowPubkey,
      windowNumber: currentWindow.windowNumber,
      totalCommittedUsdc: currentWindow.totalCommittedUsdc,
      minAcquiredAmount: 1n,
      slippageBps: 50,
    });
    setSwapState(
      result.ok
        ? { kind: "success", signature: result.signature }
        : { kind: "error", message: result.error },
    );
  };

  const windowStatusLabel =
    currentWindow == null
      ? "—"
      : ["Open", "Aggregating", "Distributed", "Failed"][currentWindow.status];

  // ── trigger_aggregate gating ──
  // Program requires (a) clock >= window.end_ts AND (b) total_committed >= min_pool_size.
  // Reflect both in the UI so users don't button-mash through an inevitable revert.
  const nowSec = Math.floor(Date.now() / 1000);
  const windowExpired =
    !!currentWindow && nowSec >= Number(currentWindow.endTs);
  const aggregateThresholdMet =
    !!currentWindow &&
    !!pool &&
    currentWindow.totalCommittedUsdc >= pool.minPoolSizeUsdc;
  const secondsUntilExpiry =
    currentWindow ? Math.max(0, Number(currentWindow.endTs) - nowSec) : 0;
  const expiryLabel =
    secondsUntilExpiry > 3600
      ? `${Math.floor(secondsUntilExpiry / 3600)}h ${Math.floor((secondsUntilExpiry % 3600) / 60)}m`
      : secondsUntilExpiry > 60
        ? `${Math.floor(secondsUntilExpiry / 60)}m ${secondsUntilExpiry % 60}s`
        : `${secondsUntilExpiry}s`;

  const triggerAggregateDisabled =
    !currentWindow ||
    currentWindow.status !== 0 ||
    !windowExpired ||
    !aggregateThresholdMet ||
    !wallet.publicKey;

  const triggerAggregateReason = !wallet.publicKey
    ? "Connect wallet"
    : !currentWindow
      ? "No active window"
      : currentWindow.status !== 0
        ? `Window not open (status: ${windowStatusLabel})`
        : !windowExpired
          ? `Window closes in ${expiryLabel}`
          : !aggregateThresholdMet && pool
            ? `Below threshold: ${formatUsdc(currentWindow.totalCommittedUsdc)} of ${formatUsdc(pool.minPoolSizeUsdc)} required`
            : undefined;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-widest text-cyan-400">
          Operator Console
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Tide admin / cron tools
        </h1>
        <p className="mt-2 text-zinc-400">
          One-time pool initialization + permissionless window advancement.
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="mb-3 font-semibold">Pool state</h2>
        {poolLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : pool ? (
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <Row label="Pool PDA" value={shortAddress(poolPubkey.toBase58())} />
            <Row
              label="Authority"
              value={shortAddress(pool.authority.toBase58())}
            />
            <Row
              label="Active window"
              value={
                pool.activeWindow.equals(PublicKey.default)
                  ? "—"
                  : shortAddress(pool.activeWindow.toBase58())
              }
            />
            <Row
              label="Window counter"
              value={pool.windowCounter.toString()}
            />
            <Row
              label="Min pool size"
              value={formatUsdc(pool.minPoolSizeUsdc)}
            />
            <Row
              label="Fee"
              value={`${(pool.feeBps / 100).toFixed(2)}%`}
            />
            <Row
              label="Total volume"
              value={formatUsdc(pool.totalVolumeProcessed)}
            />
          </dl>
        ) : (
          <p className="text-sm text-zinc-500">
            No Pool account at{" "}
            <code className="text-zinc-400">{shortAddress(poolPubkey.toBase58())}</code>
            {" "}— run init_pool below.
          </p>
        )}
      </section>

      <ActionCard
        title="init_pool"
        description="Creates the canonical USDC -> SOL pool with default config (1h windows, 100 USDC min, 5 bps fee)."
        buttonLabel="Initialize Pool"
        disabled={!!pool || !wallet.publicKey}
        disabledReason={
          !wallet.publicKey
            ? "Connect wallet"
            : pool
              ? "Pool already exists"
              : undefined
        }
        state={poolState}
        onClick={handleInitPool}
      />

      <ActionCard
        title="init_window"
        description={
          pool
            ? `Opens window #${pool.windowCounter.toString()} for new commits.`
            : "Opens the next aggregation window. Pool must exist."
        }
        buttonLabel="Open Next Window"
        disabled={!pool || !wallet.publicKey}
        disabledReason={
          !wallet.publicKey
            ? "Connect wallet"
            : !pool
              ? "Pool not initialized"
              : undefined
        }
        state={windowState}
        onClick={handleInitWindow}
      />

      <ActionCard
        title="trigger_aggregate"
        description={
          currentWindow && pool
            ? `Closes window #${currentWindow.windowNumber.toString()} and flips status to Aggregating. Status: ${windowStatusLabel}. Committed: ${formatUsdc(currentWindow.totalCommittedUsdc)} of ${formatUsdc(pool.minPoolSizeUsdc)} min.`
            : "Closes the active window and flips status to Aggregating."
        }
        buttonLabel="Trigger Aggregate"
        disabled={triggerAggregateDisabled}
        disabledReason={triggerAggregateReason}
        state={aggregateState}
        onClick={handleTriggerAggregate}
      />

      <ActionCard
        title="execute_swap"
        description="Pulls a Jupiter quote (USDC -> SOL, direct routes only) and forwards the swap instruction as a CPI signed by the escrow PDA. Requires window status = Aggregating."
        buttonLabel="Execute Swap (Jupiter)"
        disabled={!currentWindow || currentWindow.status !== 1 || !wallet.publicKey}
        disabledReason={
          !wallet.publicKey
            ? "Connect wallet"
            : !currentWindow
              ? "No active window"
              : currentWindow.status !== 1
                ? `Window not Aggregating (status: ${windowStatusLabel})`
                : undefined
        }
        state={swapState}
        onClick={handleExecuteSwap}
      />
    </main>
  );
}

function ActionCard({
  title,
  description,
  buttonLabel,
  disabled,
  disabledReason,
  state,
  onClick,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  disabled: boolean;
  disabledReason?: string;
  state: ActionState;
  onClick: () => void | Promise<void>;
}) {
  return (
    <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-400">{description}</p>

      {state.kind === "success" && (
        <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
          ✓ Confirmed.{" "}
          <a
            href={`https://explorer.solana.com/tx/${state.signature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-2"
          >
            View on Solana Explorer
          </a>
        </div>
      )}
      {state.kind === "error" && (
        <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
          ✗ {state.message}
        </div>
      )}

      <button
        onClick={() => void onClick()}
        disabled={disabled || state.kind === "submitting"}
        className="mt-4 rounded-md bg-cyan-500 px-4 py-2 font-medium text-zinc-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        title={disabledReason}
      >
        {state.kind === "submitting" ? "Submitting…" : buttonLabel}
      </button>
      {disabled && disabledReason && (
        <span className="ml-3 text-xs text-zinc-500">— {disabledReason}</span>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-mono text-zinc-200">{value}</dd>
    </>
  );
}
