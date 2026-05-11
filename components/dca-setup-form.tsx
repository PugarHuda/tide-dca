"use client";

import { useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import {
  submitMintTestUsdc,
  submitSetupDcaPosition,
} from "@/lib/tide-actions";
import { useToast } from "@/components/toast";
import { usePool, useUserBalances } from "@/lib/hooks";
import { MoonPayButton } from "@/components/moonpay-button";
import { arciumConfigured } from "@/lib/arcium";
import { CURRENT_NETWORK } from "@/lib/constants";

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
  const [minting, setMinting] = useState(false);
  // Track post-submit success state so we can swap the form for a clear
  // "what's next" CTA instead of letting the user wonder if anything
  // happened beyond the toast that already faded.
  const [successSig, setSuccessSig] = useState<string | null>(null);

  const { usdcLamports, solBalanceFresh } = useUserBalances();
  // Wallet-connected on devnet with empty USDC ATA → surface the test-
  // USDC mint button inline so users don't have to discover /admin.
  const needsTestUsdc =
    !!wallet.publicKey &&
    CURRENT_NETWORK === "devnet" &&
    solBalanceFresh && // wait for balance fetch to complete to avoid flicker
    usdcLamports === 0n;

  const handleMintTestUsdc = async () => {
    setMinting(true);
    try {
      const out = await submitMintTestUsdc(connection, wallet, {
        amountUsdc: 100,
      });
      if (out.ok) {
        toast.success("Minted 100 test USDC", { explorerSig: out.signature });
      } else {
        toast.error(out.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setMinting(false);
    }
  };

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
    // Guard against empty / NaN inputs BEFORE the tx builder runs —
    // BigInt(NaN) throws inside submitSetupDcaPosition without a
    // matching toast, leaving the user with a button that briefly
    // spun and then did nothing.
    const amount = parseFloat(amountUsdc);
    const slippagePct = parseFloat(maxSlippagePct);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a positive USDC amount.");
      return;
    }
    if (!Number.isFinite(slippagePct) || slippagePct < 0.1 || slippagePct > 10) {
      toast.error("Slippage must be between 0.1% and 10%.");
      return;
    }
    setSubmitting(true);
    try {
      const out = await submitSetupDcaPosition(connection, wallet, {
        amountPerWindowUsdc: amount,
        maxSlippageBps: Math.round(slippagePct * 100),
      });
      if (out.ok) {
        toast.success("DCA position created", { explorerSig: out.signature });
        // Toast fades in ~3s. Persist the success state so the form
        // turns into a clear "next step" panel rather than leaving the
        // user wondering what just happened.
        setSuccessSig(out.signature ?? null);
      } else {
        toast.error(out.error);
      }
    } catch (err) {
      // Catch-all for unexpected throws (BigInt-on-NaN, RPC drop,
      // wallet-popup rejection at the lower level). Without this the
      // outer `finally` resets the spinner but the user sees no error
      // signal — classic silent failure.
      toast.error(
        err instanceof Error ? err.message : "Failed to create DCA position",
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
  const annualBuys = (60 * 24 * 365) / windowMinutes;
  const annualSavings =
    (parseFloat(amountUsdc || "0") *
      (standaloneSlippageEstimate - poolSlippageEstimate) *
      annualBuys) /
    100;

  // Post-success view: swap the form for a clear "what's next" panel.
  // Mounted at the top of the return so user doesn't scroll past it.
  if (successSig) {
    return (
      <div
        className="card"
        style={{ display: "flex", flexDirection: "column", gap: 18, padding: 28 }}
      >
        <div>
          <span className="eyebrow" style={{ color: "var(--good)" }}>
            ✓ DCA position created
          </span>
          <h2 className="page__h2" style={{ marginTop: 8, fontSize: 22 }}>
            Your DCA pool subscription is live
          </h2>
          <p
            className="muted"
            style={{ marginTop: 10, lineHeight: 1.6, marginBottom: 0 }}
          >
            Next: head to the dashboard to commit your first ${amountUsdc} to
            the current window. Each window aggregates with other depositors
            before the swap, so the more time you give it, the better the
            fill.
          </p>
        </div>

        <a
          href={`https://explorer.solana.com/tx/${successSig}?cluster=${CURRENT_NETWORK}`}
          target="_blank"
          rel="noreferrer"
          className="card card--quiet"
          style={{
            padding: "12px 14px",
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span className="tiny mute2">setup_dca_position tx</span>
          <span
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--accent)",
              wordBreak: "break-all",
            }}
          >
            {successSig.slice(0, 32)}…{successSig.slice(-12)}
          </span>
          <span className="tiny mute2" style={{ marginTop: 2 }}>
            View on Solana Explorer ↗
          </span>
        </a>

        <div className="flex" style={{ gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn--primary">
            View dashboard →
          </Link>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setSuccessSig(null)}
          >
            Adjust position
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 22 }}
    >
      {needsTestUsdc && (
        <div
          className="card card--quiet"
          style={{
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderColor: "var(--accent-line)",
            flexWrap: "wrap",
          }}
        >
          <p className="tiny" style={{ color: "var(--text-1)", margin: 0 }}>
            <span style={{ color: "var(--accent)", marginRight: 6 }}>ⓘ</span>
            You're on devnet with 0 USDC. Grab 100 test USDC from the pool's
            built-in faucet to try the flow.
          </p>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => void handleMintTestUsdc()}
            disabled={minting}
          >
            {minting ? <span className="spinner spinner--sm" /> : null}
            <span style={{ marginLeft: minting ? 8 : 0 }}>
              {minting ? "Minting…" : "Mint 100 test USDC"}
            </span>
          </button>
        </div>
      )}

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

      <div
        className="flex"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span className="tiny mute2">
          Need USDC? Skip the bridge — fund with USD/EUR card.
        </span>
        <MoonPayButton
          variant="ghost"
          amount={parseFloat(amountUsdc) || undefined}
        />
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
        {arciumConfigured() ? (
          <>
            Your individual amount is encrypted via Arcium MPC. Bots see only
            the aggregate, never your specific buy.
          </>
        ) : (
          <>
            <strong style={{ color: "var(--warn)" }}>
              Commitment-fallback mode
            </strong>{" "}
            on devnet — your intent is committed via SHA-256 hash. Real
            RescueCipher MPC activates once the MXE program is deployed
            (Linux/Mac CLI gate). On-chain interface is identical.
          </>
        )}
      </p>
    </form>
  );
}
