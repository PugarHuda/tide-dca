"use client";

import { useEffect, useState } from "react";
import { formatUsdc } from "@/lib/utils";
import { arciumConfigured } from "@/lib/arcium";

interface WindowStatusProps {
  totalCommitted: bigint;
  participantCount: number;
  endTs: number;
  status: 0 | 1 | 2 | 3;
}

/**
 * Real-time window status with countdown. Restyled with the design's class
 * system; behavior unchanged.
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
  const expired = remaining === 0;

  const statusInfo = {
    0: { label: "Open for commits", badge: "badge--good", live: true },
    1: { label: "Aggregating (MPC)", badge: "badge--warn", live: true },
    2: { label: "Distributed", badge: "badge--accent", live: false },
    3: { label: "Failed", badge: "badge--warn", live: false },
  }[status];

  // Caption above the countdown reflects what state the window is in
  // AND what the next action is, so users don't see "Closes in 00m 00s"
  // sitting indefinitely without context.
  const captionLabel =
    status === 0 && !expired
      ? "Closes in"
      : status === 0 && expired
        ? "Awaiting trigger_aggregate"
        : status === 1
          ? "MPC compute in flight"
          : status === 2
            ? "Distributed — ready to claim"
            : status === 3
              ? "Failed — refund available"
              : "Closed";

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">Current window</span>
        <span className={`badge ${statusInfo.badge}`}>
          {statusInfo.live && <span className="dot dot--live" />}
          {statusInfo.label}
        </span>
      </div>

      <div style={{ textAlign: "center", margin: "8px 0 22px" }}>
        <div
          className="tiny mute2"
          style={{
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {captionLabel}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--text-0)",
            marginTop: 6,
          }}
        >
          {hours > 0 && (
            <>
              <span>{hours}</span>
              <span style={{ color: "var(--text-3)", margin: "0 4px" }}>
                h
              </span>
            </>
          )}
          <span>{String(minutes).padStart(2, "0")}</span>
          <span style={{ color: "var(--text-3)", margin: "0 4px" }}>m</span>
          <span style={{ color: "var(--accent)" }}>
            {String(seconds).padStart(2, "0")}
          </span>
          <span style={{ color: "var(--text-3)", margin: "0 4px" }}>s</span>
        </div>
      </div>

      <div className="tideline" style={{ marginBottom: 18 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <div>
          <div className="tiny mute2">Pool size (encrypted aggregate)</div>
          <div
            className="mono"
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "var(--accent)",
              marginTop: 4,
            }}
          >
            {formatUsdc(totalCommitted)}
          </div>
        </div>
        <div>
          <div className="tiny mute2">Participants</div>
          <div
            className="mono"
            style={{
              fontSize: 22,
              fontWeight: 500,
              marginTop: 4,
            }}
          >
            {participantCount}
          </div>
        </div>
      </div>

      <p
        className="tiny mute2"
        style={{ marginTop: 16, marginBottom: 0, lineHeight: 1.5 }}
      >
        {arciumConfigured() ? (
          <>Individual amounts encrypted via Arcium MPC. Bots see only the aggregate.</>
        ) : (
          <>
            <strong style={{ color: "var(--warn)" }}>Commitment-fallback mode</strong>
            : intent committed via SHA-256 hash. MXE deploy enables real MPC privacy.
          </>
        )}
      </p>
    </div>
  );
}
