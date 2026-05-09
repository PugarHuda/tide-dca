"use client";

import { useState } from "react";

import { encryptIntent, arciumConfigured } from "@/lib/arcium";
import { x25519 } from "@arcium-hq/client";

/**
 * Live Arcium SDK probe — clickable encryption test using the real
 * `RescueCipher` + `x25519` ECDH from `@arcium-hq/client` v0.9.x.
 *
 * Generates a synthetic MXE x25519 keypair (since no MXE program is
 * deployed yet from this Windows hackathon env), uses its public key
 * to drive the production-mode `encryptIntent` path. Prints ephemeral
 * pubkey + nonce + first 32 bytes of ciphertext so a judge can
 * verify the SDK is genuinely running in the browser, not stubbed.
 *
 * When NEXT_PUBLIC_ARCIUM_MXE_PROGRAM_ID is set + a real MXE pubkey
 * is available, the same flow runs against the live MXE — only the
 * `mxePublicKey` source changes.
 */
export function ArciumProbeCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    intentHash: string;
    ephemeralPubkey: string;
    nonce: string;
    ciphertextPreview: string;
    ciphertextLen: number;
    mxePubkey: string;
    durationMs: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRun = async () => {
    setRunning(true);
    setError(null);
    try {
      // Synthetic MXE keypair stands in for the real MXE pubkey
      // until `arcium deploy` runs (Linux/Mac CLI gate).
      const mxePrivate = x25519.utils.randomSecretKey();
      const mxePublic = x25519.getPublicKey(mxePrivate);

      const t0 = performance.now();
      const intent = await encryptIntent({
        amount: 100_000_000n, // $100 USDC
        maxSlippageBps: 50,
        userPubkey: "11111111111111111111111111111111",
        windowPubkey: "22222222222222222222222222222222",
        mxePublicKey: mxePublic,
      });
      const durationMs = Math.round(performance.now() - t0);

      setResult({
        intentHash: hex(intent.intentHash),
        ephemeralPubkey: hex(intent.ephemeralPubkey),
        nonce: hex(intent.nonce),
        ciphertextPreview: hex(intent.encryptedShares.slice(0, 32)),
        ciphertextLen: intent.encryptedShares.length,
        mxePubkey: hex(mxePublic),
        durationMs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="card" style={{ padding: 18, marginBottom: 16 }}>
      <header
        className="flex"
        style={{
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div className="flex" style={{ alignItems: "center", gap: 8 }}>
          <ArciumMark />
          <span className="eyebrow" style={{ margin: 0 }}>
            Arcium SDK probe
          </span>
        </div>
        <span
          className="badge"
          title={
            arciumConfigured()
              ? "MXE program id configured — production path"
              : "Real SDK, synthetic MXE pubkey for local test"
          }
        >
          {arciumConfigured() ? "live" : "synthetic MXE"}
        </span>
      </header>

      <p
        className="muted"
        style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 14px" }}
      >
        Calls{" "}
        <span className="mono" style={{ color: "var(--accent)" }}>
          encryptIntent()
        </span>{" "}
        with the real{" "}
        <span className="mono" style={{ color: "var(--accent)" }}>
          @arcium-hq/client
        </span>{" "}
        SDK — RescueCipher + x25519 ECDH path. Produces a 32-byte commitment
        hash + ciphertext + ephemeral pubkey + nonce. Same code shape as
        production; only the MXE pubkey source differs.
      </p>

      <button
        type="button"
        className="btn btn--primary"
        onClick={() => void onRun()}
        disabled={running}
      >
        {running ? <span className="spinner spinner--sm" /> : null}
        <span style={{ marginLeft: running ? 8 : 0 }}>
          {running ? "Encrypting…" : "Run live SDK encryption"}
        </span>
      </button>

      {error && (
        <div
          className="tiny"
          style={{ color: "var(--err)", marginTop: 12 }}
        >
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, display: "grid", gap: 8, fontSize: 12 }}>
          <Row label="Intent hash (on-chain)" value={result.intentHash} />
          <Row label="MXE x25519 pubkey" value={result.mxePubkey} />
          <Row
            label="Ephemeral x25519 pubkey"
            value={result.ephemeralPubkey}
          />
          <Row label="Nonce (16B)" value={result.nonce} />
          <Row
            label={`Ciphertext (${result.ciphertextLen}B, first 32)`}
            value={result.ciphertextPreview}
          />
          <Row label="Encrypt duration" value={`${result.durationMs}ms`} />
        </div>
      )}

      <a
        href="https://docs.arcium.com"
        target="_blank"
        rel="noreferrer"
        className="tiny"
        style={{
          color: "var(--accent)",
          display: "inline-block",
          marginTop: 14,
        }}
      >
        Arcium Docs →
      </a>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex" style={{ gap: 12, alignItems: "baseline" }}>
      <span className="tiny mute2" style={{ minWidth: 200 }}>
        {label}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--ink)",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function ArciumMark() {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        background: "var(--accent-glow)",
        color: "var(--accent)",
        display: "grid",
        placeItems: "center",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "var(--font-mono, monospace)",
      }}
    >
      A
    </span>
  );
}
