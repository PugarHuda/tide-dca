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

interface DataPoint {
  /** Window number / week index. */
  week: number;
  /** Cumulative cost via Tide pool ($USD). */
  tide: number;
  /** Cumulative cost via standalone Jupiter DCA ($USD). */
  standalone: number;
  /** Cumulative savings (standalone - tide). */
  saved: number;
}

/**
 * Cumulative savings chart — shows Tide pool vs standalone Jupiter DCA over time.
 *
 * Data source TODO: replace with real on-chain history fetch via Helius DAS API.
 */
export function SavingsChart({ data }: { data?: DataPoint[] }) {
  // Stub data: 26 weeks ($50/week DCA, 0.5% standalone slippage vs 0.05% pool)
  const seedData: DataPoint[] =
    data ??
    Array.from({ length: 26 }, (_, i) => {
      const week = i + 1;
      const standaloneSlippage = 0.005;
      const poolSlippage = 0.0005;
      const baseCost = 50 * week;
      const standaloneTotal = baseCost * (1 + standaloneSlippage);
      const tideTotal = baseCost * (1 + poolSlippage);
      return {
        week,
        tide: parseFloat(tideTotal.toFixed(2)),
        standalone: parseFloat(standaloneTotal.toFixed(2)),
        saved: parseFloat((standaloneTotal - tideTotal).toFixed(2)),
      };
    });

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="mb-4 font-semibold">Cumulative Cost: Tide vs Standalone</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={seedData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="colorTide" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorStandalone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="week"
            stroke="#71717a"
            label={{ value: "Week", position: "bottom", offset: -5, fill: "#71717a" }}
          />
          <YAxis
            stroke="#71717a"
            tickFormatter={(value: number) => `$${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "0.5rem",
              color: "#f4f4f5",
            }}
            formatter={(value: number) => `$${value.toFixed(2)}`}
          />
          <Legend
            wrapperStyle={{ paddingTop: "10px" }}
            formatter={(value: string) => (
              <span style={{ color: "#a1a1aa" }}>{value}</span>
            )}
          />
          <Area
            type="monotone"
            dataKey="standalone"
            name="Standalone Jupiter DCA"
            stroke="#f43f5e"
            fillOpacity={1}
            fill="url(#colorStandalone)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="tide"
            name="Tide Pool"
            stroke="#06b6d4"
            fillOpacity={1}
            fill="url(#colorTide)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-3 text-xs">
        <div>
          <div className="text-zinc-500">Total cost (Tide)</div>
          <div className="font-mono text-cyan-400">
            ${seedData[seedData.length - 1].tide.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">Total cost (standalone)</div>
          <div className="font-mono text-rose-400">
            ${seedData[seedData.length - 1].standalone.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">You saved</div>
          <div className="font-mono text-emerald-400">
            ${seedData[seedData.length - 1].saved.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
