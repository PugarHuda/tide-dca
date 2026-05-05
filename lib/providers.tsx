"use client";

/**
 * Tide app-level providers.
 *
 * Two complementary auth surfaces, intentionally separated:
 *
 *   1. @solana/wallet-adapter — handles existing Solana wallets (Phantom,
 *      Solflare, Backpack) via the Wallet Standard registry. This is the
 *      crypto-native path; ConnectButton in the nav uses WalletMultiButton.
 *
 *   2. Privy — handles email/social login for users who don't have a
 *      Solana wallet yet. Privy auto-creates an embedded Solana wallet on
 *      first login. PrivyEmbeddedBridge publishes that wallet's pubkey
 *      into TideWalletContext so useTideWallet() can return it.
 *
 * IMPORTANT: we deliberately do NOT pass `externalWallets.solana.connectors`
 * to Privy. That config registers Privy as a Wallet Standard connector,
 * which causes "Privy" to appear in WalletMultiButton's modal alongside
 * Phantom — picking it routes to Privy's own modal which historically
 * fell back to Ethereum mode mid-session. Privy is for embedded wallets
 * here, period; external wallet handling stays with wallet-adapter.
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
import { PrivyEmbeddedBridge } from "./privy-bridge";

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
        // Email/social only — wallet connection is wallet-adapter's job.
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
