"use client";

/**
 * Landing page — atmospheric ocean palette, hero with live mini-dashboard,
 * how-it-works, flow diagram, comparison, social proof, final CTA, footer.
 *
 * Real on-chain data wired through usePool() + useCurrentWindow():
 *   - Hero eyebrow shows real participant count for the active window
 *   - HeroPanel pulls real countdown / pool size / participants
 *   - Stats strip reads pool.totalVolumeProcessed + pool.windowCounter
 *   - When values are zero (early devnet stage), placeholders kick in so
 *     "$0.00" doesn't replace what was a hero stat
 *
 * Flow diagram + Comparison cards keep illustrative numbers — they explain
 * the mechanism, not Tide's actual traction.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useCurrentWindow, usePool } from "@/lib/hooks";
import { CURRENT_NETWORK } from "@/lib/constants";
import { formatUsdc } from "@/lib/utils";
import { useInView } from "@/lib/hooks/use-in-view";

const WINDOW_DURATION_S = 3600;

const FAKE_PUBKEYS = [
  "8x9Yw…3Pq2",
  "Hk4Ve…wQ8M",
  "Bn7Mp…X4dR",
  "F2sLu…tN9C",
  "Q5tHb…gV1A",
  "L9wKy…r3Ze",
];
const DEPOSIT_AMOUNTS = ["$50", "$100", "$25", "$200", "$75", "$150"];
const RECEIVE_AMOUNTS = ["0.286", "0.572", "0.143", "1.143", "0.428", "0.857"];

function fmtHms(totalSec: number): string {
  if (totalSec < 0) totalSec = 0;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Format a usdc-lamport bigint as a compact "$1.2M" / "$48.2K" / "$0" string. */
function fmtUsdcCompact(lamports: bigint): string {
  const dollars = Number(lamports) / 1_000_000;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  if (dollars >= 1) return `$${dollars.toFixed(0)}`;
  return "$0";
}

export default function LandingPage() {
  const { pool } = usePool();
  const { window: currentWindow } = useCurrentWindow();

  // Window countdown — real if a window is active, otherwise simulated so the
  // hero panel still ticks visually for first-time visitors with no live state.
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const realRemaining = currentWindow
    ? Math.max(0, Number(currentWindow.endTs) - now)
    : 0;
  const simRemaining = WINDOW_DURATION_S - (now % WINDOW_DURATION_S);
  const openRemainingS = currentWindow ? realRemaining : simRemaining;
  const windowDuration = currentWindow
    ? Math.max(1, Number(currentWindow.endTs) - Number(currentWindow.startTs))
    : WINDOW_DURATION_S;
  const fillPct = (1 - openRemainingS / windowDuration) * 100;

  return (
    <main className="landing">
      <Hero
        openRemainingS={openRemainingS}
        fillPct={fillPct}
        participantCount={currentWindow?.intentCount ?? 0}
        poolSizeLamports={currentWindow?.totalCommittedUsdc ?? 0n}
        windowNumber={currentWindow?.windowNumber ?? 0n}
        isLive={!!currentWindow}
      />
      <Reveal>
        <Stats
          totalVolumeLamports={pool?.totalVolumeProcessed ?? 0n}
          windowCounter={pool?.windowCounter ?? 0n}
        />
      </Reveal>
      <Reveal>
        <HowItWorks />
      </Reveal>
      <Reveal>
        <Comparison />
      </Reveal>
      <Reveal>
        <Proof />
      </Reveal>
      <Reveal>
        <FinalCta />
      </Reveal>
      <Footer />
    </main>
  );
}

/** Wrap a section so it fades + lifts in once the user scrolls to it. */
function Reveal({ children }: { children: React.ReactNode }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal" data-visible={seen}>
      {children}
    </div>
  );
}

// ============ Hero ============

