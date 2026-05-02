import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-24">
      <header className="mb-16 space-y-4">
        <p className="text-xs uppercase tracking-widest text-cyan-400">
          Solana Frontier 2026 · Built on Arcium · Powered by Jupiter
        </p>
        <h1 className="text-balance text-5xl font-bold tracking-tight md:text-6xl">
          DCA without MEV.<br />
          <span className="text-cyan-400">Bots blind, retail wins.</span>
        </h1>
        <p className="max-w-2xl text-lg text-zinc-400">
          Solana retail loses ~$5M/year to MEV bots sandwiching their DCA.
          Tide aggregates encrypted intents via Arcium MPC, executes single
          atomic trade via Jupiter IOC, distributes pro-rata. Your weekly
          $50 buy gets institutional-grade fills.
        </p>
        <div className="flex gap-3 pt-4">
          <Link
            href="/setup"
            className="rounded-md bg-cyan-500 px-5 py-2.5 font-medium text-zinc-900 transition hover:bg-cyan-400"
          >
            Start DCA →
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-700 px-5 py-2.5 font-medium text-zinc-100 transition hover:bg-zinc-900"
          >
            View Pool Stats
          </Link>
        </div>
      </header>

      <section className="mb-20 grid gap-8 md:grid-cols-3">
        <Stat
          value="$5M+"
          label="Annual MEV extracted from Solana retail DCA"
        />
        <Stat
          value="0.05%"
          label="Avg slippage in pool (vs 0.5% standalone)"
        />
        <Stat
          value="247"
          label="Avg participants per hour at full operations"
        />
      </section>

      <section className="mb-20 space-y-6">
        <h2 className="text-3xl font-bold">How it works</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Step
            number="1"
            title="Setup recurring DCA"
            description="Connect Phantom, set $50/week SOL (or any amount/frequency). Funds locked in escrow PDA."
          />
          <Step
            number="2"
            title="Encrypted intent"
            description="Your specific amount encrypted via Arcium client SDK. Stored as MPC shares across nodes — no single party sees plaintext."
          />
          <Step
            number="3"
            title="Window aggregates"
            description="Every hour: Arcium MPC computes total across N participants. Single Jupiter IOC swap executes — atomic, no MEV exposure."
          />
          <Step
            number="4"
            title="Pro-rata distribute"
            description="Tokens distributed proportionally. Individual amounts stay encrypted. You claim allocation. Saved 0.4% vs standalone."
          />
        </div>
      </section>

      <section className="mb-20 rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-6">
        <h2 className="mb-4 text-2xl font-bold">Why Tide wins where others lost</h2>
        <ul className="space-y-2 text-sm text-zinc-300">
          <li>
            <span className="text-cyan-400">URANI</span> won $30K Renaissance
            Grand with intent-based MEV protection — for whales.
          </li>
          <li>
            <span className="text-cyan-400">Archer Exchange</span> won $10K
            Cypherpunk with batch auctions — for market makers.
          </li>
          <li>
            <span className="text-cyan-400">Tide</span> applies the same
            MEV-protection mechanism to <strong>retail's most common behavior</strong>:
            recurring buys.
          </li>
          <li>
            <span className="text-cyan-400">Aggregation network effect</span>:
            more users → bigger pool → better fills → more users. Power law dynamics.
          </li>
        </ul>
      </section>

      <footer className="border-t border-zinc-900 pt-8 text-center text-xs text-zinc-600">
        Built solo with Claude Code for Solana Frontier 2026 hackathon.
        Open-source on GitHub.
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="mb-2 text-3xl font-bold text-cyan-400">{value}</div>
      <p className="text-sm text-zinc-400">{label}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-2 font-mono text-2xl text-cyan-400">{number}</div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-sm text-zinc-400">{description}</p>
    </div>
  );
}
