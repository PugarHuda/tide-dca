"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { usePrivy } from "@privy-io/react-auth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function ConnectButton() {
  if (!PRIVY_APP_ID) return <WalletMultiButton />;
  return <PrivyConnect />;
}

function PrivyConnect() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return (
      <button
        disabled
        className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-500"
      >
        Loading…
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={() => login()}
        className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-cyan-400"
      >
        Connect
      </button>
    );
  }

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
