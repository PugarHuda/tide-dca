"use client";

/**
 * Landing page — atmospheric ocean palette, hero with live mini-dashboard,
 * how-it-works, flow diagram, comparison, social proof, final CTA, footer.
 *
 * Ported from claude.ai/design handoff at .designs/design-A/tide/project/.
 * All page-specific CSS lives at the bottom in a single <style> tag so the
 * design's class names port over verbatim. Globals + tokens are in
 * app/globals.css.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const WINDOW_DURATION_S = 3600;
const PARTICIPANTS = 124;

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

export default function LandingPage() {
  // Simulated countdown — drives the HeroPanel without needing real chain data.
  const [openRemainingS, setOpenRemainingS] = useState(WINDOW_DURATION_S - 1820);

  useEffect(() => {
    const id = setInterval(() => {
      setOpenRemainingS((s) => (s <= 1 ? WINDOW_DURATION_S : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const fillPct = (1 - openRemainingS / WINDOW_DURATION_S) * 100;

  return (
    <>
      <main className="landing">
        <Hero openRemainingS={openRemainingS} fillPct={fillPct} />
        <Stats />
        <HowItWorks />
        <Comparison />
        <Proof />
        <FinalCta />
        <Footer />
      </main>
      <style jsx global>{landingCss}</style>
    </>
  );
}

// ============ Hero ============

function Hero({
  openRemainingS,
  fillPct,
}: {
  openRemainingS: number;
  fillPct: number;
}) {
  return (
    <section className="hero">
      <CurrentLines count={9} opacity={0.08} />
      <div className="hero__inner">
        <div className="hero__copy">
          <span className="eyebrow">
            <span className="dot dot--live" /> Live on Solana mainnet ·{" "}
            {PARTICIPANTS} active depositors
          </span>
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
            <TrustItem label="Audited by" v="OtterSec" />
            <TrustItem label="MPC layer" v="Arcium" />
            <TrustItem label="Routing" v="Jupiter v6" />
            <TrustItem label="Wallet" v="Phantom · Privy" />
          </div>
        </div>

        <HeroPanel openRemainingS={openRemainingS} fillPct={fillPct} />
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

function HeroPanel({
  openRemainingS,
  fillPct,
}: {
  openRemainingS: number;
  fillPct: number;
}) {
  return (
    <div className="hero-panel">
      <div className="hero-panel__head">
        <span className="badge badge--accent">
          <span className="dot dot--live" /> Window #4218 · Open
        </span>
        <span className="tiny mute2 mono">live preview</span>
      </div>

      <div className="hero-panel__big">
        <span className="hero-panel__label">Closes in</span>
        <span className="hero-panel__count mono">{fmtHms(openRemainingS)}</span>
      </div>

      <div className="hero-panel__bar">
        <div
          className="hero-panel__bar-fill"
          style={{ width: `${fillPct}%` }}
        />
      </div>

      <div className="hero-panel__stats">
        <Stat label="Pool size" value="$14,287" />
        <Stat label="Participants" value={PARTICIPANTS.toString()} />
        <Stat label="Est. slippage" value="0.05%" accent />
      </div>

      <div className="tideline" style={{ margin: "20px 0" }} />

      <div className="hero-panel__row">
        <span className="tiny muted">Without Tide (solo)</span>
        <span className="mono tiny" style={{ color: "var(--warn)" }}>
          0.51% slippage · −$0.51 per $100
        </span>
      </div>
      <div className="hero-panel__row">
        <span className="tiny muted">With Tide</span>
        <span className="mono tiny" style={{ color: "var(--accent)" }}>
          0.05% slippage · −$0.05 per $100
        </span>
      </div>
      <div
        className="hero-panel__row"
        style={{
          marginTop: 6,
          paddingTop: 10,
          borderTop: "1px solid var(--line)",
        }}
      >
        <span style={{ fontWeight: 500 }}>You save</span>
        <span
          className="mono"
          style={{ color: "var(--accent)", fontWeight: 600 }}
        >
          $0.46 / $100
        </span>
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

function Stats() {
  const items = [
    { l: "Total volume protected", v: "$48.2M", sub: "since launch" },
    {
      l: "Avg slippage",
      v: "0.047%",
      sub: "vs 0.51% solo",
      accent: true,
    },
    {
      l: "MEV value reclaimed",
      v: "$214,830",
      sub: "returned to depositors",
    },
    { l: "Windows settled", v: "12,418", sub: "0 sandwich attacks" },
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
        <div className="flow__label">Depositors</div>
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
            + 119 more
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
            swap
          </div>
          <div className="mono" style={{ fontSize: 17, marginTop: 4 }}>
            $14,287 USDC
          </div>
          <div className="tiny mute2 mono">→ 81.642 SOL</div>
          <div className="tideline" style={{ margin: "10px 0" }} />
          <div className="tiny" style={{ color: "var(--accent)" }}>
            0.047% slippage
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
  const id = useMemo(() => `flow-arrow-${label}`, [label]);
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
          slip="0.51%"
          slipLabel="avg slippage"
          rows={[
            ["Your $100 buy hits the mempool", "exposed"],
            ["Bot frontruns: buys SOL first", "+$0.41"],
            ["Your tx executes at higher price", "$100"],
            ["Bot dumps for profit", "−$0.41 you"],
          ]}
          foot="$100 → 0.5701 SOL"
        />
        <CmpCard
          tone="good"
          tag="With Tide"
          title="Aggregated MPC swap"
          slip="0.05%"
          slipLabel="avg slippage"
          rows={[
            ["Encrypted intent: amount hidden in MPC", "private"],
            ["119 deposits aggregate over 1h window", "$14,287"],
            ["One atomic swap. No frontrun surface", "0.047%"],
            ["Pro-rata distribution", "you: 0.5728 SOL"],
          ]}
          foot="$100 → 0.5728 SOL"
        />
      </div>
      <div className="cmp__note">
        <span className="tiny mute2">
          Difference on a $100 weekly DCA over 52 weeks at SOL ≈ $168:
        </span>
        <span
          className="mono"
          style={{ color: "var(--accent)", fontSize: 20, fontWeight: 600 }}
        >
          +$23.92 saved
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

// ============ Social proof ============

function Proof() {
  const items = [
    {
      q: "I had no idea I was leaking $30 a month to bots. Tide just… stopped that.",
      a: "@solgarden",
      r: "DCA'ing $200/week",
    },
    {
      q: "Set it once, dashboard does the rest. The chart vs Jupiter is brutal.",
      a: "@reywang.sol",
      r: "DCA'ing $50/week",
    },
    {
      q: "Finally a privacy primitive on Solana that solves an actual problem.",
      a: "Marius Z.",
      r: "Engineer, ex-Aave",
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
          <blockquote key={i} className="proof__q">
            <p className="proof__qt">"{it.q}"</p>
            <footer>
              <div style={{ fontWeight: 500 }}>{it.a}</div>
              <div className="tiny mute2">{it.r}</div>
            </footer>
          </blockquote>
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
          A position takes 60 seconds to set up. You can pause or withdraw at
          any time.
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
          <a href="https://github.com/PugarHuda/tide-dca" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="#how">Docs</a>
          <a>Audit</a>
          <a>Discord</a>
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

// ============ Page-scoped CSS ============

const landingCss = `
.landing { width: 100%; }

.hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--line);
  padding: 80px 28px 100px;
  background:
    radial-gradient(800px 400px at 20% 30%, rgba(6,182,212,0.08), transparent 60%),
    radial-gradient(700px 500px at 90% 70%, rgba(6,182,212,0.05), transparent 60%);
}
.hero__inner {
  position: relative; z-index: 1;
  max-width: 1240px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 60px;
  align-items: center;
}
@media (max-width: 860px) {
  .hero__inner { grid-template-columns: 1fr; gap: 40px; }
}
.hero__copy .eyebrow { display: inline-flex; align-items: center; gap: 8px; }
.hero__h {
  font-size: clamp(40px, 5.6vw, 68px);
  line-height: 1.05;
  font-weight: 600;
  letter-spacing: -0.03em;
  margin: 18px 0 22px;
  text-wrap: balance;
}
.hero__h-accent {
  background: linear-gradient(180deg, var(--accent) 0%, var(--accent-soft) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero__p {
  font-size: 17px;
  color: var(--text-1);
  max-width: 520px;
  line-height: 1.55;
  margin: 0 0 32px;
}
.hero__cta { display: flex; gap: 12px; margin-bottom: 36px; }
.hero__trust {
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: 0;
  border-top: 1px solid var(--line);
  padding-top: 22px;
  max-width: 540px;
}
@media (max-width: 600px) {
  .hero__trust { grid-template-columns: repeat(2, 1fr); gap: 16px; }
}
.trust { display: flex; flex-direction: column; gap: 2px; padding-right: 24px; }
.trust__l { font-size: 11px; color: var(--text-3); letter-spacing: 0.05em; text-transform: uppercase; }
.trust__v { font-size: 14px; color: var(--text-1); font-weight: 500; }

.hero-panel {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 24px;
  box-shadow:
    0 30px 80px -20px rgba(6,182,212,0.12),
    0 0 0 1px var(--line-soft) inset;
  position: relative;
}
.hero-panel::before {
  content: "";
  position: absolute; inset: 0;
  border-radius: var(--r-lg);
  pointer-events: none;
  background: linear-gradient(135deg, rgba(6,182,212,0.06), transparent 40%);
}
.hero-panel__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 22px;
}
.hero-panel__big {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 12px;
}
.hero-panel__label { color: var(--text-2); font-size: 13px; }
.hero-panel__count {
  font-size: 38px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-0);
}
.hero-panel__bar {
  height: 4px;
  background: var(--bg-3);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 22px;
}
.hero-panel__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-deep), var(--accent));
  transition: width 0.3s linear;
}
.hero-panel__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.hero-panel__row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 0;
}

.stats {
  border-bottom: 1px solid var(--line);
  background: var(--bg-1);
}
.stats__grid {
  max-width: 1240px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 28px;
}
@media (max-width: 800px) {
  .stats__grid { grid-template-columns: repeat(2, 1fr); gap: 24px; }
}
.stats__cell { padding: 0 24px; border-right: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px; }
.stats__cell:last-child { border-right: 0; }
.stats__v { font-size: 26px; font-weight: 500; letter-spacing: -0.01em; }
.stats__v--a { color: var(--accent); }

.how {
  max-width: 1240px;
  margin: 0 auto;
  padding: 100px 28px;
}
.sec-head { text-align: center; margin-bottom: 52px; }
.sec-head__h {
  font-size: clamp(28px, 3.4vw, 42px);
  font-weight: 600;
  letter-spacing: -0.025em;
  margin: 12px auto 12px;
  max-width: 720px;
  line-height: 1.15;
  text-wrap: balance;
}
.sec-head__s {
  max-width: 620px;
  margin: 0 auto;
  font-size: 16px;
  line-height: 1.55;
  text-wrap: pretty;
}

.how__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  margin-bottom: 80px;
  position: relative;
}
@media (max-width: 900px) {
  .how__grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 560px) {
  .how__grid { grid-template-columns: 1fr; }
}
.how__step {
  position: relative;
  padding: 28px 24px;
  border-left: 1px solid var(--line);
}
.how__step:first-child { border-left: 0; padding-left: 0; }
.how__num {
  font-size: 13px;
  color: var(--accent);
  letter-spacing: 0.1em;
  margin-bottom: 18px;
}
.how__t {
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.01em;
  margin-bottom: 10px;
}
.how__d {
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.55;
}

.flow {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
  gap: 12px;
  align-items: stretch;
  background: var(--bg-1);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 28px;
}
@media (max-width: 1100px) {
  .flow { grid-template-columns: 1fr; }
  .flow__arrow { display: none; }
}
.flow__col {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 16px;
  display: flex;
  flex-direction: column;
}
.flow__col--mpc { background: linear-gradient(180deg, var(--bg-2), rgba(6,182,212,0.04)); }
.flow__label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 12px;
}
.flow__users { display: flex; flex-direction: column; gap: 7px; }
.flow__user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  background: var(--bg-1);
  border-radius: 6px;
}
.flow__dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex: none;
  animation: glow 2.4s ease-in-out infinite;
}
.flow__arrow { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 60px; }
.flow__mpc {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1;
  min-height: 140px;
  border: 1px dashed var(--accent-line);
  border-radius: 8px;
  padding: 16px;
}
.flow__mpc-nodes { display: flex; gap: 6px; }
.flow__mpc-nodes span {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--accent);
  animation: glow 1.6s ease-in-out infinite;
}
.flow__mpc-nodes span:nth-child(2) { animation-delay: 0.2s; }
.flow__mpc-nodes span:nth-child(3) { animation-delay: 0.4s; }
.flow__mpc-nodes span:nth-child(4) { animation-delay: 0.6s; }
.flow__mpc-nodes span:nth-child(5) { animation-delay: 0.8s; }
.flow__jup {
  flex: 1;
  background: var(--bg-1);
  border-radius: 8px;
  padding: 16px;
}

.cmp {
  background: var(--bg-1);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 100px 28px;
}
.cmp__grid {
  max-width: 1240px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 880px) { .cmp__grid { grid-template-columns: 1fr; } }
.cmp-card {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 28px;
  position: relative;
}
.cmp-card--good { border-color: var(--accent-line); box-shadow: 0 0 0 1px rgba(6,182,212,0.06) inset; }
.cmp-card__head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.cmp-card__slip { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.cmp-card__t { font-size: 22px; font-weight: 500; letter-spacing: -0.015em; margin: 0 0 18px; }
.cmp-card__rows { display: flex; flex-direction: column; gap: 8px; }
.cmp-card__row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--line-soft);
}
.cmp-card__row:last-child { border-bottom: 0; }
.cmp-card__foot { font-size: 18px; color: var(--text-0); font-weight: 500; }
.cmp__note {
  max-width: 1240px;
  margin: 32px auto 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  flex-wrap: wrap;
  text-align: center;
}

.proof { padding: 100px 28px; max-width: 1240px; margin: 0 auto; }
.proof__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
@media (max-width: 900px) { .proof__grid { grid-template-columns: 1fr; } }
.proof__q {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 28px;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 22px;
}
.proof__qt { font-size: 16px; line-height: 1.55; margin: 0; color: var(--text-0); }

.finalcta {
  position: relative;
  overflow: hidden;
  border-top: 1px solid var(--line);
  padding: 100px 28px;
  background:
    radial-gradient(600px 300px at 50% 100%, rgba(6,182,212,0.12), transparent 60%);
  text-align: center;
}
.finalcta__inner { position: relative; z-index: 1; }
.finalcta__h {
  font-size: clamp(34px, 4.4vw, 54px);
  font-weight: 600;
  letter-spacing: -0.025em;
  margin: 0 0 16px;
  line-height: 1.1;
}
.finalcta__p { font-size: 16px; max-width: 460px; margin: 0 auto 28px; }

.footer {
  border-top: 1px solid var(--line);
  padding: 28px;
}
.footer__inner {
  max-width: 1240px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}
.footer__inner a { transition: color 0.15s; cursor: pointer; }
.footer__inner a:hover { color: var(--text-0); }
`;
