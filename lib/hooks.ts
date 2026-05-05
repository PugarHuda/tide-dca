"use client";

/**
 * React hooks for Tide on-chain data.
 *
 * Decodes raw account data via lib/account-decoders.ts (no IDL needed —
 * see that file for the rationale). Pool/Window subscriptions use
 * connection.onAccountChange so the dashboard updates live without polling.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import {
  decodeDcaPosition,
  decodeIntent,
  decodePool,
  decodeWindow,
} from "./account-decoders";
import { findDcaPositionPda, findPoolPda, findWindowPda } from "./anchor-client";
import { CURRENT_NETWORK, SOL_MINT, USDC_MINT_DEVNET, USDC_MINT_MAINNET } from "./constants";
import type { DcaPosition, Intent, Pool, Window } from "./types";
import { useTideWallet } from "./hooks/use-tide-wallet";
import { findIntentPda } from "./anchor-client";

const USDC_MINT =
  CURRENT_NETWORK === "mainnet" ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;

/** Fetch the canonical SOL/USDC pool — reactive to chain updates. */
export function usePool(): {
  pool: Pool | null;
  poolPubkey: PublicKey;
  loading: boolean;
} {
  const { connection } = useConnection();
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);

  // Memoize so the PublicKey reference is stable across renders. Without
  // this the useEffect below sees a "new" poolPubkey every render and
  // restarts forever — observable as a permanent "Loading pool…" state.
  const poolPubkey = useMemo(() => findPoolPda(USDC_MINT, SOL_MINT)[0], []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    connection
      .getAccountInfo(poolPubkey, "confirmed")
      .then((info) => {
        if (cancelled) return;
        setPool(info ? decodePool(info.data as Buffer) : null);
      })
      .catch(() => !cancelled && setPool(null))
      .finally(() => !cancelled && setLoading(false));

    const subId = connection.onAccountChange(poolPubkey, (info) => {
      try {
        setPool(decodePool(info.data as Buffer));
      } catch {
        setPool(null);
      }
    });

    return () => {
      cancelled = true;
      void connection.removeAccountChangeListener(subId);
    };
  }, [connection, poolPubkey]);

  return { pool, poolPubkey, loading };
}

