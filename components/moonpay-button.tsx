"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import { buildMoonPayUrl } from "@/lib/moonpay";

/**
 * "Top up via MoonPay" button. Opens MoonPay's hosted onramp in a new
 * tab pre-filled with the connected wallet as recipient. Disabled
 * if no wallet is connected.
 *
 * Flow:
 *   1. POST to /api/moonpay/sign with wallet + amount → server signs
 *      with HMAC-SHA256 + MOONPAY_SECRET_KEY, returns secure URL
 *   2. If server signing unavailable (no secret), client falls back to
 *      sandbox URL (capped at $100/tx). Either way, button works.
 *   3. window.open the returned URL in a new tab.
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
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!publicKey || busy) return;
    setBusy(true);
    const redirectURL =
      typeof window !== "undefined"
        ? `${window.location.origin}/dashboard`
        : undefined;

    let urlToOpen: string;
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
      if (res.ok) {
        const json = (await res.json()) as { url: string; signed: boolean };
        urlToOpen = json.url;
      } else {
        urlToOpen = buildMoonPayUrl({
          walletAddress: publicKey.toBase58(),
          baseCurrencyAmount: amount,
          redirectURL,
        });
      }
    } catch {
      urlToOpen = buildMoonPayUrl({
        walletAddress: publicKey.toBase58(),
        baseCurrencyAmount: amount,
        redirectURL,
      });
    } finally {
      setBusy(false);
    }
    window.open(urlToOpen, "_blank", "noopener,noreferrer");
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
