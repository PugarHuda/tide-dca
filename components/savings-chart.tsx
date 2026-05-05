"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useWindowHistory } from "@/lib/hooks";

interface DataPoint {
  /** Window number (0-indexed). */
  window: number;
  /** Cumulative cost via Tide pool ($USD). */
  tide: number;
  /** Cumulative cost via standalone Jupiter DCA ($USD). */
  standalone: number;
  /** Cumulative savings (standalone - tide). */
  saved: number;
}

const SOLO_SLIPPAGE_BPS = 51;

/**
 * Cumulative cost: Tide vs solo DCA. Hydrated from real settled windows
 * via useWindowHistory(); falls back to an empty state when no windows
 * have settled yet.
 */
export function SavingsChart() {
  const { windows, loading } = useWindowHistory();

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">Cumulative cost · Tide vs solo</span>
        {windows.length > 0 && (
          <span className="badge badge--accent">
            {windows.length} settled
          </span>
        )}
      </div>

      {loading ? (
        <ChartShell>
          <SkeletonChart />
        </ChartShell>
      ) : windows.length === 0 ? (
        <EmptyChart />
      ) : (
        <ChartLive data={buildSeries(windows)} />
      )}
    </div>
  );
}

function ChartShell({ children }: { children: React.ReactNode }) {
  return <div style={{ height: 300, position: "relative" }}>{children}</div>;
}

function SkeletonChart() {
  return (
    <div
      style={{
        height: "100%",
        background:
          "linear-gradient(180deg, rgba(6,182,212,0.04), transparent 60%)",
        borderRadius: "var(--r)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <span className="tiny mute2 mono">loading window history…</span>
    </div>
  );
}

function EmptyChart() {
  return (
    <div
      style={{
        minHeight: 240,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        textAlign: "center",
        padding: "32px 16px",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 14,
          color: "var(--text-2)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        No settled windows yet
      </div>
      <p
        className="muted"
        style={{
          margin: 0,
          maxWidth: 380,
          fontSize: 13.5,
          lineHeight: 1.55,
        }}
      >
        The chart hydrates as windows settle on chain. Once execute_swap fires
        on the first window, this view starts plotting cumulative cost vs a
        solo DCA reference at ~0.51% slippage.
      </p>
    </div>
  );
}

function ChartLive({ data }: { data: DataPoint[] }) {
  const last = data[data.length - 1];
  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorTide" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorStandalone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2733" />
          <XAxis
            dataKey="window"
            stroke="#5a6573"
            label={{
              value: "Window #",
              position: "bottom",
              offset: -5,
              fill: "#5a6573",
            }}
          />
          <YAxis
            stroke="#5a6573"
            tickFormatter={(value: number) => `$${value.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-3)",
              border: "1px solid var(--line-2)",
              borderRadius: 8,
              color: "var(--text-0)",
              fontSize: 12,
            }}
            formatter={(value: number) => `$${value.toFixed(2)}`}
          />
          <Legend
            wrapperStyle={{ paddingTop: 10 }}
            formatter={(value: string) => (
              <span style={{ color: "var(--text-2)", fontSize: 12 }}>
                {value}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="standalone"
            name="Solo DCA reference"
            stroke="#f59e0b"
            fillOpacity={1}
            fill="url(#colorStandalone)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="tide"
            name="Tide pool"
            stroke="#06b6d4"
            fillOpacity={1}
            fill="url(#colorTide)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          paddingTop: 14,
          marginTop: 14,
          borderTop: "1px solid var(--line)",
          fontSize: 12,
        }}
      >
        <div>
          <div className="tiny mute2">Cost via Tide</div>
          <div className="mono" style={{ color: "var(--accent)" }}>
            ${last.tide.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="tiny mute2">Cost solo (reference)</div>
          <div className="mono" style={{ color: "var(--warn)" }}>
            ${last.standalone.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="tiny mute2">You saved</div>
          <div
            className="mono"
            style={{ color: "var(--good)", fontWeight: 600 }}
          >
            ${last.saved.toFixed(2)}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Build cumulative cost series from settled windows.
 *
 * For each settled window:
 *   - usdc spent on this window = window.totalCommittedUsdc (in lamports → $)
 *   - tide cost increment = usdc × effectiveSlippageBps
 *   - solo cost increment = usdc × SOLO_SLIPPAGE_BPS (reference baseline)
 *
 * Cumulate across windows in order.
 */
function buildSeries(windows: import("@/lib/types").Window[]): DataPoint[] {
  const sorted = [...windows].sort((a, b) =>
    a.windowNumber < b.windowNumber ? -1 : 1,
  );
  let cumTide = 0;
  let cumSolo = 0;
  return sorted.map((w) => {
    const usdcDollars = Number(w.totalCommittedUsdc) / 1_000_000;
    const tideSlip = usdcDollars * (w.effectiveSlippageBps / 10_000);
    const soloSlip = usdcDollars * (SOLO_SLIPPAGE_BPS / 10_000);
    cumTide += usdcDollars + tideSlip;
    cumSolo += usdcDollars + soloSlip;
    return {
      window: Number(w.windowNumber),
      tide: parseFloat(cumTide.toFixed(2)),
      standalone: parseFloat(cumSolo.toFixed(2)),
      saved: parseFloat((cumSolo - cumTide).toFixed(2)),
    };
  });
}
