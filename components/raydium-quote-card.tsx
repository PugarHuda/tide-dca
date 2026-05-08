"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";

import {
  fetchRaydiumQuote,
  RAYDIUM_AMM_V4_PROGRAM_ID,
  RAYDIUM_DOCS_URL,
} from "@/lib/raydium";

const MAINNET_USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

type QuoteResult = {
  inputAmount: string;
  outputAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: number;
  routeHops: number;
  poolIds: string[];
};

/**
 * Live Raydium quote fetcher. Runs against mainnet API regardless of
 * NEXT_PUBLIC_SOLANA_NETWORK because Raydium has no devnet endpoint —
 * this is a real price-discovery probe, mainnet is always the source.
 *
 * On-chain CPI: not invoked from this card (would charge real SOL).
 * The `lib/raydium.ts` module exports `RAYDIUM_AMM_V4_PROGRAM_ID` for
 * use as `dex_program` in `execute_swap` when Tide migrates to mainnet.
 */
export function RaydiumQuoteCard() {
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    const usd = Math.max(0, parseFloat(amount) || 0);
    if (usd === 0) {
      setError("Enter a positive USDC amount.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const quote = await fetchRaydiumQuote({
        inputMint: MAINNET_USDC,
        outputMint: WSOL,
        amount: BigInt(Math.round(usd * 1_000_000)),
        slippageBps: 50,
      });
      setResult({
        inputAmount: quote.data.inputAmount,
        outputAmount: quote.data.outputAmount,
        otherAmountThreshold: quote.data.otherAmountThreshold,
        priceImpactPct: quote.data.priceImpactPct,
        routeHops: quote.data.routePlan.length,
        poolIds: quote.data.routePlan.map((r) => r.poolId),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const formatLamports = (s: string, decimals: number) => {
    const n = Number(s) / Math.pow(10, decimals);
    return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

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
          raydium_quote_preview
        </h2>
        <span className="badge badge--accent">DEX backbone · live</span>
      </div>
      <p
        className="muted"
        style={{ fontSize: 13.5, lineHeight: 1.55, margin: "0 0 4px" }}
      >
        Probe Raydium V3 trade API for current USDC → SOL price + route. Calls
        mainnet (Raydium has no devnet endpoint). Read-only — does not
        execute. The {" "}
        <code className="mono mute2">execute_swap</code> instruction would
        forward this route via CPI to Raydium AMM v4 (
        <code className="mono mute2">{shortPubkey(RAYDIUM_AMM_V4_PROGRAM_ID)}</code>
        ).
      </p>

      <div
        className="flex"
        style={{
          alignItems: "center",
          gap: 14,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
            style={{
              width: 110,
              background: "var(--surface-1)",
              border: "1px solid var(--border-1)",
              borderRadius: 6,
              padding: "8px 10px",
              color: "var(--text-0)",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 14,
            }}
          />
          <span className="tiny mute2">USDC</span>
        </div>
        <button
          onClick={() => void handleFetch()}
          disabled={busy}
          className="btn btn--primary"
        >
          {busy && <span className="spinner spinner--sm" />}
          {busy ? "Fetching…" : "Fetch Raydium quote"}
        </button>
      </div>

      {error && (
        <p
          className="tiny"
          style={{
            color: "var(--warn)",
            marginTop: 14,
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          {error}
        </p>
      )}

      {result && (
        <div
          className="card card--quiet"
          style={{
            marginTop: 16,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            fontSize: 13,
          }}
        >
          <Row
            label="Input"
            value={`${formatLamports(result.inputAmount, 6)} USDC`}
          />
          <Row
            label="Output"
            value={`${formatLamports(result.outputAmount, 9)} SOL`}
            accent
          />
          <Row
            label="Min received (slippage 0.5%)"
            value={`${formatLamports(result.otherAmountThreshold, 9)} SOL`}
          />
          <Row
            label="Price impact"
            value={`${(result.priceImpactPct * 100).toFixed(4)}%`}
          />
          <Row label="Route hops" value={result.routeHops.toString()} />
          {result.poolIds.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <span className="tiny mute2">Pool ids:</span>
              <ul
                style={{
                  margin: "4px 0 0",
                  paddingLeft: 16,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 11,
                }}
              >
                {result.poolIds.map((id) => (
                  <li key={id} style={{ color: "var(--text-2)" }}>
                    {shortAddr(id)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a
            href={RAYDIUM_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="tiny"
            style={{ color: "var(--accent)", marginTop: 4 }}
          >
            Raydium docs ↗
          </a>
        </div>
      )}
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

function shortPubkey(p: PublicKey): string {
  const s = p.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function shortAddr(s: string): string {
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}
