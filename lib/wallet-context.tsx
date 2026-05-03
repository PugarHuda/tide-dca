"use client";

import { createContext, useContext } from "react";
import type { PublicKey } from "@solana/web3.js";

export type EmbeddedWalletState = {
  publicKey: PublicKey | null;
  ready: boolean;
};

const DEFAULT: EmbeddedWalletState = { publicKey: null, ready: true };

const Ctx = createContext<EmbeddedWalletState>(DEFAULT);

export const EmbeddedWalletProvider = Ctx.Provider;

export function useEmbeddedWallet(): EmbeddedWalletState {
  return useContext(Ctx);
}
