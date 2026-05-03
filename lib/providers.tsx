"use client";

/**
 * Tide app-level providers.
 *
 * Stack:
 * - Privy <PrivyProvider> — embedded wallet for non-crypto onboarding
 * - Solana ConnectionProvider — Helius RPC
 * - WalletProvider (Wallet Standard) — auto-detects Phantom/Solflare/Backpack
 * - WalletModalProvider — UI for wallet selection
 *
 * Privy is the OUTER layer — provides email/social login which auto-creates
 * embedded Solana wallet. Crypto-native users tetap dapat connect Phantom
 * via Wallet Standard di inner WalletProvider.
 */

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PrivyProvider } from "@privy-io/react-auth";
import "@solana/wallet-adapter-react-ui/styles.css";

import { CURRENT_NETWORK, RPC_URLS } from "./constants";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => RPC_URLS[CURRENT_NETWORK], []);
  const wallets = useMemo(() => [], []);

  const inner = (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );

  // Graceful fallback if Privy not configured
  if (!PRIVY_APP_ID) return inner;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#06b6d4",
        },
        loginMethods: ["email", "google", "twitter", "wallet"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      {inner}
    </PrivyProvider>
  );
}
