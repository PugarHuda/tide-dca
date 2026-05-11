"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Interactive Tide simulation — judges can experience the product
 * without connecting a wallet. Each phase renders the actual UI shape
 * (cards, banners, buttons) the live app shows at that point, but with
 * mocked state instead of on-chain reads.
 *
 * Phase progression:
 *   welcome      → user lands, sees value prop
 *   connect      → wallet connect modal (mocked)
 *   setup        → DCA form fill (auto-fills, click submit)
 *   committed    → success state + dashboard preview
 *   active       → window open, countdown ticking
 *   expired      → countdown hit 0, awaiting aggregate
 *   aggregating  → status flipped to 1, MPC compute animation
 *   distributed  → status 2, claim button visible
 *   claimed      → SOL received + close_intent CTA
 *   (failure branch — separate tab)
 *   failed       → status 3, refund button visible
 *   refunded     → USDC returned + close_intent CTA
 *
 * Auto-advances every 7s; pause on hover. Manual prev/next available.
 * Each phase has an "explainer" line showing what's happening on-chain.
 */

const AUTO_ADVANCE_MS = 7000;

type Phase =
  | "welcome"
  | "connect"
  | "setup"
  | "committed"
  | "active"
  | "expired"
  | "aggregating"
  | "distributed"
  | "claimed"
  | "failed"
  | "refunded";

type Branch = "happy" | "failure";

const HAPPY_PATH: Phase[] = [
  "welcome",
  "connect",
  "setup",
  "committed",
  "active",
  "expired",
  "aggregating",
  "distributed",
  "claimed",
];

const FAILURE_PATH: Phase[] = [
  "welcome",
  "connect",
  "setup",
  "committed",
  "active",
  "expired",
  "aggregating",
  "failed",
  "refunded",
];

