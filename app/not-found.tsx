import Link from "next/link";

import { TideMark } from "@/components/tide-mark";

export default function NotFound() {
  return (
    <main className="page page--narrow" style={{ textAlign: "center", paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <TideMark size={48} />
      </div>
      <span className="eyebrow">404</span>
      <h1 className="page__h1" style={{ marginTop: 8 }}>
        Out of bounds
      </h1>
      <p className="page__sub">
        That route isn't part of the pool. Try the dashboard or set up a
        recurring buy.
      </p>
      <div
        className="flex"
        style={{ justifyContent: "center", gap: 12, marginTop: 8 }}
      >
        <Link href="/" className="btn btn--primary">
          Back home
        </Link>
        <Link href="/setup" className="btn btn--ghost">
          Set up DCA
        </Link>
      </div>
    </main>
  );
}
