"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { SavingsChart } from "@/components/savings-chart";
import { WindowHistoryTable } from "@/components/window-history";
import { WindowStatusCard } from "@/components/window-status-card";
import { ReflectCard } from "@/components/reflect-card";
import { useTideWallet } from "@/lib/hooks/use-tide-wallet";
import {
  useCurrentWindow,
  usePool,
  useUserIntent,
  useUserPosition,
} from "@/lib/hooks";
import {
  submitClaimAllocation,
  submitCloseIntent,
  submitCommitIntent,
  submitRefundIntent,
} from "@/lib/tide-actions";
import { useToast } from "@/components/toast";
import { useCountUp } from "@/lib/hooks/use-count-up";
import {
  bpsToPct,
  calculateSavings,
  formatSol,
  formatUsdc,
} from "@/lib/utils";

const STANDALONE_SLIPPAGE_BPS_DEFAULT = 50;

export default function DashboardPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const toast = useToast();
  const { connected } = useTideWallet();
  const { pool, poolPubkey, loading: poolLoading } = usePool();
  const { position } = useUserPosition();
  const { window: currentWindow, windowPubkey } = useCurrentWindow();
  const { intent: pendingIntent } = useUserIntent(windowPubkey);
  const [claiming, setClaiming] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [closing, setClosing] = useState(false);

  // Pre-compute the headline savings number (defaults to 0n when pool /
  // position aren't ready so the hook order stays stable across renders).
  const headlineSavedRaw =
    pool && position
      ? calculateSavings(
          currentWindow?.effectiveSlippageBps ?? pool.feeBps,
          STANDALONE_SLIPPAGE_BPS_DEFAULT,
          position.totalDeposited,
        )
      : 0n;
  const animatedSavedDollars = useCountUp(
    Number(headlineSavedRaw) / 1_000_000,
  );

  const handleClaim = async () => {
    if (!windowPubkey || !currentWindow) return;
    setClaiming(true);
    try {
      const result = await submitClaimAllocation(connection, wallet, {
        poolPda: poolPubkey,
        windowPda: windowPubkey,
        windowNumber: currentWindow.windowNumber,
      });
      if (result.ok) {
        toast.success("Allocation claimed", { explorerSig: result.signature });
      } else {
        toast.error(result.error);
      }
    } finally {
      setClaiming(false);
    }
  };

  const handleCloseIntent = async () => {
    if (!windowPubkey) return;
    setClosing(true);
    try {
      const result = await submitCloseIntent(connection, wallet, {
        poolPda: poolPubkey,
        windowPda: windowPubkey,
      });
      if (result.ok) {
        toast.success("Intent closed (rent reclaimed)", {
          explorerSig: result.signature,
        });
      } else {
        toast.error(result.error);
      }
    } finally {
      setClosing(false);
    }
  };

  const handleRefund = async () => {
    if (!windowPubkey) return;
    setRefunding(true);
    try {
      const result = await submitRefundIntent(connection, wallet, {
        poolPda: poolPubkey,
        windowPda: windowPubkey,
      });
      if (result.ok) {
        toast.success("Refund issued", { explorerSig: result.signature });
      } else {
        toast.error(result.error);
      }
    } finally {
      setRefunding(false);
    }
  };

  const handleCommit = async () => {
    if (!windowPubkey || !currentWindow || !position) return;
    setCommitting(true);
    try {
      const result = await submitCommitIntent(connection, wallet, {
        poolPda: poolPubkey,
        windowPda: windowPubkey,
        windowNumber: currentWindow.windowNumber,
        amountUsdc: Number(position.amountPerWindow) / 1_000_000,
        maxSlippageBps: position.maxSlippageBps,
      });
      if (result.ok) {
        toast.success(
          `Committed ${formatUsdc(position.amountPerWindow)} to window #${currentWindow.windowNumber.toString()}`,
          { explorerSig: result.signature },
        );
      } else {
        toast.error(result.error);
      }
    } finally {
      setCommitting(false);
    }
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
    return <DashboardSkeleton />;
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
  const avgPoolSlippageBps =
    currentWindow?.effectiveSlippageBps ?? pool.feeBps;
  const totalSaved = calculateSavings(
    avgPoolSlippageBps,
    STANDALONE_SLIPPAGE_BPS_DEFAULT,
    position.totalDeposited,
  );
  const pendingClaim =
    pendingIntent && currentWindow?.status === 2 && !pendingIntent.claimed
      ? pendingIntent.allocatedAmount
      : 0n;
  // Refund eligibility: the window has been marked Failed (status==3)
  // and this user has an unclaimed intent on it. The exact amount comes
  // straight from intent.amount — escrow returns the full commit, no
  // pro-rata math like claim_allocation.
  const pendingRefund =
    pendingIntent && currentWindow?.status === 3 && !pendingIntent.claimed
      ? pendingIntent.amount
      : 0n;
  // Close eligibility: intent has been settled (claimed=true from either
  // claim_allocation or refund_intent). Account is ~0.002 SOL of rent
  // that the user can sweep back via close_intent.
  const canCloseIntent = !!pendingIntent && pendingIntent.claimed;
  const nextWindowSeconds = currentWindow
    ? Math.max(0, Number(currentWindow.endTs) - Math.floor(Date.now() / 1000))
    : 0;
  const nextLabel =
    nextWindowSeconds > 3600
      ? `in ${Math.floor(nextWindowSeconds / 3600)}h`
      : `in ${Math.floor(nextWindowSeconds / 60)}m`;
  const windowDurationLabel = `${
    Number(pool.windowDurationSeconds) / 60
  } minutes`;

  return (
    <main className="page page--wide">
      <header
        className="flex"
        style={{
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 36,
        }}
      >
        <div>
          <span className="eyebrow">Your Tide dashboard</span>
          <h1 className="page__h1" style={{ marginTop: 8 }}>
            Saved{" "}
            <span className="mono" style={{ color: "var(--accent)" }}>
              ${animatedSavedDollars.toFixed(2)}
            </span>{" "}
            so far
          </h1>
          <p className="page__sub" style={{ marginBottom: 0 }}>
            Live data from devnet · window subscription auto-updates
          </p>
        </div>
        <Link href="/setup" className="btn btn--ghost">
          Adjust DCA
        </Link>
      </header>

      <section
        className="grid grid--4"
        style={{ marginBottom: 28, gap: 16 }}
      >
        <KpiCard
          label="Total deposited"
          value={formatUsdc(position.totalDeposited)}
        />
        <KpiCard
          label="Total acquired"
          value={formatSol(position.totalAcquired)}
        />
        <KpiCard
          label="Avg slippage"
          value={bpsToPct(avgPoolSlippageBps)}
          subtext={`vs ${bpsToPct(
            STANDALONE_SLIPPAGE_BPS_DEFAULT,
          )} standalone`}
          accent
        />
        <KpiCard
          label="Last window joined"
          value={position.lastWindow.toString()}
        />
      </section>

      {/* Commit CTA — open window, no intent yet */}
      {currentWindow && currentWindow.status === 0 && !pendingIntent && (
        <ActionBanner
          title={`Commit to window #${currentWindow.windowNumber.toString()}`}
          body={
            <>
              Deposit{" "}
              <span className="mono" style={{ color: "var(--accent)" }}>
                {formatUsdc(position.amountPerWindow)}
              </span>{" "}
              into the encrypted pool. Your individual amount stays private;
              only the aggregate lands on chain.
            </>
          }
          actionLabel="Commit"
          onAction={() => void handleCommit()}
          submitting={committing}
        />
      )}

      {/* Already committed */}
      {currentWindow && currentWindow.status === 0 && pendingIntent && (
        <section
          className="card card--quiet"
          style={{ marginBottom: 24, padding: "16px 20px" }}
        >
          <p className="tiny" style={{ color: "var(--text-1)", margin: 0 }}>
            <span style={{ color: "var(--accent)", marginRight: 6 }}>✓</span>
            You committed{" "}
            <span className="mono">{formatUsdc(pendingIntent.amount)}</span>{" "}
            to window #{currentWindow.windowNumber.toString()}. Waiting for
            close + aggregate.
          </p>
        </section>
      )}

      {/* Pending claim */}
      {pendingClaim > 0n && (
        <ActionBanner
          title="Pending allocation"
          body={
            <>
              <span className="mono" style={{ color: "var(--accent)" }}>
                {formatSol(pendingClaim)}
              </span>{" "}
              ready to claim from window #
              {currentWindow?.windowNumber.toString()}
            </>
          }
          actionLabel="Claim"
          onAction={() => void handleClaim()}
          submitting={claiming}
        />
      )}

      {/* Pending refund (window was marked Failed) */}
      {pendingRefund > 0n && (
        <ActionBanner
          title="Refund available"
          body={
            <>
              Window #{currentWindow?.windowNumber.toString()} couldn't
              execute the swap (marked Failed). Pull your{" "}
              <span className="mono" style={{ color: "var(--warn)" }}>
                {formatUsdc(pendingRefund)}
              </span>{" "}
              commit back out of escrow.
            </>
          }
          actionLabel="Refund"
          onAction={() => void handleRefund()}
          submitting={refunding}
        />
      )}

      {/* Reclaim rent on settled intent */}
      {canCloseIntent && (
        <section
          className="card card--quiet"
          style={{
            marginBottom: 24,
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <p className="tiny" style={{ color: "var(--text-2)", margin: 0 }}>
            <span style={{ color: "var(--accent)", marginRight: 6 }}>✓</span>
            Intent settled for window #
            {currentWindow?.windowNumber.toString()}. Close the account
            to reclaim ~0.002 SOL of rent.
          </p>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void handleCloseIntent()}
            disabled={closing}
          >
            {closing ? <span className="spinner spinner--sm" /> : null}
            <span style={{ marginLeft: closing ? 8 : 0 }}>
              {closing ? "Closing…" : "Reclaim rent"}
            </span>
          </button>
        </section>
      )}

      <section
        className="grid grid--2"
        style={{ marginBottom: 28 }}
      >
        {currentWindow ? (
          <WindowStatusCard
            totalCommitted={currentWindow.totalCommittedUsdc}
            participantCount={currentWindow.intentCount}
            endTs={Number(currentWindow.endTs)}
            status={currentWindow.status}
          />
        ) : (
          <div className="card">
            <span className="card__title">Current window</span>
            <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
              No active window. Run init_window from /admin to open the next
              cycle.
            </p>
          </div>
        )}
        <div className="card">
          <span className="card__title">Your position</span>
          <dl
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              margin: 0,
              marginTop: 14,
              fontSize: 13.5,
            }}
          >
            <Row
              label="DCA amount per window"
              value={
                <span className="mono">
                  {formatUsdc(position.amountPerWindow)}
                </span>
              }
            />
            <Row label="Window duration" value={windowDurationLabel} />
            <Row
              label="Max slippage"
              value={
                <span className="mono">
                  {bpsToPct(position.maxSlippageBps)}
                </span>
              }
            />
            <Row
              label="Status"
              value={
                position.active ? (
                  <span className="badge badge--good">Active</span>
                ) : (
                  <span className="badge">Paused</span>
                )
              }
            />
            <Row
              label="Next contribution"
              value={<span className="mono">{nextLabel}</span>}
            />
          </dl>
        </div>
      </section>

      {currentWindow && pool && (
        <section style={{ marginBottom: 28 }}>
          <ReflectCard
            totalCommittedLamports={currentWindow.totalCommittedUsdc}
            windowSeconds={Number(pool.windowDurationSeconds)}
          />
        </section>
      )}

      <section style={{ marginBottom: 28 }}>
        <SavingsChart />
      </section>

      <section style={{ marginBottom: 28 }}>
        <WindowHistoryTable />
      </section>

      <p
        className="tiny mute2"
        style={{ textAlign: "center", marginTop: 24 }}
      >
        Live data via @solana/web3.js account subscriptions. Window history
        + savings chart hydrate as windows settle on chain.
      </p>
    </main>
  );
}

function KpiCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string;
  value: string;
  subtext?: string;
  accent?: boolean;
}) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="tiny mute2" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: accent ? "var(--accent)" : "var(--text-0)",
        }}
      >
        {value}
      </div>
      {subtext && (
        <div className="tiny mute2" style={{ marginTop: 4 }}>
          {subtext}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className="flex"
      style={{
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: 10,
        borderBottom: "1px solid var(--line-soft)",
      }}
    >
      <dt className="muted" style={{ fontSize: 13 }}>
        {label}
      </dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  );
}

function ActionBanner({
  title,
  body,
  actionLabel,
  onAction,
  submitting,
}: {
  title: string;
  body: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  submitting: boolean;
}) {
  return (
    <section
      className="card"
      style={{
        marginBottom: 24,
        borderColor: "var(--accent-line)",
        background:
          "linear-gradient(180deg, rgba(6,182,212,0.04), transparent 60%), var(--bg-2)",
      }}
    >
      <div
        className="flex"
        style={{
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h3>
          <p
            className="muted"
            style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.5 }}
          >
            {body}
          </p>
        </div>
        <button
          onClick={onAction}
          disabled={submitting}
          className="btn btn--primary"
        >
          {submitting && <span className="spinner spinner--sm" />}
          {submitting ? `${actionLabel}…` : actionLabel}
        </button>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <main className="page page--wide">
      <header style={{ marginBottom: 36 }}>
        <div className="skeleton skeleton--badge" style={{ marginBottom: 12 }} />
        <div
          className="skeleton skeleton--big"
          style={{ width: "60%", height: 36, marginBottom: 8 }}
        />
        <div
          className="skeleton skeleton--block"
          style={{ width: "40%", height: 14 }}
        />
      </header>
      <section
        className="grid grid--4"
        style={{ marginBottom: 28, gap: 16 }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ padding: 18 }}>
            <div
              className="skeleton skeleton--block"
              style={{ width: "60%", height: 11, marginBottom: 10 }}
            />
            <div
              className="skeleton skeleton--big"
              style={{ width: "75%", height: 24 }}
            />
          </div>
        ))}
      </section>
      <section
        className="grid"
        style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}
      >
        {[0, 1].map((i) => (
          <div key={i} className="card">
            <div
              className="skeleton skeleton--block"
              style={{ width: "40%", height: 12, marginBottom: 18 }}
            />
            <div
              className="skeleton skeleton--big"
              style={{ width: "100%", height: 38, marginBottom: 14 }}
            />
            <div
              className="skeleton skeleton--block"
              style={{ width: "100%", marginBottom: 8 }}
            />
            <div
              className="skeleton skeleton--block"
              style={{ width: "80%" }}
            />
          </div>
        ))}
      </section>
    </main>
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
    <main
      className="page page--narrow"
      style={{ textAlign: "center", paddingTop: 80, paddingBottom: 80 }}
    >
      <h1 className="page__h1" style={{ fontSize: 26 }}>
        {title}
      </h1>
      <p className="page__sub">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="btn btn--primary"
          style={{ marginTop: 8 }}
        >
          {cta.label}
        </Link>
      )}
    </main>
  );
}