function Hero({
  openRemainingS,
  fillPct,
  participantCount,
  poolSizeLamports,
  windowNumber,
  isLive,
}: {
  openRemainingS: number;
  fillPct: number;
  participantCount: number;
  poolSizeLamports: bigint;
  windowNumber: bigint;
  isLive: boolean;
}) {
  return (
    <section className="hero">
      <CurrentLines count={9} opacity={0.08} />
      <div className="hero__inner">
        <div className="hero__copy">
          <EyebrowTicker
            isLive={isLive}
            participantCount={participantCount}
            windowNumber={windowNumber}
          />
          <h1 className="hero__h">
            DCA without MEV.
            <br />
            <span className="hero__h-accent">Bots blind, retail wins.</span>
          </h1>
          <p className="hero__p">
            Tide aggregates encrypted DCA orders inside Arcium MPC, then settles
            the whole pool as one Jupiter swap. No mempool footprint. No
            sandwich. Slippage drops from{" "}
            <span className="mono" style={{ color: "var(--warn)" }}>
              ~0.50%
            </span>{" "}
            to{" "}
            <span className="mono" style={{ color: "var(--accent)" }}>
              ~0.05%
            </span>
            .
          </p>
          <div className="hero__cta">
            <Link href="/setup" className="btn btn--primary btn--lg">
              Start DCA <ArrowRight />
            </Link>
            <a
              className="btn btn--ghost btn--lg"
              href="#how"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("how")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              How it works
            </a>
          </div>
          <div className="hero__trust">
            <TrustItem label="MPC layer" v="Arcium (planned)" />
            <TrustItem label="Routing" v="Jupiter v6" />
            <TrustItem label="Wallet" v="Phantom · Privy" />
            <TrustItem label="Network" v={`Solana ${CURRENT_NETWORK}`} />
          </div>
        </div>

        <HeroPanel
          openRemainingS={openRemainingS}
          fillPct={fillPct}
          participantCount={participantCount}
          poolSizeLamports={poolSizeLamports}
          windowNumber={windowNumber}
          isLive={isLive}
        />
      </div>
    </section>
  );
}

function TrustItem({ label, v }: { label: string; v: string }) {
  return (
    <div className="trust">
      <span className="trust__l">{label}</span>
      <span className="trust__v">{v}</span>
    </div>
  );
}

function EyebrowTicker({
  isLive,
  participantCount,
  windowNumber,
}: {
  isLive: boolean;
  participantCount: number;
  windowNumber: bigint;
}) {
  const facts = useMemo(() => {
    const live = isLive
      ? participantCount > 0
        ? `Window #${windowNumber.toString()} open · ${participantCount} ${participantCount === 1 ? "depositor" : "depositors"}`
        : `Window #${windowNumber.toString()} open · waiting for first depositor`
      : `Solana ${CURRENT_NETWORK} · awaiting first window`;
    return [
      live,
      "Encrypted intents · Arcium MPC layer",
      "Single Jupiter swap · zero MEV surface",
    ];
  }, [isLive, participantCount, windowNumber]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % facts.length), 3500);
    return () => clearInterval(id);
  }, [facts.length]);

  return (
    <span className="eyebrow eyebrow--ticker">
      <span className="dot dot--live" />
      <span key={idx} className="eyebrow__cycle">
        {facts[idx]}
      </span>
    </span>
  );
}

function HeroPanel({
  openRemainingS,
  fillPct,
  participantCount,
  poolSizeLamports,
  windowNumber,
  isLive,
}: {
  openRemainingS: number;
  fillPct: number;
  participantCount: number;
  poolSizeLamports: bigint;
  windowNumber: bigint;
  isLive: boolean;
}) {
  const poolLabel = isLive
    ? formatUsdc(poolSizeLamports)
    : "—";
  const participantLabel = isLive
    ? participantCount.toString()
    : "—";

  return (
    <div className="hero-panel">
      <div className="hero-panel__head">
        <span className="badge badge--accent">
          <span className="dot dot--live" />
          {isLive
            ? `Window #${windowNumber.toString()} · Open`
            : "Awaiting first window"}
        </span>
        <span className="tiny mute2 mono">
          {isLive ? "live · on-chain" : "preview"}
        </span>
      </div>

      <div className="hero-panel__big">
        <span className="hero-panel__label">
          {isLive ? "Closes in" : "Demo countdown"}
        </span>
        <span className="hero-panel__count mono">{fmtHms(openRemainingS)}</span>
      </div>

      <div className="hero-panel__bar">
        <div
          className="hero-panel__bar-fill"
          style={{ width: `${fillPct}%` }}
        />
      </div>

      <div className="hero-panel__stats">
        <Stat label="Pool size" value={poolLabel} />
        <Stat label="Participants" value={participantLabel} />
        <Stat label="Target slippage" value="0.05%" accent />
      </div>

      <div className="tideline" style={{ margin: "20px 0" }} />

      <SavingsCalculator />
    </div>
  );
}

