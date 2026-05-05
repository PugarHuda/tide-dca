"use client";

/**
 * Unified connect entry — one button in the nav, one modal that lists every
 * detected Solana wallet (Phantom, Solflare, Backpack, …) plus a Privy email
 * row when NEXT_PUBLIC_PRIVY_APP_ID is set.
 *
 * Three non-obvious wires worth knowing about:
 *
 *   • Modal is portaled to document.body via createPortal because the parent
 *     <nav> has `backdrop-filter: blur` set in globals.css, which establishes
 *     a containing block for fixed-positioned descendants. Without the
 *     portal the .modal-bg `fixed inset:0` is clamped to the nav box,
 *     producing the "melebar di navbar" failure mode.
 *
 *   • A `mounted` flag gates rendering of any wallet/Privy-restored state
 *     until after hydration. wallet-adapter's autoConnect can rehydrate a
 *     prior session, which would make the first client render diverge from
 *     the server HTML (React error #418). Returning the inert
 *     "Connect wallet" button on the very first paint keeps the two trees
 *     identical.
 *
 *   • adapter.connect() is called synchronously inside onPickWallet so the
 *     browser's user-gesture chain stays intact; pushing it through a
 *     useEffect (which we tried) lets Phantom silently block the popup.
 *     wallet.select(name) still runs alongside so the wallet-adapter
 *     context picks up the connection events emitted by the adapter.
 *
 * All visual styling lives in app/globals.css under "Modal" + "Connect
 * modal options" + "Account menu" sections — no styled-jsx so everything
 * paints correctly on first render (no FOUC).
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useWallet,
  type Wallet,
} from "@solana/wallet-adapter-react";
import { usePrivy } from "@privy-io/react-auth";

import { TideMark } from "./tide-mark";
import { useUserBalances } from "@/lib/hooks";
import { formatSol, formatUsdc } from "@/lib/utils";

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
    const addr = wallet.publicKey.toBase58();
    const short = `${addr.slice(0, 4)}…${addr.slice(-4)}`;
    return (
      <AccountMenu
        label={short}
        fullAddress={addr}
        onDisconnect={() => void wallet.disconnect()}
      />
    );
  }

  // ── Connected via Privy embedded ──
  if (mounted && privy?.authenticated && privy.user) {
    const addr = privy.user.wallet?.address;
    const label =
      privy.user.email?.address ??
      (addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "Connected");
    return (
      <AccountMenu
        label={label}
        fullAddress={addr ?? null}
        onDisconnect={() => privy.logout()}
      />
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

/**
 * Connected-state nav button — shows a green dot + truncated label, opens
 * a small menu on click with "copy address", "view on Solana Explorer",
 * and "disconnect". Closing on outside-click + Escape.
 */
function AccountMenu({
  label,
  fullAddress,
  onDisconnect,
}: {
  label: string;
  fullAddress: string | null;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { solLamports, usdcLamports } = useUserBalances();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleCopy = async () => {
    if (!fullAddress) return;
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore — older browsers / blocked permissions
    }
  };

  return (
    <div ref={wrapRef} className="acct">
      <button
        className="btn btn--ghost btn--sm"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="dot dot--good" />
        <span
          style={{
            maxWidth: 160,
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: fullAddress ? "var(--font-mono)" : undefined,
          }}
        >
          {label}
        </span>
        <span className="mute2" style={{ marginLeft: 4, fontSize: 10 }}>
          ▾
        </span>
      </button>

      {open && (
        <div className="acct__menu" role="menu">
          {fullAddress && (
            <div className="acct__addr">
              <span className="tiny mute2">Connected wallet</span>
              <span className="mono" style={{ fontSize: 12 }}>
                {fullAddress.slice(0, 8)}…{fullAddress.slice(-8)}
              </span>
            </div>
          )}
          {fullAddress && (
            <div
              className="acct__balance"
              role="presentation"
              aria-label="Wallet balance"
            >
              <span>
                <span className="tiny mute2" style={{ display: "block" }}>
                  USDC
                </span>
                <span className="mono" style={{ color: "var(--accent)" }}>
                  {formatUsdc(usdcLamports)}
                </span>
              </span>
              <span style={{ textAlign: "right" }}>
                <span className="tiny mute2" style={{ display: "block" }}>
                  SOL
                </span>
                <span className="mono">{formatSol(solLamports, 4)}</span>
              </span>
            </div>
          )}
          {fullAddress && (
            <button className="acct__item" onClick={() => void handleCopy()}>
              <span>{copied ? "✓ Copied" : "Copy address"}</span>
            </button>
          )}
          {fullAddress && (
            <a
              className="acct__item"
              href={`https://explorer.solana.com/address/${fullAddress}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span>View on Solana Explorer ↗</span>
            </a>
          )}
          <div className="acct__sep" />
          <button
            className="acct__item acct__item--danger"
            onClick={() => {
              setOpen(false);
              onDisconnect();
            }}
            role="menuitem"
          >
            <span>Disconnect</span>
          </button>
        </div>
      )}
    </div>
  );
}
