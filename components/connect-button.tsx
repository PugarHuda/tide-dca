"use client";

/**
 * Unified connect entry — one button in the nav, one modal with all paths:
 *   - Phantom / Solflare / Backpack via @solana/wallet-adapter (Wallet Standard
 *     auto-detect through navigator.wallets)
 *   - Email / Google / Twitter via Privy (creates an embedded Solana wallet)
 *
 * Both paths converge into useTideWallet so downstream code reads a single
 * "are we connected?" state regardless of how the user got in.
 *
 * We deliberately drop @solana/wallet-adapter-react-ui's WalletMultiButton —
 * it ships its own purple-tinted CSS that clashes with Tide's cyan palette,
 * and bundling our own modal lets us match the design system exactly.
 */

import { useState } from "react";
import Image from "next/image";
import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import { usePrivy } from "@privy-io/react-auth";

import { TideMark } from "./tide-mark";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function ConnectButton() {
  const wallet = useWallet();
  const privy = PRIVY_APP_ID ? usePrivy() : null;
  const [open, setOpen] = useState(false);

  // Connected via wallet-adapter (Phantom/Solflare/Backpack)
  if (wallet.publicKey) {
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

  // Connected via Privy (email/social → embedded Solana wallet)
  if (privy?.authenticated && privy.user) {
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
        <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
      </button>
    );
  }

  return (
    <>
      <button
        className="btn btn--primary btn--sm"
        onClick={() => setOpen(true)}
      >
        Connect wallet
      </button>
      {open && (
        <ConnectModal
          wallets={wallet.wallets}
          onPickWallet={async (w) => {
            setOpen(false);
            wallet.select(w.adapter.name);
            // wallet-adapter v0.15+ auto-connects after select when
            // autoConnect=true (we set it in providers). Kick connect()
            // explicitly to be robust if a wallet is already remembered.
            try {
              await w.adapter.connect();
            } catch {
              // user cancelled — silent, modal already closed
            }
          }}
          onPickPrivy={
            privy
              ? () => {
                  setOpen(false);
                  privy.login();
                }
              : null
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ConnectModal({
  wallets,
  onPickWallet,
  onPickPrivy,
  onClose,
}: {
  wallets: Wallet[];
  onPickWallet: (w: Wallet) => void | Promise<void>;
  onPickPrivy: (() => void) | null;
  onClose: () => void;
}) {
  return (
    <>
      <div className="modal-bg" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
            }}
          >
            <TideMark size={22} />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              Sign in to Tide
            </h3>
          </div>
          <p
            className="muted"
            style={{ marginTop: 6, marginBottom: 22, fontSize: 14 }}
          >
            Choose how you'd like to access your Tide position. Your encrypted
            intent is held in MPC — we never see the amount.
          </p>

          <div className="grid gap-3">
            {wallets.length === 0 && (
              <p className="tiny mute2" style={{ margin: 0 }}>
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
              </p>
            )}
            {wallets.map((w) => (
              <button
                key={w.adapter.name}
                className="connect-opt"
                onClick={() => void onPickWallet(w)}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span className="connect-opt__icon">
                    {w.adapter.icon ? (
                      <Image
                        src={w.adapter.icon}
                        alt=""
                        width={24}
                        height={24}
                        unoptimized
                      />
                    ) : (
                      <span style={{ fontSize: 16 }}>◎</span>
                    )}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{w.adapter.name}</span>
                    <span className="tiny mute2">Solana wallet</span>
                  </span>
                </span>
                <span className="tiny mute2">›</span>
              </button>
            ))}

            {onPickPrivy && (
              <button className="connect-opt" onClick={onPickPrivy}>
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
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>Email or social</span>
                    <span className="tiny mute2">
                      Embedded wallet via Privy
                    </span>
                  </span>
                </span>
                <span className="tiny mute2">›</span>
              </button>
            )}
          </div>

          <div
            className="tiny mute2"
            style={{ marginTop: 18, lineHeight: 1.5 }}
          >
            By continuing you agree to the program's terms. Tide cannot access
            funds outside its own escrow PDAs.
          </div>
        </div>
      </div>
    </>
  );
}
