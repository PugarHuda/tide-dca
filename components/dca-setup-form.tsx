"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { submitSetupDcaPosition } from "@/lib/tide-actions";

/**
 * DCA setup form, restyled with the design's class system. Functional
 * behavior unchanged: submits setup_dca_position via lib/tide-actions.ts.
 */
export function DcaSetupForm() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [amountUsdc, setAmountUsdc] = useState("50");
  const [windowMinutes, setWindowMinutes] = useState("60");
  const [maxSlippagePct, setMaxSlippagePct] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { kind: "idle" }
    | { kind: "success"; signature: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult({ kind: "idle" });
    try {
      const out = await submitSetupDcaPosition(connection, wallet, {
        amountPerWindowUsdc: parseFloat(amountUsdc),
        maxSlippageBps: Math.round(parseFloat(maxSlippagePct) * 100),
      });
      setResult(
        out.ok
          ? { kind: "success", signature: out.signature }
          : { kind: "error", message: out.error },
      );
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
  const annualBuys =
    (60 * 24 * 365) / parseInt(windowMinutes || "60", 10);
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
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
          <select
            className="input"
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(e.target.value)}
          >
            <option value="15">15 minutes</option>
            <option value="60">1 hour</option>
            <option value="360">6 hours</option>
            <option value="1440">Daily</option>
          </select>
          <span className="field__hint">
            How often a window settles. Shorter = quicker fills, longer = larger
            pool.
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
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

      {result.kind === "success" && (
        <div
          className="badge badge--good"
          style={{ padding: "10px 14px", fontSize: 13 }}
        >
          ✓ DCA position created.{" "}
          <a
            style={{ textDecoration: "underline" }}
            href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
          >
            View on Solana Explorer
          </a>
        </div>
      )}
      {result.kind === "error" && (
        <div
          className="badge badge--warn"
          style={{ padding: "10px 14px", fontSize: 13 }}
        >
          ✗ {result.message}
        </div>
      )}

      <button
        type="submit"
        className="btn btn--primary btn--lg"
        disabled={submitting || !wallet.publicKey}
        style={{ width: "100%" }}
      >
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
