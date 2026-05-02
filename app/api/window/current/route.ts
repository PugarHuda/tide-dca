import { NextResponse } from "next/server";

/**
 * GET /api/window/current
 *
 * Returns current active window state for real-time dashboard.
 * Cached briefly (5s) — for true real-time, frontend should subscribe to
 * Window account changes via Helius WebSocket.
 *
 * TODO: replace stub with real on-chain fetch.
 */

export interface CurrentWindowResponse {
  windowPubkey: string;
  windowNumber: number;
  startTs: number;
  endTs: number;
  status: 0 | 1 | 2 | 3; // Open | Aggregating | Distributed | Failed
  intentCount: number;
  totalCommittedUsdc: string;
  /** Available only after distribute (status === 2 or 3). */
  tokensAcquired?: string;
  effectiveSlippageBps?: number;
}

export const revalidate = 5;

export async function GET() {
  const now = Math.floor(Date.now() / 1000);
  const windowDuration = 3600;
  const windowStart = Math.floor(now / windowDuration) * windowDuration;
  const windowEnd = windowStart + windowDuration;

  // STUB
  const window: CurrentWindowResponse = {
    windowPubkey: "WindowPubKeyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    windowNumber: Math.floor(now / windowDuration),
    startTs: windowStart,
    endTs: windowEnd,
    status: 0,
    intentCount: 247,
    totalCommittedUsdc: "12400000000",
  };

  return NextResponse.json(window, {
    headers: {
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
    },
  });
}
