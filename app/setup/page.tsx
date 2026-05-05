import { DcaSetupForm } from "@/components/dca-setup-form";

export default function SetupPage() {
  return (
    <main className="page page--narrow">
      <div style={{ marginBottom: 36 }}>
        <span className="eyebrow">Setup</span>
        <h1 className="page__h1" style={{ marginTop: 8 }}>
          Configure your DCA position
        </h1>
        <p className="page__sub">
          Encrypted client-side. Pause or withdraw anytime.
        </p>
      </div>

      <DcaSetupForm />

      <section className="card card--quiet" style={{ marginTop: 28 }}>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--text-3)",
            margin: 0,
            marginBottom: 14,
          }}
        >
          Privacy guarantees
        </h3>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 13.5,
            color: "var(--text-1)",
          }}
        >
          <li>
            <span style={{ color: "var(--accent)", marginRight: 8 }}>✓</span>
            Your specific amount is encrypted as MPC shares via Arcium
          </li>
          <li>
            <span style={{ color: "var(--accent)", marginRight: 8 }}>✓</span>
            Public on-chain: only the aggregate (total + count)
          </li>
          <li>
            <span style={{ color: "var(--accent)", marginRight: 8 }}>✓</span>
            MEV bots see encrypted ciphertext, can't sandwich
          </li>
          <li>
            <span style={{ color: "var(--accent)", marginRight: 8 }}>✓</span>
            Allocations distributed pro-rata; individual share stays hidden
          </li>
        </ul>
      </section>
    </main>
  );
}