/** Fetch user's DcaPosition for the canonical pool. */
export function useUserPosition(): {
  position: DcaPosition | null;
  positionPubkey: PublicKey | null;
  loading: boolean;
} {
  const { connection } = useConnection();
  const { publicKey } = useTideWallet();
  const { poolPubkey } = usePool();
  const [position, setPosition] = useState<DcaPosition | null>(null);
  const [loading, setLoading] = useState(true);

  const positionPubkey =
    publicKey ? findDcaPositionPda(publicKey, poolPubkey)[0] : null;

  useEffect(() => {
    if (!positionPubkey) {
      setPosition(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    connection
      .getAccountInfo(positionPubkey, "confirmed")
      .then((info) => {
        if (cancelled) return;
        setPosition(info ? decodeDcaPosition(info.data as Buffer) : null);
      })
      .catch(() => !cancelled && setPosition(null))
      .finally(() => !cancelled && setLoading(false));

    const subId = connection.onAccountChange(positionPubkey, (info) => {
      try {
        setPosition(decodeDcaPosition(info.data as Buffer));
      } catch {
        setPosition(null);
      }
    });

    return () => {
      cancelled = true;
      void connection.removeAccountChangeListener(subId);
    };
  }, [connection, positionPubkey?.toBase58()]); // eslint-disable-line react-hooks/exhaustive-deps

  return { position, positionPubkey, loading };
}

/** Fetch the pool's currently active Window with live countdown. */
export function useCurrentWindow(): {
  window: Window | null;
  windowPubkey: PublicKey | null;
  loading: boolean;
  timeRemaining: number;
} {
  const { connection } = useConnection();
  const { pool, poolPubkey } = usePool();
  const [window, setWindow] = useState<Window | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Pool tracks `windowCounter` (next-to-create) and `activeWindow` (current).
  // Prefer activeWindow pointer; fall back to derived PDA from counter-1.
  const windowPubkey: PublicKey | null = (() => {
    if (!pool) return null;
    if (!pool.activeWindow.equals(PublicKey.default)) return pool.activeWindow;
    if (pool.windowCounter > 0n) {
      return findWindowPda(poolPubkey, pool.windowCounter - 1n)[0];
    }
    return null;
  })();

  // Track latest pubkey via ref so subscription cleanup can compare.
  const subscribedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!windowPubkey) {
      setWindow(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    connection
      .getAccountInfo(windowPubkey, "confirmed")
      .then((info) => {
        if (cancelled) return;
        setWindow(info ? decodeWindow(info.data as Buffer) : null);
      })
      .catch(() => !cancelled && setWindow(null))
      .finally(() => !cancelled && setLoading(false));

    subscribedRef.current = windowPubkey.toBase58();
    const subId = connection.onAccountChange(windowPubkey, (info) => {
      try {
        setWindow(decodeWindow(info.data as Buffer));
      } catch {
        setWindow(null);
      }
    });

    return () => {
      cancelled = true;
      void connection.removeAccountChangeListener(subId);
    };
  }, [connection, windowPubkey?.toBase58()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local-clock-driven countdown; doesn't need RPC.
  useEffect(() => {
    if (!window) {
      setTimeRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Number(window.endTs) - Math.floor(Date.now() / 1000);
      setTimeRemaining(Math.max(0, remaining));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [window]);

  return { window, windowPubkey, loading, timeRemaining };
}

/** Fetch the user's Intent for a specific window (if committed). */
export function useUserIntent(windowPubkey: PublicKey | null): {
  intent: Intent | null;
  intentPubkey: PublicKey | null;
  loading: boolean;
} {
  const { connection } = useConnection();
  const { publicKey } = useTideWallet();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(true);

  const intentPubkey =
    publicKey && windowPubkey
      ? findIntentPda(windowPubkey, publicKey)[0]
      : null;

  useEffect(() => {
    if (!intentPubkey) {
      setIntent(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    connection
      .getAccountInfo(intentPubkey, "confirmed")
      .then((info) => {
        if (cancelled) return;
        setIntent(info ? decodeIntent(info.data as Buffer) : null);
      })
      .catch(() => !cancelled && setIntent(null))
      .finally(() => !cancelled && setLoading(false));

    const subId = connection.onAccountChange(intentPubkey, (info) => {
      try {
        setIntent(decodeIntent(info.data as Buffer));
      } catch {
        setIntent(null);
      }
    });

    return () => {
      cancelled = true;
      void connection.removeAccountChangeListener(subId);
    };
  }, [connection, intentPubkey?.toBase58()]); // eslint-disable-line react-hooks/exhaustive-deps

  return { intent, intentPubkey, loading };
}

/**
 * Fetch every settled Window account for the canonical pool, ordered by
 * window number ascending. Settled = status >= 2 (Distributed). Used to
 * build the cumulative savings chart from real history.
 *
 * Strategy: pool.windowCounter is the next-window index, so we know there
 * are exactly that many Window PDAs ever derived. Batch them into a single
 * getMultipleAccountsInfo RPC call (max ~100 keys per call — Tide will
 * surely settle <100 windows before mainnet); decode in place.
 */
export function useWindowHistory(): {
  windows: Window[];
  loading: boolean;
} {
  const { connection } = useConnection();
  const { pool, poolPubkey } = usePool();
  const [windows, setWindows] = useState<Window[]>([]);
  const [loading, setLoading] = useState(true);

  const counter = pool ? Number(pool.windowCounter) : 0;

  useEffect(() => {
    if (!pool || counter === 0) {
      setWindows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const pdas = Array.from({ length: counter }, (_, i) =>
      findWindowPda(poolPubkey, BigInt(i))[0],
    );

    connection
      .getMultipleAccountsInfo(pdas, "confirmed")
      .then((infos) => {
        if (cancelled) return;
        const decoded: Window[] = [];
        infos.forEach((info) => {
          if (!info) return;
          try {
            decoded.push(decodeWindow(info.data as Buffer));
          } catch {
            // skip malformed; happens if a window account was closed
          }
        });
        // Only the ones that actually settled (status >= 2)
        setWindows(decoded.filter((w) => w.status >= 2));
      })
      .catch(() => !cancelled && setWindows([]))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [connection, poolPubkey, counter, pool]);

  return { windows, loading };
}
