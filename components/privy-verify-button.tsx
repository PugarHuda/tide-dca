"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { useToast } from "@/components/toast";

/**
 * "Verify Privy auth" admin button. Calls `/api/privy/verify` with the
 * current Privy access token (JWT). Server-side endpoint cracks the JWT,
 * round-trips to Privy's `/api/v1/sessions/<sid>` for revocation +
 * binding check, returns the verified user id.
 *
 * Demonstrates the full auth path:
 *   client → embedded Privy login → JWT → /api/privy/verify → Privy API
 *
 * Without this round-trip, the Privy claim is "wallet-adapter cohabitation".
 * With it, we can prove server-side auth gating works end-to-end.
 */
export function PrivyVerifyButton() {
  const { authenticated, getAccessToken, login } = usePrivy();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!authenticated) {
      // Trigger Privy login modal — embedded wallet auto-creates after.
      login();
      return;
    }
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Privy returned no access token");
        return;
      }
      const res = await fetch("/api/privy/verify", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as
        | { ok: true; userId: string; sessionId?: string }
        | { ok: false; error: string };
      if (body.ok) {
        toast.success(`Privy verified · user ${body.userId.slice(0, 12)}…`);
      } else {
        toast.error(`Verify failed: ${body.error}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={() => void onClick()}
      disabled={busy}
      className="btn btn--ghost btn--sm"
      title={
        authenticated
          ? "Round-trip Privy access token through server verifier"
          : "Sign in with Privy first"
      }
    >
      {busy && <span className="spinner spinner--sm" />}
      {busy
        ? "Verifying…"
        : authenticated
          ? "Verify Privy auth"
          : "Sign in with Privy"}
    </button>
  );
}
