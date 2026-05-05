"use client";

/**
 * Default connect button — uses @solana/wallet-adapter's WalletMultiButton.
 *
 * History: we tried using Privy's connect modal as the primary surface, but
 * Privy detects wallets through window.ethereum / Privy SDK internals and
 * loses to extension-conflict noise (MetaMask, Backpack, evmAsk all fight
 * for window.ethereum, leaving Phantom undetected → "download Phantom"
 * fallback even when Phantom is installed).
 *
 * Wallet Standard (which @solana/wallet-adapter uses) reads from a separate
 * window.navigator.wallets registry and isn't affected by the window.ethereum
 * wars, so Phantom/Solflare/Backpack-Solana all detect cleanly.
 *
 * PrivyProvider stays mounted in lib/providers.tsx so the embedded-wallet
 * bridge keeps working — email/social login is a follow-up that lives in
 * its own UI surface, not this nav button.
 */

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function ConnectButton() {
  return <WalletMultiButton />;
}
