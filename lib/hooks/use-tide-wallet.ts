"use client";

import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";

import { useEmbeddedWallet } from "../wallet-context";

export type WalletSource = "wallet-adapter" | "privy-embedded" | null;

export type TideWalletState = {
  publicKey: PublicKey | null;
  connected: boolean;
  source: WalletSource;
};

/**
 * Unified wallet read for Tide UI.
 *
 * Returns publicKey from external wallet (Phantom/Solflare via wallet-adapter)
 * if connected; otherwise from Privy embedded wallet (created on email login)
 * if user authenticated; else null.
 *
 * Wallet-adapter takes precedence — when user explicitly connects an external
 * wallet we trust that as their intent.
 */
export function useTideWallet(): TideWalletState {
  const { publicKey: adapterPubkey } = useWallet();
  const { publicKey: embeddedPubkey } = useEmbeddedWallet();

  return useMemo(() => {
    if (adapterPubkey) {
      return { publicKey: adapterPubkey, connected: true, source: "wallet-adapter" };
    }
    if (embeddedPubkey) {
      return { publicKey: embeddedPubkey, connected: true, source: "privy-embedded" };
    }
    return { publicKey: null, connected: false, source: null };
  }, [adapterPubkey, embeddedPubkey]);
}
