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
  submitMintTestUsdc,
  submitTriggerAggregate,
} from "@/lib/tide-actions";
import { useToast } from "@/components/toast";
import { formatUsdc, shortAddress } from "@/lib/utils";
import { CURRENT_NETWORK } from "@/lib/constants";

export default function AdminPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const toast = useToast();
  const { pool, poolPubkey, loading: poolLoading } = usePool();
  const { window: currentWindow, windowPubkey } = useCurrentWindow();

  const [busyAction, setBusyAction] = useState<
    "init_pool" | "init_window" | "mint_usdc" | "trigger" | "swap" | null
  >(null);
  const [mintAmount, setMintAmount] = useState("1000");

  const runAction = async (
    name: "init_pool" | "init_window" | "mint_usdc" | "trigger" | "swap",
    label: string,
    runner: () => Promise<{ ok: boolean; signature?: string; error?: string }>,
  ) => {
    setBusyAction(name);
    try {
      const result = await runner();
      if (result.ok && result.signature) {
        toast.success(`${label} confirmed`, { explorerSig: result.signature });
      } else {
        toast.error(result.error ?? `${label} failed`);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleInitPool = () =>
    runAction("init_pool", "Pool initialized", () =>
      submitInitPool(connection, wallet, {}),
    );

  const handleInitWindow = () => {
    if (!pool) {
      toast.error("Pool not initialized. Run init_pool first.");
      return;
    }
    return runAction("init_window", "Window opened", () =>
      submitInitWindow(connection, wallet, poolPubkey, pool.windowCounter),
    );
  };

  const handleMintTestUsdc = () => {
    const amount = parseFloat(mintAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a positive USDC amount.");
      return;
    }
    return runAction("mint_usdc", `Minted ${amount} test USDC`, () =>
      submitMintTestUsdc(connection, wallet, { amountUsdc: amount }),
    );
  };

  const handleTriggerAggregate = () => {
    if (!windowPubkey) {
      toast.error("No active window.");
      return;
    }
    return runAction("trigger", "Aggregate triggered", () =>
      submitTriggerAggregate(connection, wallet, poolPubkey, windowPubkey),
    );
  };

  const handleExecuteSwap = () => {
    if (!windowPubkey || !currentWindow) {
      toast.error("No active window.");
      return;
    }
    return runAction("swap", "Swap executed", () =>
      submitExecuteSwap(connection, wallet, {
        poolPda: poolPubkey,
        windowPda: windowPubkey,
        windowNumber: currentWindow.windowNumber,
        totalCommittedUsdc: currentWindow.totalCommittedUsdc,
        minAcquiredAmount: 1n,
        slippageBps: 50,
      }),
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
        submitting={busyAction === "init_pool"}
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
        submitting={busyAction === "init_window"}
        onClick={handleInitWindow}
      />

      {CURRENT_NETWORK !== "mainnet" && (
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
              mint_test_usdc
            </h2>
            <span className="badge badge--accent">devnet faucet</span>
            {busyAction === "mint_usdc" && (
              <span className="badge badge--accent">
                <span className="dot dot--live" /> submitting
              </span>
            )}
          </div>
          <p
            className="muted"
            style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}
          >
            Mints fresh test USDC to your connected wallet. Skips Circle&apos;s
            faucet (region-blocked for many users). Requires the connected
            wallet to be the test mint authority.
          </p>

          <div
            className="flex"
            style={{
              alignItems: "center",
              gap: 14,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min={1}
                step={1}
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                disabled={busyAction === "mint_usdc"}
                style={{
                  width: 110,
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-1)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  color: "var(--text-0)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 14,
                }}
              />
              <span className="tiny mute2">USDC</span>
            </div>
            <button
              onClick={() => void handleMintTestUsdc()}
              disabled={!wallet.publicKey || busyAction === "mint_usdc"}
              className="btn btn--primary"
              title={!wallet.publicKey ? "Connect wallet" : undefined}
            >
              {busyAction === "mint_usdc" && (
                <span className="spinner spinner--sm" />
              )}
              {busyAction === "mint_usdc"
                ? "Minting…"
                : "Mint test USDC to my wallet"}
            </button>
            {!wallet.publicKey && (
              <span className="tiny mute2">— Connect wallet</span>
            )}
          </div>
        </section>
      )}

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
        submitting={busyAction === "trigger"}
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
        submitting={busyAction === "swap"}
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
  submitting,
  onClick,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  disabled: boolean;
  disabledReason?: string;
  submitting: boolean;
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
        {submitting && (
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
          disabled={disabled || submitting}
          className="btn btn--primary"
          title={disabledReason}
        >
          {submitting && <span className="spinner spinner--sm" />}
          {submitting ? "Submitting…" : buttonLabel}
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
