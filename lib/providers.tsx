"use client";

/**
 * Tide app-level providers.
 *
 * Two complementary auth surfaces, intentionally separated at the connector
 * layer (the nav button unifies them at the UI layer):
 *
 *   1. @solana/wallet-adapter — handles existing Solana wallets (Phantom,
 *      Solflare, Backpack) via the Wallet Standard registry. We bring our
 *      own modal in components/connect-button.tsx and skip
 *      @solana/wallet-adapter-react-ui entirely (its styles clash with the
 *      design system; we only need the headless hooks).
 *
 *      We instantiate explicit adapters ONLY for wallets that haven't
 *      shipped Wallet Standard yet — currently just Ledger over USB.
 *      Phantom (v24+), Solflare, Backpack, Coinbase, and Trust all
 *      register themselves via Wallet Standard automatically; adding
 *      legacy adapters for them creates a duplicate "NotDetected" row
 *      because the legacy code paths (e.g. window.solana injection)
 *      have been removed in favor of the Standard's namespaced approach.
 *      Belt-and-suspenders was wrong here — Wallet Standard is now
 *      authoritative for browser-extension Solana wallets.
 *
 *   2. Privy — handles email/social login for users who don't have a
 *      Solana wallet yet. Privy auto-creates an embedded Solana wallet on
 *      first login. PrivyEmbeddedBridge publishes that wallet's pubkey
 *      into TideWalletContext so useTideWallet() can return it.
 *
 * We deliberately do NOT pass `externalWallets.solana.connectors` to
 * Privy — that registers Privy as a Wallet Standard connector and causes
 * "Privy" to appear inside the wallet adapter modal alongside Phantom.
 * Privy is for embedded-only here.
 *
 * Session TTL: wallet-adapter's `autoConnect` rehydrates the previously
 * connected wallet from localStorage on every page load with no
 * expiration, so users who connected days ago stay "connected" until
 * they manually disconnect. We gate autoConnect behind a 24h timestamp
 * — if last activity is older, wipe the persisted selection so the next
 * visit requires a fresh user gesture. Better security default for a
 * financial app + matches typical session expectations.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { LedgerWalletAdapter } from "@solana/wallet-adapter-wallets";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

import { CURRENT_NETWORK, RPC_URLS } from "./constants";
import { PrivyEmbeddedBridge } from "./privy-bridge";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const SESSION_KEY = "tide:wallet:connectedAt";
const ADAPTER_STORAGE_KEY = "walletName"; // wallet-adapter default
const PRIVY_SESSION_KEY = "tide:privy:connectedAt";

/**
 * Sync the connected-at timestamp on every successful connect so the
 * 24h TTL window slides forward with each user activity. Mounted inside
 * WalletProvider so it can read the wallet context.
 */
function WalletSessionTimestampSync() {
  const wallet = useWallet();
  useEffect(() => {
    if (wallet.connected && typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_KEY, Date.now().toString());
    }
  }, [wallet.connected]);
  return null;
}

/**
 * Privy parity for the 24h session TTL. Privy sessions persist in their
 * own storage (which we can't reach directly) but `usePrivy().logout()`
 * tears them down. Pattern:
 *   - On mount, after `ready`, check our stored timestamp. If expired,
 *     call `logout()` so the user must re-authenticate
 *   - On every `authenticated` flip to true, refresh the timestamp
 *
 * The `checked` guard prevents the expiry check from re-running and
 * accidentally logging out a freshly authenticated session whose
 * timestamp hadn't been written yet.
 */
function PrivySessionTimestampSync() {
  const { authenticated, ready, logout } = usePrivy();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready || checked || typeof window === "undefined") return;
    const ts = window.localStorage.getItem(PRIVY_SESSION_KEY);
    if (authenticated && ts) {
      const age = Date.now() - parseInt(ts, 10);
      if (Number.isNaN(age) || age > SESSION_TTL_MS) {
        window.localStorage.removeItem(PRIVY_SESSION_KEY);
        void logout();
      }
    }
    setChecked(true);
  }, [ready, authenticated, logout, checked]);

  useEffect(() => {
    if (authenticated && typeof window !== "undefined") {
      window.localStorage.setItem(PRIVY_SESSION_KEY, Date.now().toString());
    }
  }, [authenticated]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => RPC_URLS[CURRENT_NETWORK], []);

  // Explicit adapters ONLY for wallets that haven't shipped Wallet
  // Standard yet. Phantom (v24+), Solflare, Backpack, Coinbase, Trust
  // all auto-register via Wallet Standard — adding them explicitly
  // here would create duplicate entries in the modal where the legacy
  // adapter shows as 'NotDetected' (because Phantom no longer injects
  // window.solana, only window.phantom.solana via the Standard).
  // Users would click the NotDetected row and get a misleading
  // "not installed" toast. Belt-and-suspenders here was wrong:
  // Wallet Standard is now authoritative for these wallets.
  //
  // Ledger USB stays — its hardware wallet flow doesn't fit the
  // Standard's browser-injection model.
  const wallets = useMemo(() => [new LedgerWalletAdapter()], []);

  // TTL-gated autoConnect. Default to false so SSR + first paint
  // never trigger a stealth reconnect; enable only after the post-mount
  // effect confirms a fresh-enough session timestamp.
  const [autoConnectEnabled, setAutoConnectEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ts = window.localStorage.getItem(SESSION_KEY);
    if (!ts) return;
    const age = Date.now() - parseInt(ts, 10);
    if (Number.isNaN(age) || age > SESSION_TTL_MS) {
      // Expired — wipe wallet-adapter's persisted wallet name so
      // autoConnect (if it ever flips on) has nothing to reconnect to.
      window.localStorage.removeItem(ADAPTER_STORAGE_KEY);
      window.localStorage.removeItem(SESSION_KEY);
      return;
    }
    setAutoConnectEnabled(true);
  }, []);

  const inner = (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={autoConnectEnabled}>
        <WalletSessionTimestampSync />
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );

  // Graceful fallback if Privy not configured (e.g. local dev without app ID)
  if (!PRIVY_APP_ID) return inner;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#06b6d4",
          walletChainType: "solana-only",
        },
        loginMethods: ["email", "google", "twitter"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <PrivySessionTimestampSync />
      <PrivyEmbeddedBridge>{inner}</PrivyEmbeddedBridge>
    </PrivyProvider>
  );
}
