"use client";

/**
 * Tide app-level providers.
 *
 * Stack:
 * - Solana ConnectionProvider (Helius RPC)
 * - WalletProvider (Wallet Standard, auto-detects Phantom/Solflare/Backpack)
 * - WalletModalProvider (UI for wallet selection)
 *
 * TODO when SDKs ready:
 * - Privy <PrivyProvider> for embedded wallet
 * - MoonPay <MoonPayProvider> for fiat top-up
 * - Arcium client init
 */

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

import { CURRENT_NETWORK, RPC_URLS } from "./constants";

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => RPC_URLS[CURRENT_NETWORK], []);
  const wallets = useMemo(() => [], []); // Wallet Standard auto-detects

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
