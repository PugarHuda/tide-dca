"use client";

import { Component, type ReactNode } from "react";

/**
 * Top-level React error boundary so a single component throw (e.g. a stale
 * Borsh decoder hitting an unexpected account layout, an undefined
 * publicKey escaping a hook guard) doesn't blank the entire page.
 *
 * Class component is the only way to catch render-phase errors via
 * `componentDidCatch` + `getDerivedStateFromError`; hooks have no
 * equivalent. Mounted in app/layout.tsx so it wraps every route.
 *
 * Fallback UI:
 *   - Tide-branded panel (matches the design system, not React's stark
 *     red default)
 *   - "Reload" CTA that clears the bad state by force-refreshing
 *   - Captured error message + first stack frame for debugging
 *   - Link back to home in case the broken state is route-specific
 */
type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface in console so the diff between "user sees friendly
    // fallback" and "I need to debug this" is one DevTools tab.
    console.error("[Tide] uncaught render error:", error);
    console.error("[Tide] component stack:", info.componentStack);
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="page page--narrow" style={{ paddingTop: 80 }}>
        <section className="card" style={{ padding: 28, textAlign: "left" }}>
          <span className="eyebrow" style={{ color: "var(--err, #ef4444)" }}>
            Something broke
          </span>
          <h1 className="page__h1" style={{ marginTop: 8, fontSize: 26 }}>
            We hit an unexpected error
          </h1>
          <p className="muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
            A page-level component threw while rendering. Your wallet
            connection and on-chain state are unaffected — this is just a UI
            glitch. Reload to recover, or head back to the home page.
          </p>

          <pre
            className="mono"
            style={{
              marginTop: 18,
              padding: 14,
              borderRadius: 8,
              background: "var(--bg-1)",
              border: "1px solid var(--line)",
              fontSize: 12,
              color: "var(--text-2)",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {this.state.error.name}: {this.state.error.message}
          </pre>

          <div
            className="flex"
            style={{ gap: 10, marginTop: 20, flexWrap: "wrap" }}
          >
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={this.handleReload}
            >
              Reload page
            </button>
            <a href="/" className="btn btn--ghost btn--sm">
              Back to home
            </a>
          </div>

          <p
            className="tiny mute2"
            style={{ marginTop: 22, lineHeight: 1.5 }}
          >
            If this keeps happening, open DevTools → Console — the full stack
            is logged there. Filing a bug at the repo with that stack is the
            fastest way to a fix.
          </p>
        </section>
      </main>
    );
  }
}