export function DemoSimulation() {
  const [branch, setBranch] = useState<Branch>("happy");
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);

  const path = branch === "happy" ? HAPPY_PATH : FAILURE_PATH;
  const phase = path[phaseIdx];

  // Auto-advance — pause on hover OR explicit pause
  useEffect(() => {
    if (paused || hovering) return;
    const id = setInterval(() => {
      setPhaseIdx((i) => (i + 1) % path.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, hovering, path.length]);

  const goPrev = () =>
    setPhaseIdx((i) => (i - 1 + path.length) % path.length);
  const goNext = () => setPhaseIdx((i) => (i + 1) % path.length);

  const progress = ((phaseIdx + 1) / path.length) * 100;

  return (
    <section
      className="card"
      style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Header — branch toggle + progress */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          className="flex"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div className="flex" style={{ gap: 8, alignItems: "center" }}>
            <span className="eyebrow" style={{ margin: 0 }}>
              Interactive sandbox
            </span>
            <span className="tiny mute2">
              · phase {phaseIdx + 1} of {path.length}
            </span>
          </div>
          <div className="flex" style={{ gap: 6 }}>
            <button
              type="button"
              className={`btn btn--sm ${
                branch === "happy" ? "btn--primary" : "btn--ghost"
              }`}
              onClick={() => {
                setBranch("happy");
                setPhaseIdx(0);
              }}
              aria-pressed={branch === "happy"}
            >
              Happy path
            </button>
            <button
              type="button"
              className={`btn btn--sm ${
                branch === "failure" ? "btn--primary" : "btn--ghost"
              }`}
              onClick={() => {
                setBranch("failure");
                setPhaseIdx(0);
              }}
              aria-pressed={branch === "failure"}
            >
              Failure → refund
            </button>
          </div>
        </div>
        <div
          style={{
            height: 3,
            background: "var(--bg-2)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background:
                branch === "failure" ? "var(--warn)" : "var(--accent)",
              transition: "width 0.6s ease-out",
            }}
          />
        </div>
      </div>

      {/* Main stage — renders mocked UI per phase */}
      <div style={{ padding: "28px 24px", minHeight: 360 }}>
        <Stage phase={phase} branch={branch} />
      </div>

      {/* Controls */}
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--line)",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={goPrev}
          aria-label="Previous phase"
        >
          ← Prev
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={goNext}
          aria-label="Next phase"
        >
          Next →
        </button>
        <div style={{ flex: 1 }} />
        <span className="tiny mute2">
          {paused || hovering
            ? "paused — hover or pause held"
            : `auto-advances in ${Math.ceil(AUTO_ADVANCE_MS / 1000)}s`}
        </span>
      </div>
    </section>
  );
}

// ─── Phase stages — each is a tiny visual narrative ────────────────────────

function Stage({ phase, branch }: { phase: Phase; branch: Branch }) {
  switch (phase) {
    case "welcome":
      return <WelcomeStage />;
    case "connect":
      return <ConnectStage />;
    case "setup":
      return <SetupStage />;
    case "committed":
      return <CommittedStage />;
    case "active":
      return <ActiveWindowStage />;
    case "expired":
      return <ExpiredStage />;
    case "aggregating":
      return <AggregatingStage branch={branch} />;
    case "distributed":
      return <DistributedStage />;
    case "claimed":
      return <ClaimedStage />;
    case "failed":
      return <FailedStage />;
    case "refunded":
      return <RefundedStage />;
    default:
      return null;
  }
}

function PhaseHeader({
  title,
  subtitle,
  badge,
  badgeColor = "accent",
}: {
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: "accent" | "good" | "warn" | "neutral";
}) {
  const badgeBg = {
    accent: "var(--accent-glow)",
    good: "rgba(34, 197, 94, 0.16)",
    warn: "var(--warn-soft)",
    neutral: "var(--bg-2)",
  }[badgeColor];
  const badgeColor2 = {
    accent: "var(--accent)",
    good: "var(--good)",
    warn: "var(--warn)",
    neutral: "var(--text-2)",
  }[badgeColor];
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        className="flex"
        style={{ alignItems: "center", gap: 10, marginBottom: 6 }}
      >
        <h3 className="page__h2" style={{ margin: 0, fontSize: 20 }}>
          {title}
        </h3>
        {badge && (
          <span
            style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 999,
              background: badgeBg,
              color: badgeColor2,
              fontWeight: 500,
              letterSpacing: 0.2,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <p
        className="muted"
        style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function MockButton({
  label,
  variant = "primary",
  icon,
}: {
  label: string;
  variant?: "primary" | "ghost";
  icon?: string;
}) {
  return (
    <span
      className={`btn ${variant === "primary" ? "btn--primary" : "btn--ghost"}`}
      style={{ pointerEvents: "none", cursor: "default" }}
      aria-hidden
    >
      {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
      {label}
    </span>
  );
}

function WelcomeStage() {
  return (
    <>
      <PhaseHeader
        title="Land at tide-dca.vercel.app"
        subtitle="Visitor sees the hero — predator eyes scanning, value prop loud."
        badge="public"
        badgeColor="neutral"
      />
      <div
        className="card card--quiet"
        style={{ padding: 24, textAlign: "center" }}
      >
        <h2
          style={{
            fontSize: 32,
            fontWeight: 600,
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          We see the bots.
          <br />
          <span style={{ color: "var(--accent)" }}>
            They can&apos;t see us.
          </span>
        </h2>
        <p
          className="muted"
          style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6 }}
        >
          Tide hides every DCA buy inside an encrypted aggregate window.
          Bots watching the mempool see one anonymous swap — never your
          individual order.
        </p>
        <div
          className="flex"
          style={{ gap: 10, justifyContent: "center", marginTop: 18 }}
        >
          <MockButton label="Start DCA" icon="🌊" />
          <MockButton label="How it works" variant="ghost" />
        </div>
      </div>
    </>
  );
}

function ConnectStage() {
  return (
    <>
      <PhaseHeader
        title="Connect wallet"
        subtitle="Custom modal lists every Wallet Standard wallet plus Privy email login. 24h sliding session TTL means active users stay connected within the day."
        badge="wallet"
        badgeColor="neutral"
      />
      <div
        className="card card--quiet"
        style={{ padding: 20, maxWidth: 380, margin: "0 auto" }}
      >
        <div
          className="tiny mute2"
          style={{
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Sign in to Tide
        </div>
        {["Phantom", "Solflare", "Backpack", "Email · Privy"].map((w, i) => (
          <div
            key={w}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              borderRadius: 6,
              background: i === 0 ? "var(--accent-glow)" : "transparent",
              marginBottom: 4,
              fontSize: 13,
              border: i === 0 ? "1px solid var(--accent-line)" : "none",
            }}
          >
            <span>{w}</span>
            <span className="tiny mute2">
              {i === 0 ? "Detected ✓" : "Not installed"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function SetupStage() {
  return (
    <>
      <PhaseHeader
        title="Setup recurring DCA"
        subtitle="One-time config: amount per window + max slippage. Form auto-validates NaN inputs and exposes preset chips for common amounts."
        badge="setup_dca_position"
        badgeColor="accent"
      />
      <div className="card card--quiet" style={{ padding: 20 }}>
        <div className="grid grid--2" style={{ gap: 14 }}>
          <div>
            <div className="tiny mute2" style={{ marginBottom: 6 }}>
              Amount per window
            </div>
            <div
              className="mono"
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "var(--text-0)",
              }}
            >
              $50.00
            </div>
            <div className="flex" style={{ gap: 4, marginTop: 8 }}>
              {["$20", "$50", "$100"].map((v, i) => (
                <span
                  key={v}
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background:
                      i === 1 ? "var(--accent-glow)" : "var(--bg-2)",
                    color: i === 1 ? "var(--accent)" : "var(--text-2)",
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="tiny mute2" style={{ marginBottom: 6 }}>
              Max slippage
            </div>
            <div
              className="mono"
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "var(--text-0)",
              }}
            >
              1.0%
            </div>
            <div
              style={{
                height: 4,
                background: "var(--bg-2)",
                borderRadius: 2,
                marginTop: 14,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "10%",
                  top: -3,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "var(--accent)",
                }}
              />
            </div>
          </div>
        </div>
        <div className="tideline" style={{ margin: "16px 0" }} />
        <MockButton label="Create DCA position" />
      </div>
    </>
  );
}

function CommittedStage() {
  return (
    <>
      <PhaseHeader
        title="Position created · tx signed"
        subtitle="setup_dca_position landed on-chain. Success state shows the explorer tx link + next-step CTA."
        badge="✓ confirmed"
        badgeColor="good"
      />
      <div
        className="card card--quiet"
        style={{
          padding: 20,
          background: "rgba(34, 197, 94, 0.08)",
          borderColor: "rgba(34, 197, 94, 0.3)",
        }}
      >
        <div className="eyebrow" style={{ color: "var(--good)" }}>
          ✓ DCA position created
        </div>
        <h3
          className="page__h2"
          style={{ marginTop: 8, marginBottom: 10, fontSize: 18 }}
        >
          Your DCA pool subscription is live
        </h3>
        <p
          className="muted"
          style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}
        >
          Next: head to the dashboard to commit your first $50 to the
          current window.
        </p>
        <div
          className="card"
          style={{
            padding: 12,
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
          }}
        >
          <span className="tiny mute2">setup_dca_position tx</span>
          <span className="mono" style={{ color: "var(--accent)" }}>
            G1sD9YprNFmqFcmGAZFEHfgpjxLH9WAJTR7sMdfhvXud
          </span>
        </div>
        <div className="flex" style={{ gap: 10, marginTop: 14 }}>
          <MockButton label="View dashboard →" />
          <MockButton label="Adjust position" variant="ghost" />
        </div>
      </div>
    </>
  );
}

function ActiveWindowStage() {
  return (
    <>
      <PhaseHeader
        title="Active window — commit your intent"
        subtitle="Window #8 is open. Encrypted intent + escrow USDC land on-chain in one tx. Bots see the bucket grow; individual amounts hidden via Arcium ciphertext."
        badge="status: Open"
        badgeColor="good"
      />
      <div className="card card--quiet" style={{ padding: 20 }}>
        <div
          className="flex"
          style={{ justifyContent: "space-between", marginBottom: 12 }}
        >
          <span className="card__title">Current window</span>
          <span
            style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 999,
              background: "rgba(34, 197, 94, 0.16)",
              color: "var(--good)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--good)",
                display: "inline-block",
                marginRight: 4,
                boxShadow: "0 0 6px var(--good)",
              }}
            />
            Open for commits
          </span>
        </div>
        <div style={{ textAlign: "center", margin: "12px 0 20px" }}>
          <div
            className="tiny mute2"
            style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Closes in
          </div>
          <div
            className="mono"
            style={{
              fontSize: 38,
              fontWeight: 600,
              marginTop: 4,
              color: "var(--text-0)",
            }}
          >
            14m{" "}
            <span style={{ color: "var(--accent)" }}>23s</span>
          </div>
        </div>
        <div className="grid grid--2" style={{ gap: 16 }}>
          <div>
            <div className="tiny mute2">Pool size</div>
            <div
              className="mono"
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "var(--accent)",
              }}
            >
              $610.00
            </div>
          </div>
          <div>
            <div className="tiny mute2">Participants</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>
              12
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <MockButton label="Commit $50 to this window" icon="🌊" />
        </div>
      </div>
    </>
  );
}

function ExpiredStage() {
  return (
    <>
      <PhaseHeader
        title="Window closed — awaiting trigger"
        subtitle="Countdown hit zero. Any wallet can now call trigger_aggregate (permissionless). On Tide prod, scripts/seed-loop or the Vercel Cron keeper handles this automatically."
        badge="status: Open · expired"
        badgeColor="warn"
      />
      <div className="card card--quiet" style={{ padding: 20 }}>
        <div style={{ textAlign: "center", margin: "12px 0 20px" }}>
          <div
            className="tiny mute2"
            style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Awaiting trigger_aggregate
          </div>
          <div
            className="mono"
            style={{
              fontSize: 38,
              fontWeight: 600,
              marginTop: 4,
              color: "var(--text-3)",
            }}
          >
            00m <span style={{ color: "var(--warn)" }}>00s</span>
          </div>
        </div>
        <div
          className="tiny"
          style={{
            padding: 10,
            background: "var(--warn-soft)",
            borderRadius: 6,
            color: "var(--text-1)",
            lineHeight: 1.5,
            border: "1px solid rgba(245, 158, 11, 0.3)",
          }}
        >
          ⏱ Window expired with{" "}
          <span className="mono">$610</span> committed across 12
          participants. Any caller can flip status to Aggregating.
        </div>
      </div>
    </>
  );
}

function AggregatingStage({ branch }: { branch: Branch }) {
  return (
    <>
      <PhaseHeader
        title={
          branch === "failure"
            ? "Aggregating — swap won't execute"
            : "Aggregating — MPC compute in flight"
        }
        subtitle={
          branch === "failure"
            ? "trigger_aggregate fired but Jupiter has no route (rare mainnet condition, simulated). Pool authority will mark Failed → users refund."
            : "Encrypted intents now feed Arcium MPC nodes. Total + count revealed; individuals stay hidden. Aggregate USDC → Jupiter v6 routes IOC."
        }
        badge="status: Aggregating"
        badgeColor="warn"
      />
      <div className="card card--quiet" style={{ padding: 20 }}>
        <div
          className="flex"
          style={{ justifyContent: "center", gap: 14, padding: "20px 0" }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background:
                  branch === "failure" ? "var(--warn)" : "var(--accent)",
                opacity: 0.4 + (i % 3) * 0.2,
                animation: `pulse 1.4s ${i * 0.15}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
        <div className="tideline" style={{ margin: "8px 0" }} />
        <div
          className="grid grid--2"
          style={{ gap: 16, fontSize: 13, marginTop: 14 }}
        >
          <div>
            <div className="tiny mute2">Aggregate total</div>
            <div className="mono" style={{ fontSize: 18, color: "var(--accent)" }}>
              $610.00
            </div>
          </div>
          <div>
            <div className="tiny mute2">Participants</div>
            <div className="mono" style={{ fontSize: 18 }}>
              12
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DistributedStage() {
  return (
    <>
      <PhaseHeader
        title="Swap complete — your share is ready"
        subtitle="execute_swap landed a single atomic Jupiter v6 IOC swap. Pyth oracle decoded the spot price; realized slippage stored on-chain. Pro-rata math: your_share = (intent.amount × window.acquired) / window.total_committed."
        badge="status: Distributed"
        badgeColor="accent"
      />
      <div className="card card--quiet" style={{ padding: 20 }}>
        <div
          className="card"
          style={{
            padding: 14,
            background: "var(--accent-glow)",
            borderColor: "var(--accent-line)",
            marginBottom: 14,
          }}
        >
          <div
            className="flex"
            style={{ justifyContent: "space-between", marginBottom: 6 }}
          >
            <span className="eyebrow" style={{ margin: 0 }}>
              Pending allocation
            </span>
            <span
              className="mono"
              style={{ color: "var(--accent)", fontSize: 18 }}
            >
              0.4112 SOL
            </span>
          </div>
          <p className="tiny mute2" style={{ margin: 0 }}>
            ready to claim from window #8
          </p>
        </div>
        <div className="grid grid--2" style={{ gap: 16, fontSize: 13 }}>
          <Stat label="Realized slippage" value="0.04%" accent />
          <Stat label="vs solo DCA" value="~0.51%" />
        </div>
        <div style={{ marginTop: 16 }}>
          <MockButton label="Claim 0.4112 SOL" icon="◎" />
        </div>
      </div>
    </>
  );
}

function ClaimedStage() {
  return (
    <>
      <PhaseHeader
        title="SOL received · close to reclaim rent"
        subtitle="claim_allocation transferred the pro-rata SOL to your wallet. Intent account is now reclaimable (~0.002 SOL rent) via close_intent."
        badge="✓ claimed"
        badgeColor="good"
      />
      <div
        className="card card--quiet"
        style={{
          padding: 20,
          background: "rgba(34, 197, 94, 0.08)",
          borderColor: "rgba(34, 197, 94, 0.3)",
        }}
      >
        <div className="eyebrow" style={{ color: "var(--good)" }}>
          ✓ Allocation claimed
        </div>
        <div
          className="flex"
          style={{
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 8,
          }}
        >
          <span>Your wallet</span>
          <span
            className="mono"
            style={{ fontSize: 22, color: "var(--good)" }}
          >
            +0.4112 SOL
          </span>
        </div>
        <div className="tideline" style={{ margin: "14px 0" }} />
        <div
          className="flex"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <p
            className="tiny"
            style={{ color: "var(--text-2)", margin: 0, flex: 1, minWidth: 200 }}
          >
            <span style={{ color: "var(--accent)", marginRight: 6 }}>✓</span>
            Intent settled. Close the account to reclaim ~0.002 SOL of rent.
          </p>
          <MockButton label="Reclaim rent" variant="ghost" />
        </div>
      </div>
    </>
  );
}

function FailedStage() {
  return (
    <>
      <PhaseHeader
        title="Window marked Failed — escape hatch fired"
        subtitle="Pool authority called mark_window_failed (status 1 → 3). Unlocks refund_intent for every participant. Tide's safety net: funds never get permanently stuck."
        badge="status: Failed"
        badgeColor="warn"
      />
      <div
        className="card card--quiet"
        style={{
          padding: 20,
          background: "var(--warn-soft)",
          borderColor: "rgba(245, 158, 11, 0.32)",
        }}
      >
        <div className="eyebrow" style={{ color: "var(--warn)" }}>
          Refund available
        </div>
        <h3
          className="page__h2"
          style={{ marginTop: 8, marginBottom: 8, fontSize: 18 }}
        >
          Window #8 couldn&apos;t execute the swap
        </h3>
        <p
          className="muted"
          style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0 }}
        >
          Pull your{" "}
          <span className="mono" style={{ color: "var(--warn)" }}>
            $50.00
          </span>{" "}
          commit back out of escrow. No partial settlement — full
          intent.amount returns to your wallet.
        </p>
        <div style={{ marginTop: 16 }}>
          <MockButton label="Refund $50" icon="↩" />
        </div>
      </div>
    </>
  );
}

function RefundedStage() {
  return (
    <>
      <PhaseHeader
        title="USDC returned · close to reclaim rent"
        subtitle="refund_intent transferred intent.amount back from escrow to your USDC ATA. Same intent.claimed flag prevents double-refund + refund-then-claim."
        badge="✓ refunded"
        badgeColor="warn"
      />
      <div
        className="card card--quiet"
        style={{
          padding: 20,
          background: "var(--warn-soft)",
          borderColor: "rgba(245, 158, 11, 0.32)",
        }}
      >
        <div className="eyebrow" style={{ color: "var(--warn)" }}>
          ✓ Refund issued
        </div>
        <div
          className="flex"
          style={{
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 8,
          }}
        >
          <span>Your wallet</span>
          <span
            className="mono"
            style={{ fontSize: 22, color: "var(--warn)" }}
          >
            +$50.00 USDC
          </span>
        </div>
        <div className="tideline" style={{ margin: "14px 0" }} />
        <p
          className="tiny mute2"
          style={{ margin: 0, lineHeight: 1.5 }}
        >
          Validated end-to-end on devnet: wallet went from $950 → $1000
          via refund_intent tx{" "}
          <span className="mono">SDrdCnJ3...</span>. Same escape hatch
          covers any future window that can&apos;t complete.
        </p>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="tiny mute2">{label}</div>
      <div
        className="mono"
        style={{
          fontSize: 18,
          color: accent ? "var(--accent)" : "var(--text-0)",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
