import { DcaSetupForm } from "@/components/dca-setup-form";

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-widest text-cyan-400">
          Setup Recurring DCA
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Configure your hidden-liquidity DCA
        </h1>
        <p className="mt-2 text-zinc-400">
          Set your recurring buy. Your specific amount stays encrypted.
          Aggregate execution prevents MEV.
        </p>
      </header>

      <DcaSetupForm />

      <section className="mt-10 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-5 text-sm text-zinc-400">
        <h3 className="font-semibold text-zinc-200">Privacy Guarantees</h3>
        <ul className="space-y-1 text-xs">
          <li>✓ Your specific amount is encrypted as MPC shares (Arcium)</li>
          <li>✓ Public on-chain: only the aggregate (total + count)</li>
          <li>✓ MEV bots see encrypted ciphertext, can't sandwich</li>
          <li>
            ✓ Allocations distributed pro-rata, your individual share stays hidden
          </li>
        </ul>
      </section>
    </main>
  );
}
