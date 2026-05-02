import { NextResponse } from "next/server";

/**
 * GET /api/pool/stats
 *
 * Returns pool aggregate statistics for landing page + dashboard.
 *
 * TODO: replace stub with real on-chain fetch via @coral-xyz/anchor.
 */

export interface PoolStatsResponse {
  totalVolumeUsdc: string; // bigint serialized
  totalParticipants: number;
  totalSavingsUsdc: string;
  averageSlippageBps: number;
  averageStandaloneSlippageBps: number;
  windowsCompleted: number;
  activeParticipants24h: number;
  volume24hUsdc: string;
  lastUpdated: number; // Unix seconds
}

export const revalidate = 30; // Cache for 30 seconds

export async function GET() {
  // STUB: replace with real on-chain fetch
  const stats: PoolStatsResponse = {
    totalVolumeUsdc: "4800000000000",
    totalParticipants: 1284,
    totalSavingsUsdc: "22400000000",
    averageSlippageBps: 5,
    averageStandaloneSlippageBps: 50,
    windowsCompleted: 1248,
    activeParticipants24h: 247,
    volume24hUsdc: "280000000000",
    lastUpdated: Math.floor(Date.now() / 1000),
  };

  return NextResponse.json(stats, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
