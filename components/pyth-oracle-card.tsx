"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

import { fetchPythPrice, PYTH_DOCS_URL, type PythPrice } from "@/lib/pyth";

/**
 * Pyth SOL/USD oracle snapshot. Refreshes every 8s.
 *
 * Display purpose: gives the operator a reference price to benchmark
 * realized swap slippage against. On-chain version (post-MVP) reads the
 * same Pyth feed account inside `execute_swap` and persists the
 * window-time price for honest slippage_bps reporting.
 *
 * Devnet note: Pyth's mainnet feeds aren't replicated to devnet by
 * default. We probe the configured feed; if missing, surface that
 * cleanly so the card doesn't look broken.
 */
export function PythOracleCard() {
  const { connection } = useConnection();
  const [price, setPrice] = useState<PythPrice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const p = await fetchPythPrice(connection);
        if (!cancelled) {
          setPrice(p);
          setError(null);
          setUpdatedAt(Date.now());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connection]);

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card__head" style={{ marginBottom: 8 }}>
        <h2
          className="mono"
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 500,
            color: "var(--text-0)",
          }}
        >
          pyth_oracle_snapshot
        </h2>
        <span className="badge badge--accent">SOL / USD · live</span>
      </div>
      <p
        className="muted"
        style={{ fontSize: 13.5, lineHeight: 1.55, margin: "0 0 12px" }}
      >
        Reference price feed for window-time slippage benchmarking. On-chain
        consumer (post-MVP) reads the same feed inside{" "}
        <code className="mono mute2">execute_swap</code> to set
        <code className="mono mute2"> window.effective_slippage_bps</code> honestly.
      </p>

      {error && (
        <p
          className="tiny"
          style={{
            color: "var(--warn)",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          {error}
        </p>
      )}

      {price && !error && (
        <div
          className="card card--quiet"
          style={{
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 13,
          }}
        >
          <Row
            label="SOL / USD"
            value={`$${price.price.toFixed(4)}`}
            accent
          />
          <Row label="Confidence (1σ)" value={`±$${price.confidence.toFixed(4)}`} />
          <Row label="Publish slot" value={price.publishSlot.toString()} />
          <Row
            label="Last refresh"
            value={`${Math.floor((Date.now() - updatedAt) / 1000)}s ago`}
          />
        </div>
      )}

      <a
        href={PYTH_DOCS_URL}
        target="_blank"
        rel="noreferrer"
        className="tiny"
        style={{ color: "var(--accent)", display: "inline-block", marginTop: 12 }}
      >
        Pyth Network docs ↗
      </a>
    </section>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex" style={{ justifyContent: "space-between", gap: 12 }}>
      <span className="muted">{label}</span>
      <span
        className="mono"
        style={{
          color: accent ? "var(--accent)" : "var(--text-1)",
          fontWeight: accent ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}
