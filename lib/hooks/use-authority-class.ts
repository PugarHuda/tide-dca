"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { classifyAuthority, type AuthorityClassification } from "@/lib/squads";

/**
 * Resolve a pool authority pubkey to its concrete kind (wallet vs Squads
 * multisig vs other-program). Returns null while loading and resets when
 * the input pubkey changes.
 */
export function useAuthorityClassification(authority: PublicKey | null) {
  const { connection } = useConnection();
  const [result, setResult] = useState<AuthorityClassification | null>(null);

  useEffect(() => {
    setResult(null);
    if (!authority) return;
    let cancelled = false;
    classifyAuthority(connection, authority)
      .then((c) => {
        if (!cancelled) setResult(c);
      })
      .catch(() => {
        if (!cancelled)
          setResult({
            kind: "unknown",
            authority,
            reason: "Failed to fetch account info",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [authority, connection]);

  return result;
}
