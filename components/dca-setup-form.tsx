"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { submitSetupDcaPosition } from "@/lib/tide-actions";
import { useToast } from "@/components/toast";
import { usePool } from "@/lib/hooks";

/**
 * DCA setup form. Submits setup_dca_position via lib/tide-actions.ts;
 * surfaces success / error through the global toast system instead of
 * inline text so users notice tx confirmations even if they've scrolled.
 *
 * Window duration is a pool-level config (set at init_pool by admin),
 * not per-position — we display it read-only from `usePool` so users
 * don't think they're picking it themselves.
 */
export function DcaSetupForm() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const toast = useToast();
  const { pool } = usePool();

  const [amountUsdc, setAmountUsdc] = useState("50");
  const [maxSlippagePct, setMaxSlippagePct] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const windowSeconds = pool ? Number(pool.windowDurationSeconds) : 3600;
  const windowMinutes = Math.round(windowSeconds / 60);
  const windowLabel =
    windowMinutes >= 1440
      ? `${Math.round(windowMinutes / 1440)} day`
      : windowMinutes >= 60
        ? `${(windowMinutes / 60).toFixed(windowMinutes % 60 === 0 ? 0 : 1)} h`
        : `${windowMinutes} min`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const out = await submitSetupDcaPosition(connection, wallet, {
        amountPerWindowUsdc: parseFloat(amountUsdc),
        maxSlippageBps: Math.round(parseFloat(maxSlippagePct) * 100),
      });
      if (out.ok) {
        toast.success("DCA position created", { explorerSig: out.signature });
      } else {
        toast.error(out.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Estimated standalone slippage based on amount (heuristic)
  const standaloneSlippageEstimate =
    parseFloat(amountUsdc) < 100
      ? 0.5
      : parseFloat(amountUsdc) < 1000
        ? 0.2
        : 0.1;
  const poolSlippageEstimate = 0.05;
  const annualBuys = (60 * 24 * 365) / windowMinutes;
  const annualSavings =
    (parseFloat(amountUsdc || "0") *
      (standaloneSlippageEstimate - poolSlippageEstimate) *
      annualBuys) /
    100;

  return (
    <form
      onSubmit={handleSubmit}
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      <div className="field">
        <label className="field__label">Target token</label>
        <div
          className="card card--quiet"
          style={{
            padding: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "var(--accent-glow)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
              fontSize: 18,
            }}
          >
            ◎
          </span>
          <div>
            <div style={{ fontWeight: 500 }}>SOL</div>
            <div className="tiny mute2">Solana</div>
          </div>
          <span
            className="badge"
            style={{ marginLeft: "auto" }}
          >
            JUP / JTO coming soon
          </span>
        </div>
      </div>

      <div className="grid grid--2" style={{ gap: 16 }}>
        <div className="field">
          <label className="field__label">Amount per window</label>
          <div style={{ position: "relative" }}>
            <input
              className="input input--num"
              type="number"
              min="1"
              step="1"
              value={amountUsdc}
              onChange={(e) => setAmountUsdc(e.target.value)}
              required
            />
            <span
              className="mono mute2"
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              USDC
            </span>
          </div>
          <div className="flex gap-2" style={{ marginTop: 4 }}>
            {[20, 50, 100, 250, 500].map((v) => (
              <button
                type="button"
                key={v}
                className="btn btn--ghost btn--sm"
                onClick={() => setAmountUsdc(String(v))}
              >
                ${v}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label">Window duration</label>
          <div
            className="card card--quiet"
            style={{
              padding: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
              minHeight: 46,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "var(--accent-glow)",
                color: "var(--accent)",
                display: "grid",
                placeItems: "center",
                fontSize: 14,
              }}
            >
              ⏱
            </span>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontWeight: 500 }}>
                {pool ? windowLabel : "—"}
              </div>
              <div className="tiny mute2">Pool-level setting</div>
            </div>
          </div>
          <span className="field__hint">
            Set once by the pool admin; same for every participant.
          </span>
        </div>
      </div>

      <div className="field">
        <label className="field__label">
          Max slippage · {maxSlippagePct}%
        </label>
        <input
          type="range"
          className="slider"
          value={maxSlippagePct}
          onChange={(e) => setMaxSlippagePct(e.target.value)}
          min="0.1"
          max="10"
          step="0.1"
        />
        <div
          className="flex"
          style={{ justifyContent: "space-between", marginTop: -2 }}
        >
          <span className="tiny mute2">0.1%</span>
          <span className="tiny mute2">10%</span>
        </div>
      </div>

      <div
        className="card card--quiet"
        style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}
      >
        <div
          className="flex"
          style={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <span className="eyebrow">Estimated annual savings</span>
          <span className="badge badge--accent">{poolSlippageEstimate}% pool slip</span>
        </div>
        <div className="tideline" />
        <div className="grid grid--2" style={{ gap: 16 }}>
          <div>
            <div className="tiny mute2">Solo slippage</div>
            <div
              className="mono"
              style={{ fontSize: 16, color: "var(--warn)" }}
            >
              ~{standaloneSlippageEstimate}% / buy
            </div>
          </div>
          <div>
            <div className="tiny mute2">Tide slippage</div>
            <div
              className="mono"
              style={{ fontSize: 16, color: "var(--accent)" }}
            >
              ~{poolSlippageEstimate}% / buy
            </div>
          </div>
        </div>
        <div className="tideline" />
        <div
          className="flex"
          style={{ justifyContent: "space-between", alignItems: "baseline" }}
        >
          <span className="tiny mute2">Saved per year</span>
          <span
            className="mono"
            style={{ fontSize: 26, fontWeight: 600, color: "var(--accent)" }}
          >
            ${annualSavings.toFixed(2)}
          </span>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn--primary btn--lg"
        disabled={submitting || !wallet.publicKey}
        style={{ width: "100%" }}
      >
        {submitting && <span className="spinner" />}
        {submitting
          ? "Submitting transaction…"
          : !wallet.publicKey
            ? "Connect wallet to continue"
            : "Start DCA"}
      </button>

      <p
        className="tiny mute2"
        style={{ textAlign: "center", lineHeight: 1.5 }}
      >
        Your individual amount is encrypted via Arcium MPC. Bots see only the
        aggregate, never your specific buy.
      </p>
    </form>
  );
}
