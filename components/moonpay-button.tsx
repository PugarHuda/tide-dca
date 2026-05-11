"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import { useToast } from "@/components/toast";

/**
 * "Top up via MoonPay" button. Opens MoonPay's hosted onramp in a
 * new tab pre-filled with the connected wallet as recipient.
 *
 * Flow:
 *   1. POST to /api/moonpay/sign with wallet + amount → server signs
 *      with HMAC-SHA256 + MOONPAY_SECRET_KEY, returns secure URL
 *   2. If endpoint returns 503 (no API key configured) → surface a
 *      toast explaining production gating, don't open broken page
 *   3. Otherwise window.open the returned URL in a new tab
 */
export function MoonPayButton({
  amount,
  variant = "primary",
  className,
}: {
  amount?: number;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  const { publicKey } = useWallet();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!publicKey || busy) return;
    setBusy(true);
    const redirectURL =
      typeof window !== "undefined"
        ? `${window.location.origin}/dashboard`
        : undefined;

    try {
      const res = await fetch("/api/moonpay/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          baseCurrencyAmount: amount,
          redirectURL,
        }),
      });
      if (res.status === 503) {
        toast.info(
          "MoonPay onramp button is wired (URL builder + HMAC server signing) but production API key isn't set on this deployment. Mainnet launch flips one env var.",
        );
        return;
      }
      if (!res.ok) {
        toast.error(`MoonPay sign endpoint returned ${res.status}`);
        return;
      }
      const json = (await res.json()) as { url?: string; signed?: boolean };
      // Validate shape before window.open — a 200 response with malformed
      // body (e.g. missing url field) would otherwise open about:blank
      // and the user just sees a blank tab.
      if (typeof json.url !== "string" || !json.url.startsWith("http")) {
        toast.error("MoonPay sign endpoint returned malformed response");
        return;
      }
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const cls = [
    "btn",
    variant === "primary" ? "btn--primary" : "btn--ghost",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={!publicKey || busy}
      className={cls}
      title={publicKey ? "Top up USDC via MoonPay" : "Connect wallet first"}
    >
      {busy ? <span className="spinner spinner--sm" /> : <MoonPayMark />}
      <span style={{ marginLeft: 8 }}>
        {busy ? "Opening MoonPay…" : "Top up via MoonPay"}
      </span>
    </button>
  );
}

function MoonPayMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 0 0 20" />
    </svg>
  );
}
