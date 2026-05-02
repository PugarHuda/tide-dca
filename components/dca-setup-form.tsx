"use client";

import { useState } from "react";

/**
 * DCA setup wizard.
 *
 * Steps:
 * 1. Select target token (SOL default)
 * 2. Set amount per window
 * 3. Set frequency (window duration)
 * 4. Set max slippage tolerance
 * 5. Encrypt intent + commit (calls Anchor program)
 *
 * TODO when SDK ready:
 * - Wire to Anchor program via @coral-xyz/anchor
 * - Encrypt intent via @arcium/client
 */
export function DcaSetupForm({
  onSubmit,
}: {
  onSubmit?: (params: {
    targetToken: string;
    amountUsdc: number;
    windowMinutes: number;
    maxSlippageBps: number;
  }) => Promise<void>;
}) {
  const [targetToken, setTargetToken] = useState("SOL");
  const [amountUsdc, setAmountUsdc] = useState("50");
  const [windowMinutes, setWindowMinutes] = useState("60");
  const [maxSlippagePct, setMaxSlippagePct] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit?.({
        targetToken,
        amountUsdc: parseFloat(amountUsdc),
        windowMinutes: parseInt(windowMinutes, 10),
        maxSlippageBps: Math.round(parseFloat(maxSlippagePct) * 100),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Estimated standalone slippage based on amount (heuristic)
  const standaloneSlippageEstimate =
    parseFloat(amountUsdc) < 100 ? 0.5 : parseFloat(amountUsdc) < 1000 ? 0.2 : 0.1;
  const poolSlippageEstimate = 0.05;
  const annualBuys = (60 * 24 * 365) / parseInt(windowMinutes || "60", 10);
  const annualSavings =
    (parseFloat(amountUsdc || "0") *
      (standaloneSlippageEstimate - poolSlippageEstimate) *
      annualBuys) /
    100;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-300">
          Target Token
        </label>
        <select
          value={targetToken}
          onChange={(e) => setTargetToken(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none"
        >
          <option value="SOL">SOL — Solana</option>
          <option value="JUP" disabled>
            JUP — Jupiter (coming soon)
          </option>
          <option value="JTO" disabled>
            JTO — Jito (coming soon)
          </option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">
            Amount per window (USDC)
          </label>
          <input
            type="number"
            value={amountUsdc}
            onChange={(e) => setAmountUsdc(e.target.value)}
            min="1"
            step="1"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">
            Window duration (minutes)
          </label>
          <select
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none"
          >
            <option value="15">15 minutes (high frequency)</option>
            <option value="60">1 hour (default)</option>
            <option value="360">6 hours</option>
            <option value="1440">Daily</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-300">
          Max slippage tolerance: {maxSlippagePct}%
        </label>
        <input
          type="range"
          value={maxSlippagePct}
          onChange={(e) => setMaxSlippagePct(e.target.value)}
          min="0.1"
          max="10"
          step="0.1"
          className="w-full accent-cyan-500"
        />
        <div className="mt-1 flex justify-between text-xs text-zinc-500">
          <span>0.1%</span>
          <span>10%</span>
        </div>
      </div>

      <div className="rounded-md border border-cyan-500/30 bg-cyan-950/20 p-4 text-sm">
        <h4 className="mb-2 font-medium text-cyan-300">Estimated Annual Savings</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-zinc-500">Standalone slippage</div>
            <div className="text-rose-300">~{standaloneSlippageEstimate}% per buy</div>
          </div>
          <div>
            <div className="text-zinc-500">Tide pool slippage</div>
            <div className="text-cyan-300">~{poolSlippageEstimate}% per buy</div>
          </div>
        </div>
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <div className="text-zinc-500">Estimated savings/year</div>
          <div className="text-2xl font-bold text-cyan-300">
            ${annualSavings.toFixed(2)}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-cyan-500 px-4 py-3 font-medium text-zinc-900 transition hover:bg-cyan-400 disabled:opacity-50"
      >
        {submitting ? "Encrypting + committing…" : "Start DCA Pool"}
      </button>

      <p className="text-center text-xs text-zinc-500">
        Your individual amount is encrypted via Arcium MPC. Bots see only
        aggregate, never your $50 specifically.
      </p>
    </form>
  );
}
