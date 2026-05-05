"use client";

/**
 * Dual-entry connect button:
 *   - WalletMultiButton (left)   — Phantom/Solflare/Backpack via Wallet Standard
 *   - "Sign in" (right)          — Privy email/social login → embedded Solana wallet
 *
 * Both paths feed into useTideWallet downstream, so UI code reads a single
 * "are we connected?" state regardless of which entry was used.
 *
 * Privy is rendered only when NEXT_PUBLIC_PRIVY_APP_ID is set; without it the
 * button is wallet-adapter only. This matches lib/providers.tsx which skips
 * mounting PrivyProvider in the same condition (so usePrivy() is safe to call
 * here whenever this component renders DualConnect).
 */

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePrivy } from "@privy-io/react-auth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function ConnectButton() {
  if (!PRIVY_APP_ID) return <WalletMultiButton />;
  return <DualConnect />;
}

function DualConnect() {
  const { connected } = useWallet();
  const { ready, authenticated, user, login, logout } = usePrivy();

  // Wallet-adapter wins when the user explicitly connected an external wallet.
  // Hides the Privy entry to avoid double-identity in the nav.
  if (connected) return <WalletMultiButton />;

  if (authenticated) {
    const addr = user?.wallet?.address;
    const label =
      user?.email?.address ??
      (addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "Connected");
    return (
      <button
        onClick={() => logout()}
        className="rounded-md border border-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-700"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <WalletMultiButton />
      <button
        onClick={() => login()}
        disabled={!ready}
        className="rounded-md border border-cyan-500/40 px-3 py-2 text-sm text-cyan-300 transition hover:border-cyan-500 hover:text-cyan-200 disabled:opacity-50"
      >
        Sign in
      </button>
    </div>
  );
}
