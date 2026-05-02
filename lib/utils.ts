import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format USDC amount (6 decimals) for display. */
export function formatUsdc(lamports: bigint | number): string {
  const value = typeof lamports === "bigint" ? lamports : BigInt(lamports);
  const whole = value / 1_000_000n;
  const fraction = value % 1_000_000n;
  return `$${whole.toLocaleString()}.${fraction
    .toString()
    .padStart(6, "0")
    .slice(0, 2)}`;
}

/** Format SOL amount (9 decimals) for display. */
export function formatSol(lamports: bigint | number, decimals = 4): string {
  const value = typeof lamports === "bigint" ? Number(lamports) : lamports;
  return `${(value / 1_000_000_000).toFixed(decimals)} SOL`;
}

/** Format basis points as percentage. */
export function bpsToPct(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/** Format wallet address as truncated. */
export function shortAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

/** Format Unix timestamp (seconds) as relative time. */
export function relativeTime(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 0) {
    const future = Math.abs(diff);
    if (future < 60) return `in ${future}s`;
    if (future < 3600) return `in ${Math.floor(future / 60)}m`;
    if (future < 86400) return `in ${Math.floor(future / 3600)}h`;
    return `in ${Math.floor(future / 86400)}d`;
  }
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Calculate savings vs standalone DCA. */
export function calculateSavings(
  poolSlippageBps: number,
  standaloneSlippageBps: number,
  amountUsdc: bigint,
): bigint {
  const slippageDiffBps = standaloneSlippageBps - poolSlippageBps;
  return (amountUsdc * BigInt(slippageDiffBps)) / 10_000n;
}
