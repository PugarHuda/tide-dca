"use client";

import {
  REFLECT_DOCS_URL,
  REFLECT_USDC_APY,
  estimateWindowYield,
  projectAnnualYield,
} from "@/lib/reflect";
import { formatUsdc } from "@/lib/utils";

/**
 * Reflect yield projection card. Renders on /dashboard alongside the
 * window-status panel. Honest framing: "Planned" badge — frontend
 * shipped, on-chain CPI integration pending.
 *
 * Inputs come from usePool() + useCurrentWindow() so projections are
 * grounded in real pool cadence + current commit volume.
 */
export function ReflectCard({
  totalCommittedLamports,
  windowSeconds,
}: {
  totalCommittedLamports: bigint;
  windowSeconds: number;
}) {
  const perWindow = estimateWindowYield(totalCommittedLamports, windowSeconds);
  const annual = projectAnnualYield(totalCommittedLamports, windowSeconds);
  const apyPct = (REFLECT_USDC_APY * 100).toFixed(1);

  return (
    <section className="card" style={{ padding: 18 }}>
      <header
        className="flex"
        style={{
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div className="flex" style={{ alignItems: "center", gap: 8 }}>
          <ReflectMark />
          <span className="eyebrow" style={{ margin: 0 }}>
            Reflect yield
          </span>
        </div>
        <span className="badge" title="Frontend integration shipped; on-chain CPI pending program audit">
          planned
        </span>
      </header>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 14px" }}>
        Idle escrow USDC eligible for{" "}
        <span className="mono" style={{ color: "var(--accent)" }}>
          ~{apyPct}% APY
        </span>{" "}
        via Reflect during the commit window. Yield accrues to the protocol
        fee bucket until pro-rata distribution is wired.
      </p>

      <div className="grid grid--2" style={{ gap: 12 }}>
        <div>
          <div className="tiny mute2">Per window (this size)</div>
          <div className="mono" style={{ fontSize: 16, color: "var(--accent)" }}>
            +{formatUsdc(perWindow)}
          </div>
        </div>
        <div>
          <div className="tiny mute2">Annualized projection</div>
          <div className="mono" style={{ fontSize: 16, color: "var(--accent)" }}>
            +{formatUsdc(annual)}
          </div>
        </div>
      </div>

      <a
        href={REFLECT_DOCS_URL}
        target="_blank"
        rel="noreferrer"
        className="tiny"
        style={{ color: "var(--accent)", display: "inline-block", marginTop: 14 }}
      >
        Reflect Protocol →
      </a>
    </section>
  );
}

function ReflectMark() {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        background: "var(--accent-glow)",
        color: "var(--accent)",
        display: "grid",
        placeItems: "center",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "var(--font-mono, monospace)",
      }}
    >
      R
    </span>
  );
}
