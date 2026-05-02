/**
 * Tide shared TypeScript types.
 *
 * Mirrors Anchor account structures di programs/tide/src/state.rs.
 */

import type { PublicKey } from "@solana/web3.js";

export interface Pool {
  authority: PublicKey;
  inputMint: PublicKey;
  targetMint: PublicKey;
  windowDurationSeconds: bigint;
  minPoolSizeUsdc: bigint;
  feeBps: number;
  totalVolumeProcessed: bigint;
  totalSavingsBpsEstimated: bigint;
  activeWindow: PublicKey;
  windowCounter: bigint;
  bump: number;
}

export interface DcaPosition {
  owner: PublicKey;
  pool: PublicKey;
  amountPerWindow: bigint;
  maxSlippageBps: number;
  totalDeposited: bigint;
  totalAcquired: bigint;
  active: boolean;
  createdTs: bigint;
  lastWindow: bigint;
  bump: number;
}

export interface Window {
  pool: PublicKey;
  windowNumber: bigint;
  startTs: bigint;
  endTs: bigint;
  status: 0 | 1 | 2 | 3;
  intentCount: number;
  totalCommittedUsdc: bigint;
  aggregateResultHash: Uint8Array;
  tokensAcquired: bigint;
  effectiveSlippageBps: number;
  bump: number;
}

export interface Intent {
  owner: PublicKey;
  window: PublicKey;
  encryptedIntentHash: Uint8Array;
  amount: bigint;
  allocatedAmount: bigint;
  claimed: boolean;
  bump: number;
}

/** UI-friendly pool stats for display. */
export interface PoolStats {
  totalVolume: bigint;
  totalParticipants: number;
  averageSlippageBps: number;
  averageStandaloneSlippageBps: number;
  totalSavings: bigint;
  windowsCompleted: number;
}

/** UI-friendly user dashboard data. */
export interface UserDashboard {
  position: DcaPosition | null;
  totalSaved: bigint;
  windowsParticipated: number;
  averageSlippage: number;
  nextWindow: number; // unix seconds
  pendingClaim: bigint;
}
