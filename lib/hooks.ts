"use client";

/**
 * React hooks for Tide on-chain data.
 *
 * Stack: @solana/wallet-adapter-react for connection + wallet
 * @coral-xyz/anchor for program interaction
 *
 * TODO after IDL generated:
 * - Replace `any` with typed Program
 * - Implement real account fetches
 */

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import type { DcaPosition, Pool, Window } from "./types";
import {
  findDcaPositionPda,
  findPoolPda,
} from "./anchor-client";
import { SOL_MINT, USDC_MINT_DEVNET } from "./constants";

/** Fetch the canonical SOL/USDC pool. */
export function usePool(): {
  pool: Pool | null;
  poolPubkey: PublicKey | null;
  loading: boolean;
} {
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);

  const [poolPubkey] = findPoolPda(USDC_MINT_DEVNET, SOL_MINT);

  useEffect(() => {
    // TODO: fetch Pool account via anchor.account.pool.fetch(poolPubkey)
    // For now: stub data
    setLoading(false);
    setPool(null);
  }, []);

  return { pool, poolPubkey, loading };
}

/** Fetch user's DcaPosition for the canonical pool. */
export function useUserPosition(): {
  position: DcaPosition | null;
  positionPubkey: PublicKey | null;
  loading: boolean;
} {
  const { publicKey } = useWallet();
  const { poolPubkey } = usePool();
  const [position, setPosition] = useState<DcaPosition | null>(null);
  const [loading, setLoading] = useState(true);

  const positionPubkey =
    publicKey && poolPubkey ? findDcaPositionPda(publicKey, poolPubkey)[0] : null;

  useEffect(() => {
    if (!positionPubkey) {
      setLoading(false);
      return;
    }
    // TODO: fetch DcaPosition account
    setLoading(false);
    setPosition(null);
  }, [positionPubkey]);

  return { position, positionPubkey, loading };
}

/** Fetch current active window for a pool. */
export function useCurrentWindow(): {
  window: Window | null;
  windowPubkey: PublicKey | null;
  loading: boolean;
  timeRemaining: number; // seconds until window closes
} {
  const { pool } = usePool();
  const [window, setWindow] = useState<Window | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pool) {
      setLoading(false);
      return;
    }
    // TODO: fetch active Window via pool.activeWindow
    setLoading(false);
  }, [pool]);

  // Update countdown every second
  useEffect(() => {
    if (!window) return;
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Number(window.endTs) - now;
      setTimeRemaining(Math.max(0, remaining));
    }, 1000);
    return () => clearInterval(interval);
  }, [window]);

  return {
    window,
    windowPubkey: pool?.activeWindow ?? null,
    loading,
    timeRemaining,
  };
}

/** Subscribe to window updates via WebSocket (Helius). */
export function useWindowSubscription(windowPubkey: PublicKey | null) {
  const { connection } = useConnection();
  const [window, setWindow] = useState<Window | null>(null);

  useEffect(() => {
    if (!windowPubkey) return;

    // TODO: subscribe to account changes
    // const subscriptionId = connection.onAccountChange(windowPubkey, (accountInfo) => {
    //   const decoded = program.coder.accounts.decode("window", accountInfo.data);
    //   setWindow(decoded);
    // });
    // return () => connection.removeAccountChangeListener(subscriptionId);

    void connection;
  }, [windowPubkey, connection]);

  return window;
}
