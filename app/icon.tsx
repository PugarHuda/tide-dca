import { ImageResponse } from "next/og";

/**
 * Dynamic favicon generated from the TideMark SVG.
 *
 * Next.js convention: `app/icon.tsx` exports an ImageResponse and the
 * framework registers it as the document <link rel="icon">. Auto-served at
 * /icon and referenced from <head> in every page.
 */

export const runtime = "edge";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#07090c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg viewBox="0 0 32 32" width="48" height="48" fill="none">
          <defs>
            <linearGradient id="icon-tg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#0e7490" />
            </linearGradient>
          </defs>
          <g
            stroke="url(#icon-tg)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M4 10 Q 10 6, 16 10 T 28 10" opacity="0.4" />
            <path d="M4 16 Q 10 12, 16 16 T 28 16" opacity="0.7" />
            <path d="M4 22 Q 10 18, 16 22 T 28 22" />
          </g>
        </svg>
      </div>
    ),
    { ...size },
  );
}
