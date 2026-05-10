"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import { CURRENT_NETWORK } from "@/lib/constants";
import { useUserBalances } from "@/lib/hooks";

/**
 * Top-of-page banner that surfaces a "wrong network" / "low balance"
 * cue when the connected wallet is on a non-mainnet cluster with
 * insufficient SOL for tx fees.
 *
 * Why this exists in a Solana app:
 *
 *   Solana wallets don't bind to a network — Phantom signs whatever
 *   transaction the app hands it, regardless of which cluster the
 *   wallet's UI is "viewing". A user can have plenty of SOL on
 *   mainnet, see the mainnet balance in Phantom, then connect to a
 *   devnet-built Tide and have all txs fail with InsufficientFunds.
 *   The mismatch is invisible without explicit signaling.
 *
 *   This banner closes that gap — it appears only when:
 *     - Wallet is connected
 *     - We're on a non-mainnet cluster (devnet/testnet)
 *     - Wallet has < 0.05 SOL on the cluster Tide is using
 *
 *   In that state the user almost certainly has a cluster mismatch,
 *   so we surface the cluster name + a faucet link to fix it.
 *
 * Hidden conditions:
 *   - Not connected (no wallet, nothing to warn about)
 *   - On mainnet (no faucet exists, this isn't a "wrong network" UX)
 *   - On localnet (developer-only, they know what they're doing)
 *   - Balance loading or sufficient
 *
 * Mounted in app/layout.tsx so it appears across all pages, just
 * below the nav.
 */

const FAUCETS: Partial<Record<typeof CURRENT_NETWORK, string>> = {
  devnet: "https://faucet.solana.com/?cluster=devnet",
  // testnet not currently used but listed for completeness
};

const LOW_BALANCE_THRESHOLD_LAMPORTS = 50_000_000n; // 0.05 SOL

export function NetworkBanner() {
  const wallet = useWallet();
  const { solLamports, loading } = useUserBalances();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  if (!wallet.publicKey || loading) return null;
  if (CURRENT_NETWORK === "mainnet" || CURRENT_NETWORK === "localnet")
    return null;
  if (solLamports >= LOW_BALANCE_THRESHOLD_LAMPORTS) return null;

  const faucet = FAUCETS[CURRENT_NETWORK];
  if (!faucet) return null;

  return (
    <div className="net-banner" role="status" aria-live="polite">
      <span className="net-banner__dot" aria-hidden />
      <span className="net-banner__text">
        Tide is on <strong>{CURRENT_NETWORK}</strong>. Your wallet has
        <span className="mono"> {(Number(solLamports) / 1e9).toFixed(4)} SOL</span> —
        below 0.05 SOL needed for tx fees. Make sure your wallet is also on{" "}
        <strong>{CURRENT_NETWORK}</strong> and grab test SOL.
      </span>
      <a
        href={faucet}
        target="_blank"
        rel="noreferrer"
        className="btn btn--primary btn--sm net-banner__cta"
      >
        Get {CURRENT_NETWORK} SOL ↗
      </a>
    </div>
  );
}
