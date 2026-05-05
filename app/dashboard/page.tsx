"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { SavingsChart } from "@/components/savings-chart";
import { WindowStatusCard } from "@/components/window-status-card";
import { useTideWallet } from "@/lib/hooks/use-tide-wallet";
import {
  useCurrentWindow,
  usePool,
  useUserIntent,
  useUserPosition,
} from "@/lib/hooks";
import { submitClaimAllocation, submitCommitIntent } from "@/lib/tide-actions";
import { calculateSavings, bpsToPct, formatSol, formatUsdc } from "@/lib/utils";

const STANDALONE_SLIPPAGE_BPS_DEFAULT = 50; // assumed retail spot/DCA reference

type ActionState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; signature: string }
  | { kind: "error"; message: string };

export default function DashboardPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { connected } = useTideWallet();
  const { pool, poolPubkey, loading: poolLoading } = usePool();
  const { position } = useUserPosition();
  const { window: currentWindow, windowPubkey } = useCurrentWindow();
  const { intent: pendingIntent } = useUserIntent(windowPubkey);
  const [claimState, setClaimState] = useState<ActionState>({ kind: "idle" });
  const [commitState, setCommitState] = useState<ActionState>({ kind: "idle" });

  const handleClaim = async () => {
    if (!windowPubkey || !currentWindow) return;
    setClaimState({ kind: "submitting" });
    const result = await submitClaimAllocation(connection, wallet, {
      poolPda: poolPubkey,
      windowPda: windowPubkey,
      windowNumber: currentWindow.windowNumber,
    });
    setClaimState(
      result.ok
        ? { kind: "success", signature: result.signature }
        : { kind: "error", message: result.error },
    );
  };

  const handleCommit = async () => {
    if (!windowPubkey || !currentWindow || !position) return;
    setCommitState({ kind: "submitting" });
    const result = await submitCommitIntent(connection, wallet, {
      poolPda: poolPubkey,
      windowPda: windowPubkey,
      windowNumber: currentWindow.windowNumber,
      amountUsdc: Number(position.amountPerWindow) / 1_000_000,
      maxSlippageBps: position.maxSlippageBps,
    });
    setCommitState(
      result.ok
        ? { kind: "success", signature: result.signature }
        : { kind: "error", message: result.error },
    );
  };

  if (!connected) {
    return (
      <EmptyState
        title="Connect your wallet"
        body="Sign in to see your DCA stats, current window status, and pending claims."
      />
    );
  }

  if (poolLoading) {
    return <EmptyState title="Loading pool…" body="Fetching on-chain state." />;
  }

  if (!pool) {
    return (
      <EmptyState
        title="Pool not initialized yet"
        body="The Tide USDC→SOL pool hasn't been created on this network. Run the admin init_pool flow first."
      />
    );
  }

  if (!position) {
    return (
      <EmptyState
        title="No DCA position yet"
        body="You haven't set up recurring DCA on this pool."
        cta={{ label: "Set up DCA", href: "/setup" }}
      />
    );
  }

  // ── Derived UI numbers ──
  const avgPoolSlippageBps = currentWindow?.effectiveSlippageBps ?? pool.feeBps;
  const totalSaved = calculateSavings(
    avgPoolSlippageBps,
    STANDALONE_SLIPPAGE_BPS_DEFAULT,
    position.totalDeposited,
  );
  const pendingClaim =
    pendingIntent && currentWindow?.status === 2 && !pendingIntent.claimed
      ? pendingIntent.allocatedAmount
      : 0n;
  const nextWindowSeconds = currentWindow
    ? Math.max(0, Number(currentWindow.endTs) - Math.floor(Date.now() / 1000))
    : 0;
  const nextLabel =
    nextWindowSeconds > 3600
      ? `in ${Math.floor(nextWindowSeconds / 3600)}h`
      : `in ${Math.floor(nextWindowSeconds / 60)}m`;
  const windowDurationLabel = `${Number(pool.windowDurationSeconds) / 60} minutes`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-400">
            Your Tide Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Saved {formatUsdc(totalSaved)} so far
          </h1>
        </div>
        <Link
          href="/setup"
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
        >
          Adjust DCA
        </Link>
      </header>

      <section className="mb-10 grid gap-4 md:grid-cols-4">
        <Card label="Total deposited" value={formatUsdc(position.totalDeposited)} />
        <Card label="Total acquired" value={formatSol(position.totalAcquired)} />
        <Card
          label="Avg slippage"
          value={bpsToPct(avgPoolSlippageBps)}
          subtext={`vs ${bpsToPct(STANDALONE_SLIPPAGE_BPS_DEFAULT)} standalone`}
        />
        <Card
          label="Last window joined"
          value={position.lastWindow.toString()}
        />
      </section>

      {/* Commit to current open window — only when user hasn't committed yet */}
      {currentWindow && currentWindow.status === 0 && !pendingIntent && (
        <section className="mb-10 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">
                Commit to window #{currentWindow.windowNumber.toString()}
              </h3>
              <p className="text-sm text-zinc-400">
                Deposit {formatUsdc(position.amountPerWindow)} into the encrypted
                pool. Your individual amount stays private; only the aggregate
                lands on chain.
              </p>
            </div>
            <button
              onClick={() => void handleCommit()}
              disabled={commitState.kind === "submitting"}
              className="rounded-md bg-cyan-500 px-4 py-2 font-medium text-zinc-900 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {commitState.kind === "submitting" ? "Committing…" : "Commit"}
            </button>
          </div>
          {commitState.kind === "success" && (
            <p className="mt-3 text-xs text-emerald-300">
              ✓ Committed.{" "}
              <a
                className="underline decoration-dotted underline-offset-2"
                href={`https://explorer.solana.com/tx/${commitState.signature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                View on Solana Explorer
              </a>
            </p>
          )}
          {commitState.kind === "error" && (
            <p className="mt-3 text-xs text-rose-300">✗ {commitState.message}</p>
          )}
        </section>
      )}

      {/* Already committed — show waiting state */}
      {currentWindow && currentWindow.status === 0 && pendingIntent && (
        <section className="mb-10 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <p className="text-sm text-zinc-400">
            ✓ You committed {formatUsdc(pendingIntent.amount)} to window #
            {currentWindow.windowNumber.toString()}. Waiting for window to
            close + aggregate.
          </p>
        </section>
      )}

      {pendingClaim > 0n && (
        <section className="mb-10 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Pending allocation</h3>
              <p className="text-sm text-zinc-400">
                {formatSol(pendingClaim)} ready to claim from window #
                {currentWindow?.windowNumber.toString()}
              </p>
            </div>
            <button
              onClick={() => void handleClaim()}
              disabled={claimState.kind === "submitting"}
              className="rounded-md bg-cyan-500 px-4 py-2 font-medium text-zinc-900 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {claimState.kind === "submitting" ? "Claiming…" : "Claim"}
            </button>
          </div>
          {claimState.kind === "success" && (
            <p className="mt-3 text-xs text-emerald-300">
              ✓ Claimed.{" "}
              <a
                className="underline decoration-dotted underline-offset-2"
                href={`https://explorer.solana.com/tx/${claimState.signature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                View on Solana Explorer
              </a>
            </p>
          )}
          {claimState.kind === "error" && (
            <p className="mt-3 text-xs text-rose-300">✗ {claimState.message}</p>
          )}
        </section>
      )}

      <section className="mb-10 grid gap-6 lg:grid-cols-2">
        {currentWindow ? (
          <WindowStatusCard
            totalCommitted={currentWindow.totalCommittedUsdc}
            participantCount={currentWindow.intentCount}
            endTs={Number(currentWindow.endTs)}
            status={currentWindow.status}
          />
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
            No active window. Run init_window to open the next cycle.
          </div>
        )}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          <h3 className="mb-4 font-semibold">Your Position</h3>
          <dl className="space-y-3 text-sm">
            <Row
              label="DCA amount per window"
              value={formatUsdc(position.amountPerWindow)}
            />
            <Row label="Window duration" value={windowDurationLabel} />
            <Row label="Max slippage" value={bpsToPct(position.maxSlippageBps)} />
            <Row
              label="Status"
              value={
                position.active ? (
                  <span className="text-emerald-400">Active</span>
                ) : (
                  <span className="text-zinc-400">Paused</span>
                )
              }
            />
            <Row label="Next contribution" value={nextLabel} />
          </dl>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">Cumulative Savings</h2>
        <SavingsChart />
      </section>

      <p className="mt-10 text-center text-xs text-zinc-600">
        Live data via @solana/web3.js account subscriptions. Savings curve still
        uses a synthetic series — backfill from Helius DAS once we have window
        history.
      </p>
    </main>
  );
}

function Card({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-2xl">{value}</div>
      {subtext && <div className="mt-1 text-xs text-zinc-500">{subtext}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-zinc-800 pb-2 last:border-0">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; href: Route };
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="mb-3 text-2xl font-semibold">{title}</h1>
      <p className="text-zinc-400">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-6 inline-block rounded-md bg-cyan-500 px-5 py-2 font-medium text-zinc-900 transition hover:bg-cyan-400"
        >
          {cta.label}
        </Link>
      )}
    </main>
  );
}
