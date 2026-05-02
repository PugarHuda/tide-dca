import { SavingsChart } from "@/components/savings-chart";
import { WindowStatusCard } from "@/components/window-status-card";
import { formatUsdc, formatSol, bpsToPct } from "@/lib/utils";

/**
 * User dashboard — shows DCA stats + savings tracker + current window.
 *
 * TODO when on-chain:
 * - Fetch DcaPosition account for connected wallet
 * - Fetch Window account via /api/window/current
 * - Fetch Pool stats via /api/pool/stats
 * - Compute real savings vs Jupiter direct from history
 */

export default async function DashboardPage() {
  // Stub data — replace with on-chain fetch
  const userStats = {
    totalDeposited: 1_300_000_000n,
    totalAcquired: 12_990_000_000n,
    totalSaved: 6_240_000n,
    windowsParticipated: 26,
    averagePoolSlippage: 5,
    averageStandaloneSlippage: 50,
    pendingClaim: 198_000_000n,
  };

  const windowState = {
    totalCommitted: 12_400_000_000n,
    participantCount: 247,
    endTs: Math.floor(Date.now() / 1000) + 1800, // 30 min from now
    status: 0 as const,
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-cyan-400">
            Your Tide Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Saved {formatUsdc(userStats.totalSaved)} so far
          </h1>
        </div>
        <a
          href="/setup"
          className="rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
        >
          Adjust DCA
        </a>
      </header>

      <section className="mb-10 grid gap-4 md:grid-cols-4">
        <Card label="Total deposited" value={formatUsdc(userStats.totalDeposited)} />
        <Card
          label="Total acquired"
          value={formatSol(userStats.totalAcquired)}
        />
        <Card
          label="Avg slippage"
          value={bpsToPct(userStats.averagePoolSlippage)}
          subtext={`vs ${bpsToPct(userStats.averageStandaloneSlippage)} standalone`}
        />
        <Card
          label="Windows participated"
          value={userStats.windowsParticipated.toString()}
        />
      </section>

      {userStats.pendingClaim > 0n && (
        <section className="mb-10 flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-5">
          <div>
            <h3 className="font-semibold">Pending allocation</h3>
            <p className="text-sm text-zinc-400">
              {formatSol(userStats.pendingClaim)} ready to claim from last window
            </p>
          </div>
          <button className="rounded-md bg-cyan-500 px-4 py-2 font-medium text-zinc-900 transition hover:bg-cyan-400">
            Claim
          </button>
        </section>
      )}

      <section className="mb-10 grid gap-6 lg:grid-cols-2">
        <WindowStatusCard
          totalCommitted={windowState.totalCommitted}
          participantCount={windowState.participantCount}
          endTs={windowState.endTs}
          status={windowState.status}
        />
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          <h3 className="mb-4 font-semibold">Your Position</h3>
          <dl className="space-y-3 text-sm">
            <Row label="DCA amount per window" value={formatUsdc(50_000_000n)} />
            <Row label="Window duration" value="1 hour" />
            <Row label="Max slippage" value="1.0%" />
            <Row label="Status" value={<span className="text-emerald-400">Active</span>} />
            <Row
              label="Next contribution"
              value={`in ${Math.floor((windowState.endTs - Math.floor(Date.now() / 1000)) / 60)}m`}
            />
          </dl>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">Cumulative Savings</h2>
        <SavingsChart />
      </section>

      <p className="mt-10 text-center text-xs text-zinc-600">
        Stub data shown. Replace with on-chain fetch via /api/pool/stats and /api/window/current.
      </p>
    </main>
  );
}

function Card({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-2xl">{value}</div>
      {subtext && <div className="mt-1 text-xs text-zinc-500">{subtext}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-zinc-800 pb-2 last:border-0">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
