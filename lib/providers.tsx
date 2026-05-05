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
 *   2. Privy — handles email/social login for users who don't have a
 *      Solana wallet yet. Privy auto-creates an embedded Solana wallet on
 *      first login. PrivyEmbeddedBridge publishes that wallet's pubkey
 *      into TideWalletContext so useTideWallet() can return it.
 *
 * We deliberately do NOT pass `externalWallets.solana.connectors` to
 * Privy — that registers Privy as a Wallet Standard connector and causes
 * "Privy" to appear inside the wallet adapter modal alongside Phantom.
 * Privy is for embedded-only here.
 */

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PrivyProvider } from "@privy-io/react-auth";

import { CURRENT_NETWORK, RPC_URLS } from "./constants";
import { PrivyEmbeddedBridge } from "./privy-bridge";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => RPC_URLS[CURRENT_NETWORK], []);
  const wallets = useMemo(() => [], []);

  const inner = (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
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
      <PrivyEmbeddedBridge>{inner}</PrivyEmbeddedBridge>
    </PrivyProvider>
  );
}
