/**
 * Tide brand mark — three stacked tide curves with a subtle gradient + glow.
 * Ported from the design handoff at .designs/design-A/tide/project/shared.jsx.
 */

export function TideMark({
  size = 26,
  glow = true,
}: {
  size?: number;
  glow?: boolean;
}) {
  return (
    <span className="mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--accent-deep)" stopOpacity="1" />
          </linearGradient>
          {glow && (
            <filter id="tgl" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
          )}
        </defs>
        <g
          stroke="url(#tg)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          filter={glow ? "url(#tgl)" : undefined}
        >
          <path d="M4 10 Q 10 6, 16 10 T 28 10" opacity="0.4" />
          <path d="M4 16 Q 10 12, 16 16 T 28 16" opacity="0.7" />
          <path d="M4 22 Q 10 18, 16 22 T 28 22" />
        </g>
      </svg>
    </span>
  );
}
