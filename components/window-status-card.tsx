"use client";

import { useEffect, useState } from "react";
import { formatUsdc } from "@/lib/utils";

interface WindowStatusProps {
  /** Total USDC committed in current window (encrypted aggregate). */
  totalCommitted: bigint;
  /** Number of unique participants. */
  participantCount: number;
  /** Window expiry timestamp (Unix seconds). */
  endTs: number;
  /** Window status: 0=Open, 1=Aggregating, 2=Distributed. */
  status: 0 | 1 | 2 | 3;
}

/**
 * Real-time window status with countdown.
 */
export function WindowStatusCard({
  totalCommitted,
  participantCount,
  endTs,
  status,
}: WindowStatusProps) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = Math.max(0, endTs - now);
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const statusBadge = {
    0: { label: "Open for commits", color: "text-emerald-400 bg-emerald-950/30" },
    1: { label: "Aggregating (MPC)", color: "text-amber-400 bg-amber-950/30" },
    2: { label: "Distributed", color: "text-cyan-400 bg-cyan-950/30" },
    3: { label: "Failed", color: "text-rose-400 bg-rose-950/30" },
  }[status];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Current Window</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs ${statusBadge.color}`}
        >
          ● {statusBadge.label}
        </span>
      </div>

      <div className="mb-5 text-center">
        <div className="text-xs uppercase tracking-widest text-zinc-500">
          {status === 0 ? "Closes in" : "Closed"}
        </div>
        <div className="font-mono text-4xl font-bold tabular-nums text-zinc-100">
          {hours > 0 && (
            <>
              <span className="text-zinc-300">{hours}</span>
              <span className="text-zinc-600">h</span>
              <span className="ml-2"> </span>
            </>
          )}
          <span className="text-zinc-300">{minutes.toString().padStart(2, "0")}</span>
          <span className="text-zinc-600">m</span>
          <span className="ml-2"> </span>
          <span className="text-cyan-400">{seconds.toString().padStart(2, "0")}</span>
          <span className="text-zinc-600">s</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4 text-sm">
        <div>
          <div className="text-zinc-500">Pool size (encrypted aggregate)</div>
          <div className="mt-1 font-mono text-2xl text-cyan-400">
            {formatUsdc(totalCommitted)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">Participants</div>
          <div className="mt-1 font-mono text-2xl text-zinc-100">
            {participantCount}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        🔒 Individual amounts encrypted via Arcium. Bots see only the aggregate.
      </p>
    </div>
  );
}
