"use client";

/**
 * Bridges Privy's Solana embedded wallet into the TideWalletContext so the
 * rest of the app can read user's pubkey via useTideWallet() regardless of
 * whether the user logged in via email (Privy) or connected an external
 * wallet (Phantom via wallet-adapter).
 *
 * MUST be rendered inside <PrivyProvider>. lib/providers.tsx handles that.
 */

import { useMemo, type ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { PublicKey } from "@solana/web3.js";

import { EmbeddedWalletProvider, type EmbeddedWalletState } from "./wallet-context";

export function PrivyEmbeddedBridge({ children }: { children: ReactNode }) {
  const { authenticated, ready } = usePrivy();
  const { wallets } = useSolanaWallets();

  const value = useMemo<EmbeddedWalletState>(() => {
    if (!authenticated || wallets.length === 0) return { publicKey: null, ready };
    try {
      return { publicKey: new PublicKey(wallets[0].address), ready };
    } catch {
      return { publicKey: null, ready };
    }
  }, [authenticated, wallets, ready]);

  return <EmbeddedWalletProvider value={value}>{children}</EmbeddedWalletProvider>;
}
