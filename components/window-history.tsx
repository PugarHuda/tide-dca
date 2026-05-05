"use client";

import { useWindowHistory } from "@/lib/hooks";
import { CURRENT_NETWORK } from "@/lib/constants";
import { bpsToPct, formatSol, formatUsdc, shortAddress } from "@/lib/utils";
import { findWindowPda, findPoolPda } from "@/lib/anchor-client";
import {
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
  SOL_MINT,
} from "@/lib/constants";

const USDC_MINT =
  CURRENT_NETWORK === "mainnet" ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;

const STATUS_LABELS = ["Open", "Aggregating", "Distributed", "Failed"] as const;

/**
 * Per-window breakdown table. Hydrates from useWindowHistory which fetches
 * every settled Window account in a single getMultipleAccountsInfo batch.
 * Hidden entirely when there are no settled windows yet.
 */
export function WindowHistoryTable() {
  const { windows, loading } = useWindowHistory();

  if (loading) {
    return (
      <div className="card">
        <div className="card__head">
          <span className="card__title">Window history</span>
        </div>
        <div
          className="skeleton skeleton--block"
          style={{ height: 80, width: "100%" }}
        />
      </div>
    );
  }

  if (windows.length === 0) {
    return null;
  }

  // Newest first for visual scanning
  const sorted = [...windows].sort((a, b) =>
    a.windowNumber > b.windowNumber ? -1 : 1,
  );
  const [poolPda] = findPoolPda(USDC_MINT, SOL_MINT);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        className="card__head"
        style={{ padding: "20px 24px 12px", marginBottom: 0 }}
      >
        <span className="card__title">Window history</span>
        <span className="badge">{windows.length} settled</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Committed</th>
              <th style={{ textAlign: "right" }}>Acquired</th>
              <th style={{ textAlign: "right" }}>Slippage</th>
              <th style={{ textAlign: "right" }}>Settled at</th>
              <th>PDA</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((w) => {
              const pda = findWindowPda(poolPda, w.windowNumber)[0];
              const settledAt = new Date(
                Number(w.endTs) * 1000,
              ).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <tr key={w.windowNumber.toString()}>
                  <td className="mono">{w.windowNumber.toString()}</td>
                  <td>
                    <span
                      className={`badge ${w.status === 2 ? "badge--accent" : "badge--warn"}`}
                    >
                      {STATUS_LABELS[w.status] ?? "Unknown"}
                    </span>
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {formatUsdc(w.totalCommittedUsdc)}
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {formatSol(w.tokensAcquired)}
                  </td>
                  <td
                    className="mono"
                    style={{
                      textAlign: "right",
                      color:
                        w.effectiveSlippageBps <= 10
                          ? "var(--accent)"
                          : "var(--warn)",
                    }}
                  >
                    {bpsToPct(w.effectiveSlippageBps)}
                  </td>
                  <td
                    className="tiny mute2"
                    style={{ textAlign: "right" }}
                  >
                    {settledAt}
                  </td>
                  <td>
                    <a
                      href={`https://explorer.solana.com/address/${pda.toBase58()}?cluster=${CURRENT_NETWORK}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mono tiny"
                      style={{
                        color: "var(--accent)",
                        textDecoration: "none",
                      }}
                    >
                      {shortAddress(pda.toBase58())} ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
