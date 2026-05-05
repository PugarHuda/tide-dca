"use client";

/**
 * Unified connect entry — one button in the nav, one modal that lists every
 * detected Solana wallet (Phantom, Solflare, Backpack, …) plus a Privy email
 * row when NEXT_PUBLIC_PRIVY_APP_ID is set.
 *
 * Two non-obvious wires worth knowing about:
 *
 *   • Modal is portaled to document.body via createPortal because the parent
 *     <nav> has `backdrop-filter: blur` set in globals.css, which establishes
 *     a containing block for fixed-positioned descendants. Without the
 *     portal the .modal-bg "fixed inset:0" is clamped to the nav box,
 *     producing the "melebar di navbar" failure mode.
 *
 *   • A `mounted` flag gates rendering of any wallet/Privy-restored state
 *     until after hydration. wallet-adapter's autoConnect can rehydrate a
 *     prior session, which makes the first client render diverge from the
 *     server HTML (React error #418, hydration text mismatch). Returning
 *     the inert "Connect wallet" button on the very first paint keeps the
 *     two trees identical.
 *
 *   • Connection flow uses the canonical wallet-adapter pattern: pick a
 *     wallet → `select(name)` → a useEffect calls `connect()` once the
 *     freshly-selected wallet appears in context. Calling adapter.connect()
 *     synchronously after select() races the context update.
 *
 * All visual styling lives in app/globals.css under "Connect modal options"
 * — no styled-jsx so the modal paints styled on first open.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  useWallet,
  type Wallet,
} from "@solana/wallet-adapter-react";
import { usePrivy } from "@privy-io/react-auth";

import { TideMark } from "./tide-mark";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function ConnectButton() {
  const wallet = useWallet();
  const privy = PRIVY_APP_ID ? usePrivy() : null;
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Connected via wallet-adapter ──
  // `mounted` gate avoids hydration mismatch — wallet-adapter restores
  // sessions from storage in a post-mount effect.
  if (mounted && wallet.publicKey) {
    return (
      <button
        className="btn btn--ghost btn--sm"
        onClick={() => void wallet.disconnect()}
        title="Disconnect"
      >
        <span className="dot dot--good" />
        <span className="mono">
          {wallet.publicKey.toBase58().slice(0, 4)}…
          {wallet.publicKey.toBase58().slice(-4)}
        </span>
      </button>
    );
  }

  // ── Connected via Privy embedded ──
  if (mounted && privy?.authenticated && privy.user) {
    const addr = privy.user.wallet?.address;
    const label =
      privy.user.email?.address ??
      (addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "Connected");
    return (
      <button
        className="btn btn--ghost btn--sm"
        onClick={() => privy.logout()}
        title="Sign out"
      >
        <span className="dot dot--good" />
        <span
          style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {label}
        </span>
      </button>
    );
  }

  const modal = modalOpen ? (
    <ConnectModal
      wallets={wallet.wallets}
      connecting={wallet.connecting}
      onPickWallet={async (w) => {
        // Browser popups (Phantom, Solflare) require an unbroken
        // user-gesture chain — calling adapter.connect() synchronously
        // here preserves it. Routing through select() + a useEffect-
        // triggered connect (which we tried earlier) breaks the chain
        // and Phantom blocks the popup silently.
        //
        // select() still runs so the wallet-adapter context knows which
        // wallet is current; the adapter's connect/disconnect events
        // propagate state through the existing listeners regardless.
        setModalOpen(false);
        try {
          wallet.select(w.adapter.name);
          await w.adapter.connect();
        } catch (err) {
          console.warn(`[Tide] connect ${w.adapter.name} failed:`, err);
        }
      }}
      onPickPrivy={
        privy
          ? () => {
              setModalOpen(false);
              privy.login();
            }
          : null
      }
      onClose={() => setModalOpen(false)}
    />
  ) : null;

  return (
    <>
      <button
        className="btn btn--primary btn--sm"
        onClick={() => setModalOpen(true)}
      >
        Connect wallet
      </button>
      {/* Portal so the fixed-position modal escapes the nav's backdrop-filter
          containing block. Only mount after hydration to keep SSR markup stable. */}
      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}

function ConnectModal({
  wallets,
  connecting,
  onPickWallet,
  onPickPrivy,
  onClose,
}: {
  wallets: Wallet[];
  connecting: boolean;
  onPickWallet: (w: Wallet) => void;
  onPickPrivy: (() => void) | null;
  onClose: () => void;
}) {
  // Order: detected (installed) wallets first, NotDetected last.
  // wallet-adapter exposes readyState as 'Installed' | 'NotDetected' | 'Loadable'.
  const sorted = [...wallets].sort((a, b) => {
    const aReady = a.adapter.readyState === "Installed";
    const bReady = b.adapter.readyState === "Installed";
    if (aReady === bReady) return 0;
    return aReady ? -1 : 1;
  });

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <TideMark size={22} />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            Sign in to Tide
          </h3>
        </div>
        <p
          className="muted"
          style={{ marginTop: 4, marginBottom: 22, fontSize: 13.5 }}
        >
          Choose how you'd like to access your Tide position. Your encrypted
          intent is held in MPC — we never see the amount.
        </p>

        <div className="grid gap-3">
          {sorted.length === 0 && (
            <div
              className="card card--quiet"
              style={{
                padding: 14,
                fontSize: 13,
                color: "var(--text-2)",
              }}
            >
              No Solana wallet detected.{" "}
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "var(--accent)",
                  textDecoration: "underline",
                }}
              >
                Install Phantom →
              </a>
            </div>
          )}

          {sorted.map((w) => {
            const installed = w.adapter.readyState === "Installed";
            const disabled = connecting;
            return (
              <button
                key={w.adapter.name}
                className="connect-opt"
                disabled={disabled}
                onClick={() => onPickWallet(w)}
                style={{ opacity: disabled ? 0.6 : 1 }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span className="connect-opt__icon">
                    {w.adapter.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.adapter.icon} alt="" width={24} height={24} />
                    ) : (
                      <span style={{ fontSize: 16 }}>◎</span>
                    )}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2,
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{w.adapter.name}</span>
                    <span className="tiny mute2">
                      {installed ? "Detected" : "Not installed"}
                    </span>
                  </span>
                </span>
                <span className="tiny mute2">›</span>
              </button>
            );
          })}

          {onPickPrivy && (
            <button
              className="connect-opt"
              onClick={onPickPrivy}
              disabled={connecting}
              style={{ opacity: connecting ? 0.6 : 1 }}
            >
              <span
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <span
                  className="connect-opt__icon"
                  style={{
                    background: "var(--accent-glow)",
                    color: "var(--accent)",
                    fontSize: 14,
                  }}
                >
                  ✉
                </span>
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 2,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>Email or social</span>
                  <span className="tiny mute2">Embedded wallet via Privy</span>
                </span>
              </span>
              <span className="tiny mute2">›</span>
            </button>
          )}
        </div>

        {connecting && (
          <div
            className="tiny"
            style={{
              marginTop: 14,
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className="dot dot--live" /> Waiting for wallet…
          </div>
        )}

        <div
          className="tiny mute2"
          style={{ marginTop: 18, lineHeight: 1.5 }}
        >
          By continuing you agree to the program's terms. Tide cannot access
          funds outside its own escrow PDAs.
        </div>
      </div>
    </div>
  );
}