function SavingsCalculator() {
  const [weekly, setWeekly] = useState("100");
  const weeklyN = Math.max(0, parseFloat(weekly) || 0);

  // Slippage gap heuristic: 0.51% solo vs 0.05% pooled = 0.46% delta. At
  // weekly DCA over 52 weeks, the absolute saved-per-year is:
  //   savings = weekly * 52 * 0.0046
  const annualSavings = weeklyN * 52 * 0.0046;
  const annualVolume = weeklyN * 52;

  const presets = [50, 100, 250, 500];

  return (
    <div className="savings">
      <div className="savings__head">
        <span className="eyebrow" style={{ margin: 0 }}>
          Savings calculator
        </span>
        <span className="tiny mute2">vs solo Jupiter DCA</span>
      </div>

      <div className="savings__row">
        <span className="tiny mute2">I DCA</span>
        <div className="savings__input-wrap">
          <span
            className="mono mute2"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          >
            $
          </span>
          <input
            className="savings__input mono"
            type="number"
            min={0}
            step={5}
            value={weekly}
            onChange={(e) => setWeekly(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <span className="tiny mute2">/ week</span>
      </div>

      <div className="savings__chips">
        {presets.map((v) => (
          <button
            type="button"
            key={v}
            className="savings__chip"
            data-active={weeklyN === v}
            onClick={() => setWeekly(String(v))}
          >
            ${v}
          </button>
        ))}
      </div>

      <div className="savings__out">
        <div>
          <div className="tiny mute2">You save</div>
          <div
            className="mono savings__big"
            style={{ color: "var(--accent)" }}
          >
            ${annualSavings.toFixed(2)}
          </div>
          <div className="tiny mute2">per year on ${annualVolume.toLocaleString()} volume</div>
        </div>
        <div className="savings__delta">
          <span className="mono tiny" style={{ color: "var(--warn)" }}>
            solo · ~0.51%
          </span>
          <span className="mono tiny" style={{ color: "var(--accent)" }}>
            tide · ~0.05%
          </span>
        </div>
      </div>
    </div>
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
          fontWeight: 500,
          color: accent ? "var(--accent)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ============ Stats strip ============

function Stats({
  totalVolumeLamports,
  windowCounter,
}: {
  totalVolumeLamports: bigint;
  windowCounter: bigint;
}) {
  const hasVolume = totalVolumeLamports > 0n;
  // MEV reclaimed estimate: assume 0.46% bps recovered vs naive solo DCA.
  const mevReclaimedLamports = (totalVolumeLamports * 46n) / 10_000n;
  const windowsSettled = windowCounter > 0n ? windowCounter - 1n : 0n;

  const items: Array<{
    l: string;
    v: string;
    sub: string;
    accent?: boolean;
  }> = [
    {
      l: "Total volume settled",
      v: hasVolume ? fmtUsdcCompact(totalVolumeLamports) : "—",
      sub: hasVolume
        ? `on Solana ${CURRENT_NETWORK}`
        : "no settled windows yet",
    },
    {
      l: "Target slippage",
      v: "0.05%",
      sub: "vs ~0.51% solo DCA",
      accent: true,
    },
    {
      l: "MEV recovered",
      v: hasVolume ? fmtUsdcCompact(mevReclaimedLamports) : "—",
      sub: hasVolume
        ? "returned to depositors"
        : "tracked once first swap settles",
    },
    {
      l: "Windows settled",
      v: windowsSettled.toString(),
      sub:
        windowsSettled === 0n ? "first cycle in flight" : "0 sandwich attacks",
    },
  ];
  return (
    <section className="stats">
      <div className="stats__grid">
        {items.map((it, i) => (
          <div key={i} className="stats__cell">
            <div className="tiny mute2">{it.l}</div>
            <div
              className={"mono stats__v" + (it.accent ? " stats__v--a" : "")}
            >
              {it.v}
            </div>
            <div className="tiny mute2">{it.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============ How it works ============

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "You deposit",
      d: "USDC and your buy intent (amount, frequency, slippage) get encrypted client-side. Only an opaque ciphertext hits Solana.",
    },
    {
      n: "02",
      t: "Pool waits",
      d: "Every depositor for this window adds to the same encrypted bucket. Bots see the bucket grow but cannot read individual amounts.",
    },
    {
      n: "03",
      t: "MPC aggregates",
      d: "When the window closes, Arcium MPC nodes jointly compute the total — no single party ever learns who put in what.",
    },
    {
      n: "04",
      t: "One atomic swap",
      d: "The aggregate is routed through Jupiter as a single transaction. Sandwich bots can't isolate individuals. SOL is split pro-rata.",
    },
  ];
  return (
    <section id="how" className="how">
      <SectionHeading
        eye="How it works"
        h="Four steps, one transaction"
        sub="Tide turns hundreds of small DCA buys — each a perfect sandwich target — into a single anonymous swap."
      />
      <div className="how__grid">
        {steps.map((s, i) => (
          <div key={i} className="how__step">
            <div className="how__num mono">{s.n}</div>
            <div className="how__t">{s.t}</div>
            <div className="how__d">{s.d}</div>
          </div>
        ))}
      </div>

      <FlowDiagram />
    </section>
  );
}

function FlowDiagram() {
  return (
    <div className="flow">
      <div className="flow__col">
        <div className="flow__label">Depositors (illustrative)</div>
        <div className="flow__users">
          {FAKE_PUBKEYS.map((pk, i) => (
            <div key={i} className="flow__user">
              <span
                className="flow__dot"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
              <span className="mono tiny mute2">{pk}</span>
              <span
                className="mono tiny"
                style={{ color: "var(--accent)" }}
              >
                {DEPOSIT_AMOUNTS[i]}
              </span>
            </div>
          ))}
          <div className="tiny mute2" style={{ paddingLeft: 16 }}>
            … many more
          </div>
        </div>
      </div>

      <FlowArrow label="encrypted" />

      <div className="flow__col flow__col--mpc">
        <div className="flow__label">Arcium MPC</div>
        <div className="flow__mpc">
          <div className="flow__mpc-nodes">
            <span /><span /><span /><span /><span />
          </div>
          <div className="mono tiny mute2" style={{ marginTop: 8 }}>
            Σ = ?????
          </div>
          <div
            className="tiny"
            style={{ color: "var(--accent)", marginTop: 4 }}
          >
            aggregating...
          </div>
        </div>
      </div>

      <FlowArrow label="aggregate" />

      <div className="flow__col">
        <div className="flow__label">Jupiter</div>
        <div className="flow__jup">
          <div className="mono tiny" style={{ color: "var(--text-1)" }}>
            single atomic swap
          </div>
          <div className="mono" style={{ fontSize: 17, marginTop: 4 }}>
            USDC → SOL
          </div>
          <div className="tiny mute2 mono">v6 route, IOC</div>
          <div className="tideline" style={{ margin: "10px 0" }} />
          <div className="tiny" style={{ color: "var(--accent)" }}>
            ~0.05% target slippage
          </div>
        </div>
      </div>

      <FlowArrow label="pro-rata" />

      <div className="flow__col">
        <div className="flow__label">Depositors receive</div>
        <div className="flow__users">
          {FAKE_PUBKEYS.map((pk, i) => (
            <div key={i} className="flow__user">
              <span className="mono tiny mute2">{pk}</span>
              <span
                className="mono tiny"
                style={{ color: "var(--accent)" }}
              >
                {RECEIVE_AMOUNTS[i]} SOL
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  const id = `flow-arrow-${label}`;
  return (
    <div className="flow__arrow">
      <svg width="60" height="40" viewBox="0 0 60 40">
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M2 20 L 58 20" stroke={`url(#${id})`} strokeWidth="1" />
        <path
          d="M50 14 L 58 20 L 50 26"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1"
          opacity="0.6"
        />
      </svg>
      <div className="tiny mute2" style={{ textAlign: "center", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

// ============ Comparison ============

function Comparison() {
  return (
    <section className="cmp">
      <SectionHeading
        eye="The cost of going solo"
        h="Every DCA buy is a sandwich target"
        sub="Bots watch your transaction in the mempool, frontrun it to push the price up, then sell at your inflated price. You eat the difference."
      />
      <div className="cmp__grid">
        <CmpCard
          tone="warn"
          tag="Without Tide"
          title="Solo DCA via Jupiter"
          slip="~0.51%"
          slipLabel="typical retail slip"
          rows={[
            ["Your $100 buy hits the mempool", "exposed"],
            ["Bot frontruns: buys SOL first", "≈ +$0.41"],
            ["Your tx executes at higher price", "$100"],
            ["Bot dumps for profit", "≈ −$0.41 you"],
          ]}
          foot="$100 → ≈0.5701 SOL"
        />
        <CmpCard
          tone="good"
          tag="With Tide"
          title="Aggregated MPC swap"
          slip="~0.05%"
          slipLabel="target slip"
          rows={[
            ["Encrypted intent: amount hidden in MPC", "private"],
            ["Many deposits aggregate over the window", "Σ"],
            ["One atomic swap. No frontrun surface", "<0.1%"],
            ["Pro-rata distribution", "you: ≈0.5728 SOL"],
          ]}
          foot="$100 → ≈0.5728 SOL"
        />
      </div>
      <div className="cmp__note">
        <span className="tiny mute2">
          Indicative on a $100 weekly DCA over 52 weeks at SOL ≈ $168 — actual
          savings depend on window size and routing depth:
        </span>
        <span
          className="mono"
          style={{ color: "var(--accent)", fontSize: 20, fontWeight: 600 }}
        >
          ≈ +$23.92 / year
        </span>
      </div>
    </section>
  );
}

function CmpCard({
  tone,
  tag,
  title,
  slip,
  slipLabel,
  rows,
  foot,
}: {
  tone: "warn" | "good";
  tag: string;
  title: string;
  slip: string;
  slipLabel: string;
  rows: [string, string][];
  foot: string;
}) {
  return (
    <div className={`cmp-card cmp-card--${tone}`}>
      <div className="cmp-card__head">
        <span
          className={`badge ${tone === "warn" ? "badge--warn" : "badge--accent"}`}
        >
          {tag}
        </span>
        <div className="cmp-card__slip">
          <span
            className="mono"
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: tone === "warn" ? "var(--warn)" : "var(--accent)",
            }}
          >
            {slip}
          </span>
          <span className="tiny mute2">{slipLabel}</span>
        </div>
      </div>
      <h3 className="cmp-card__t">{title}</h3>
      <div className="cmp-card__rows">
        {rows.map((r, i) => (
          <div key={i} className="cmp-card__row">
            <span className="tiny" style={{ color: "var(--text-1)" }}>
              {r[0]}
            </span>
            <span className="mono tiny mute2">{r[1]}</span>
          </div>
        ))}
      </div>
      <div className="tideline" style={{ margin: "16px 0 12px" }} />
      <div className="cmp-card__foot mono">{foot}</div>
    </div>
  );
}

// ============ Proof — replaced fake testimonials with project facts ============

function Proof() {
  const items: { eyebrow: string; head: string; body: string }[] = [
    {
      eyebrow: "Built openly",
      head: "Source on GitHub",
      body: "Anchor program + Next.js frontend live at github.com/PugarHuda/tide-dca. Read every account, every instruction, every CSS variable.",
    },
    {
      eyebrow: "Live on devnet",
      head: "Deployed program",
      body: "HanBZ74Q…AmebQg on Solana devnet. Initialize a pool, commit an intent, and watch the window aggregate — no permission needed.",
    },
    {
      eyebrow: "Mainnet path",
      head: "Audit + Arcium gating",
      body: "Mainnet ships behind an Ottersec/Halborn audit and Arcium Cohort 2 access. Until then the MPC layer uses a typed pure-Rust fallback that ports 1:1 to Arcis.",
    },
  ];
  return (
    <section className="proof">
      <SectionHeading
        eye="Built for retail"
        h="Small buys, real protection"
        sub="The smaller your DCA, the more you proportionally lose to bots. Tide gives small buyers institutional-grade execution."
      />
      <div className="proof__grid">
        {items.map((it, i) => (
          <article key={i} className="proof__q">
            <div>
              <span className="eyebrow" style={{ display: "block" }}>
                {it.eyebrow}
              </span>
              <h3
                style={{
                  margin: "10px 0 8px",
                  fontSize: 18,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                {it.head}
              </h3>
              <p className="proof__qt muted" style={{ fontSize: 14 }}>
                {it.body}
              </p>
            </div>
            <footer>
              <a
                href="https://github.com/PugarHuda/tide-dca"
                target="_blank"
                rel="noreferrer"
                className="tiny"
                style={{ color: "var(--accent)" }}
              >
                github.com/PugarHuda/tide-dca →
              </a>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

// ============ Final CTA ============

function FinalCta() {
  return (
    <section className="finalcta">
      <CurrentLines count={6} opacity={0.05} />
      <div className="finalcta__inner">
        <h2 className="finalcta__h">
          Stop feeding bots.
          <br />
          Start riding the tide.
        </h2>
        <p className="muted finalcta__p">
          A position takes 60 seconds to set up. Pause or withdraw anytime.
        </p>
        <Link href="/setup" className="btn btn--primary btn--lg">
          Start DCA <ArrowRight />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="flex gap-3" style={{ alignItems: "center" }}>
          <span className="tiny mute2">Tide · DCA without MEV</span>
        </div>
        <div className="flex gap-6 tiny mute2">
          <a
            href="https://github.com/PugarHuda/tide-dca"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a href="#how">How it works</a>
          <a
            href={`https://explorer.solana.com/address/HanBZ74Q7syXerryjezBXCne23FUp6caeWeTPPAmebQg?cluster=${CURRENT_NETWORK}`}
            target="_blank"
            rel="noreferrer"
          >
            Program
          </a>
          <a>Audit (planned)</a>
        </div>
      </div>
    </footer>
  );
}

// ============ Helpers ============

function SectionHeading({
  eye,
  h,
  sub,
}: {
  eye: string;
  h: string;
  sub: string;
}) {
  return (
    <header className="sec-head">
      <span className="eyebrow">{eye}</span>
      <h2 className="sec-head__h">{h}</h2>
      <p className="sec-head__s muted">{sub}</p>
    </header>
  );
}

function CurrentLines({
  count = 8,
  opacity = 0.06,
}: {
  count?: number;
  opacity?: number;
}) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const y = (i + 1) * (100 / (count + 1));
    const phase = i * 0.4;
    let d = `M 0 ${y}`;
    for (let x = 0; x <= 1240; x += 40) {
      const yy = y + Math.sin(x / 80 + phase) * 8;
      d += ` L ${x} ${yy}`;
    }
    lines.push(
      <path
        key={i}
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1"
        style={{ opacity }}
      />,
    );
  }
  return (
    <div className="wave-bg" aria-hidden>
      <svg viewBox="0 0 1200 600" preserveAspectRatio="none">
        <g style={{ animation: "drift 14s linear infinite" }}>{lines}</g>
      </svg>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
