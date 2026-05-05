import { ImageResponse } from "next/og";

/**
 * Dynamic Open Graph image for Twitter/Discord/Slack share previews.
 *
 * Next.js renders this at build time and serves it at
 *   https://tide-dca.vercel.app/opengraph-image
 *
 * Atmospheric ocean palette mirrors the landing page hero — near-black
 * background with a cyan tide gradient + glow, oversized monospace tagline,
 * subtle wave lines for depth.
 */

export const runtime = "edge";
export const alt = "Tide — DCA without MEV. Bots blind, retail wins.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "radial-gradient(900px 500px at 80% 20%, rgba(6,182,212,0.18), transparent 60%), radial-gradient(700px 400px at 0% 100%, rgba(6,182,212,0.10), transparent 60%), #07090c",
          color: "#f4f6f8",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top row: brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {/* Tide mark — three stacked curves */}
          <svg width="56" height="56" viewBox="0 0 32 32">
            <defs>
              <linearGradient id="og-tg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#0e7490" />
              </linearGradient>
            </defs>
            <g
              stroke="url(#og-tg)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            >
              <path d="M4 10 Q 10 6, 16 10 T 28 10" opacity="0.4" />
              <path d="M4 16 Q 10 12, 16 16 T 28 16" opacity="0.7" />
              <path d="M4 22 Q 10 18, 16 22 T 28 22" />
            </g>
          </svg>
          <span>Tide</span>
        </div>

        {/* Middle: hero copy */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 92,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 1000,
            }}
          >
            DCA without MEV.
          </div>
          <div
            style={{
              fontSize: 92,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              background: "linear-gradient(180deg, #06b6d4, #0891b2)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Bots blind, retail wins.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#c9cfd6",
              maxWidth: 920,
              lineHeight: 1.4,
              marginTop: 8,
            }}
          >
            Encrypted DCA aggregated across users, settled as one Jupiter swap.
            Slippage drops from ~0.51% to ~0.05%.
          </div>
        </div>

        {/* Bottom strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 28,
            borderTop: "1px solid #1f2733",
            fontSize: 22,
            color: "#8b95a3",
          }}
        >
          <div style={{ display: "flex", gap: 32 }}>
            <span>Solana</span>
            <span style={{ color: "#5a6573" }}>·</span>
            <span>Arcium MPC</span>
            <span style={{ color: "#5a6573" }}>·</span>
            <span>Jupiter</span>
          </div>
          <div style={{ color: "#06b6d4", fontWeight: 500 }}>
            tide-dca.vercel.app
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
