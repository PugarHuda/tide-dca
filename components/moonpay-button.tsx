"use client";

import { useWallet } from "@solana/wallet-adapter-react";

import { buildMoonPayUrl } from "@/lib/moonpay";

/**
 * "Top up via MoonPay" button. Opens MoonPay's hosted onramp in a new
 * tab pre-filled with the connected wallet as recipient. Disabled
 * if no wallet is connected.
 *
 * Note: MoonPay sandbox accepts demo keys for testnet flows. Production
 * key gates the live onramp.
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

  const onClick = () => {
    if (!publicKey) return;
    const url = buildMoonPayUrl({
      walletAddress: publicKey.toBase58(),
      baseCurrencyAmount: amount,
      redirectURL:
        typeof window !== "undefined"
          ? `${window.location.origin}/dashboard`
          : undefined,
    });
    window.open(url, "_blank", "noopener,noreferrer");
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
      onClick={onClick}
      disabled={!publicKey}
      className={cls}
      title={publicKey ? "Top up USDC via MoonPay" : "Connect wallet first"}
    >
      <MoonPayMark />
      <span style={{ marginLeft: 8 }}>Top up via MoonPay</span>
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
