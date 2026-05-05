"use client";

/**
 * Admin / cron-runner page for Tide. Restyled with the design's class system;
 * functional logic + on-chain wiring unchanged.
 *
 * Lifecycle order: init_pool → init_window → trigger_aggregate → execute_swap.
 * Each ActionCard's disabled state mirrors the on-chain require!s so users
 * don't button-mash through reverts.
 */

import { Fragment, useState } from "react";
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
  const [aggregateState, setAggregateState] = useState<ActionState>({
    kind: "idle",
  });
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
      setWindowState({
        kind: "error",
        message: "Pool not initialized. Run init_pool first.",
      });
      return;
    }
    setWindowState({ kind: "submitting" });
    const result = await submitInitWindow(
      connection,
      wallet,
      poolPubkey,
      pool.windowCounter,
    );
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
    const result = await submitTriggerAggregate(
      connection,
      wallet,
      poolPubkey,
      windowPubkey,
    );
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

  // ── trigger_aggregate gating mirrors program require!s ──
  const nowSec = Math.floor(Date.now() / 1000);
  const windowExpired =
    !!currentWindow && nowSec >= Number(currentWindow.endTs);
  const aggregateThresholdMet =
    !!currentWindow &&
    !!pool &&
    currentWindow.totalCommittedUsdc >= pool.minPoolSizeUsdc;
  const secondsUntilExpiry = currentWindow
    ? Math.max(0, Number(currentWindow.endTs) - nowSec)
    : 0;
  const expiryLabel =
    secondsUntilExpiry > 3600
      ? `${Math.floor(secondsUntilExpiry / 3600)}h ${Math.floor(
          (secondsUntilExpiry % 3600) / 60,
        )}m`
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
            ? `Below threshold: ${formatUsdc(
                currentWindow.totalCommittedUsdc,
              )} of ${formatUsdc(pool.minPoolSizeUsdc)} required`
            : undefined;

  return (
    <main className="page page--narrow">
      <div style={{ marginBottom: 36 }}>
        <span className="eyebrow">Operator Console</span>
        <h1 className="page__h1" style={{ marginTop: 8 }}>
          Tide admin / cron tools
        </h1>
        <p className="page__sub">
          One-time pool init + permissionless window advancement +
          aggregation/swap orchestration.
        </p>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card__head">
          <span className="card__title">Pool state</span>
          {pool && <span className="badge badge--accent">live</span>}
        </div>

        {poolLoading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "max-content 1fr",
              rowGap: 10,
              columnGap: 24,
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <Fragment key={i}>
                <div
                  className="skeleton skeleton--block"
                  style={{ width: 100, height: 12 }}
                />
                <div
                  className="skeleton skeleton--block"
                  style={{ width: 180, height: 12 }}
                />
              </Fragment>
            ))}
          </div>
        ) : pool ? (
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "max-content 1fr",
              rowGap: 8,
              columnGap: 24,
              fontSize: 13.5,
              margin: 0,
            }}
          >
            <Row
              label="Pool PDA"
              value={shortAddress(poolPubkey.toBase58())}
            />
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
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            No Pool account at{" "}
            <code className="mono mute2">
              {shortAddress(poolPubkey.toBase58())}
            </code>{" "}
            — run init_pool below.
          </p>
        )}
      </section>

      <ActionCard
        title="init_pool"
        description="Creates the canonical USDC → SOL pool with default config (1h windows, 100 USDC min, 5 bps fee)."
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
        description="Pulls a Jupiter quote (USDC → SOL) and forwards the swap as a CPI signed by the escrow PDA. Requires window status = Aggregating."
        buttonLabel="Execute Swap (Jupiter)"
        disabled={
          !currentWindow ||
          currentWindow.status !== 1 ||
          !wallet.publicKey
        }
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
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card__head" style={{ marginBottom: 8 }}>
        <h2
          className="mono"
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 500,
            color: "var(--text-0)",
          }}
        >
          {title}
        </h2>
        {state.kind === "success" && (
          <span className="badge badge--good">confirmed</span>
        )}
        {state.kind === "submitting" && (
          <span className="badge badge--accent">
            <span className="dot dot--live" /> submitting
          </span>
        )}
      </div>
      <p
        className="muted"
        style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}
      >
        {description}
      </p>

      {state.kind === "success" && (
        <p
          className="tiny"
          style={{
            marginTop: 12,
            marginBottom: 0,
            color: "var(--good)",
          }}
        >
          ✓ Confirmed.{" "}
          <a
            href={`https://explorer.solana.com/tx/${state.signature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "underline" }}
          >
            View on Solana Explorer
          </a>
        </p>
      )}
      {state.kind === "error" && (
        <p
          className="tiny"
          style={{
            marginTop: 12,
            marginBottom: 0,
            color: "var(--bad)",
          }}
        >
          ✗ {state.message}
        </p>
      )}

      <div
        className="flex"
        style={{
          alignItems: "center",
          gap: 14,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => void onClick()}
          disabled={disabled || state.kind === "submitting"}
          className="btn btn--primary"
          title={disabledReason}
        >
          {state.kind === "submitting" ? "Submitting…" : buttonLabel}
        </button>
        {disabled && disabledReason && (
          <span className="tiny mute2">— {disabledReason}</span>
        )}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="muted" style={{ fontSize: 13 }}>
        {label}
      </dt>
      <dd className="mono" style={{ margin: 0, color: "var(--text-1)" }}>
        {value}
      </dd>
    </>
  );
}
