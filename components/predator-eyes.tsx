"use client";

import { memo, useEffect, useRef, useState } from "react";

/**
 * Animated feline predator eyes with flame outlines.
 *
 * Architecture (the version that finally moved without restarting):
 *   - All keyframes pre-computed at MODULE scope. They're stable
 *     across re-renders so SMIL <animate> elements never reset.
 *   - <FlameLayers /> is React.memo'd and takes only `cx` + `side`
 *     (which never change after mount). Cursor/scroll re-renders
 *     never touch it.
 *   - <Pupil /> is a separate component allowed to re-render freely.
 *
 * Motion sources stacked for cross-browser visibility:
 *   1. SVG <animate> on path d → silhouette morphs through 6 keyframes
 *   2. CSS @keyframes on transform → scale + skew pulse
 *   3. CSS stroke-dashoffset → dash pattern runs around the silhouette
 *   4. SVG <animate> on ember ovals → upward rise with fade
 */

// ─── Module-level path generators ───────────────────────────────────────────

function felineEyePath(
  side: "left" | "right",
  perturb: number[] = new Array(8).fill(0),
): string {
  const flip = side === "left" ? -1 : 1;
  const X = (n: number) => n * flip;
  const p = perturb;
  return [
    `M ${X(-118)} 6`,
    `L ${X(-92)} ${-12}`,
    `C ${X(-50 + p[0])} ${-42 + p[1]}, ${X(20 + p[2])} ${-50 + p[3]}, ${X(75)} ${-46}`,
    `C ${X(105 + p[4])} ${-42 + p[5]}, ${X(122 + p[6])} ${-30 + p[7]}, ${X(130)} ${-16}`,
    `L ${X(132)} ${-8}`,
    `L ${X(124)} 2`,
    `C ${X(108 - p[0])} ${18 + p[1]}, ${X(55 - p[2])} ${28 - p[3]}, ${X(0)} 28`,
    `C ${X(-55 + p[4])} ${26 - p[5]}, ${X(-92 + p[6])} ${18 + p[7]}, ${X(-104)} 14`,
    `L ${X(-118)} 6`,
    `Z`,
  ].join(" ");
}

function felineClipPath(side: "left" | "right"): string {
  const flip = side === "left" ? -1 : 1;
  const X = (n: number) => n * flip;
  return [
    `M ${X(-110)} 6`,
    `L ${X(-86)} ${-10}`,
    `C ${X(-46)} ${-38}, ${X(20)} ${-46}, ${X(72)} ${-42}`,
    `C ${X(100)} ${-38}, ${X(116)} ${-26}, ${X(124)} ${-14}`,
    `L ${X(125)} ${-7}`,
    `L ${X(118)} 2`,
    `C ${X(102)} 16, ${X(52)} 25, ${X(0)} 25`,
    `C ${X(-52)} 23, ${X(-86)} 16, ${X(-98)} 12`,
    `L ${X(-110)} 6`,
    `Z`,
  ].join(" ");
}

function felineIrisPath(side: "left" | "right"): string {
  return felineClipPath(side);
}

function buildKeyframes(side: "left" | "right", phase: number): string {
  const frames = [0, 1, 2, 3, 4, 5].map((i) => {
    const seed = (i + phase) * 11;
    const p = Array.from({ length: 8 }, (_, j) => {
      const angle = (seed + j * 1.3) * 0.7;
      return Math.sin(angle) * 5 + Math.cos(angle * 2.1) * 3;
    });
    return felineEyePath(side, p);
  });
  return frames.concat(frames[0]).join(";");
}

// Six independent phase offsets so the layers don't ripple in lockstep —
// each layer dances on its own pseudo-random schedule. Phases chosen
// from sqrt(2)/sqrt(3)/sqrt(5)/etc family so they never re-align.
const FLAME_PHASES = [0, 0.27, 0.51, 0.78, 1.13, 1.41] as const;

const FLAME_FRAMES = FLAME_PHASES.map((phase) => ({
  left: buildKeyframes("left", phase),
  right: buildKeyframes("right", phase),
}));

const SPLINES = "0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1";

// ─── Component ──────────────────────────────────────────────────────────────

export function PredatorEyes() {
  const ref = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);

  // Cursor tracking — throttled with requestAnimationFrame so React
  // doesn't re-render on every pixel of mouse motion. State only
  // updates ~once per frame (60fps cap), keeping the cursor-chase
  // smooth without thrashing the rendering pipeline.
  useEffect(() => {
    let rafId = 0;
    let pending: { x: number; y: number } | null = null;
    const flush = () => {
      rafId = 0;
      if (pending) setCursor(pending);
      pending = null;
    };
    const onMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      pending = {
        x: Math.max(-1, Math.min(1, cx / 500)),
        y: Math.max(-1, Math.min(1, cy / 350)),
      };
      if (!rafId) rafId = requestAnimationFrame(flush);
    };
    // Touch tracking — same handler shape for mobile devices, reads
    // first touch point so the pupils still chase the user's finger.
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) onMove({ clientX: t.clientX, clientY: t.clientY } as MouseEvent);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  // Scroll listener — also throttled via rAF so dense scroll events
  // don't churn React state.
  useEffect(() => {
    let rafId = 0;
    let pending: number | null = null;
    const flush = () => {
      rafId = 0;
      if (pending !== null) setScrollY(pending);
      pending = null;
    };
    const onScroll = () => {
      pending = window.scrollY;
      if (!rafId) rafId = requestAnimationFrame(flush);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const scrollNorm = Math.min(1, scrollY / 1200);
  const px = cursor.x * 22;
  const py = cursor.y * 8 + scrollNorm * 6;

  return (
    <div ref={ref} className="eyes" aria-hidden>
      <svg
        viewBox="0 0 760 260"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <filter id="eye-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.4" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="2" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="iris-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="45%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#083344" />
          </linearGradient>

          <radialGradient id="eye-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#06b6d4" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>

          <clipPath id="clip-eye-left" clipPathUnits="userSpaceOnUse">
            <path d={felineClipPath("left")} />
          </clipPath>
          <clipPath id="clip-eye-right" clipPathUnits="userSpaceOnUse">
            <path d={felineClipPath("right")} />
          </clipPath>
        </defs>

        {/* Halos behind each eye */}
        <ellipse cx="220" cy="130" rx="200" ry="100" fill="url(#eye-halo)" />
        <ellipse cx="540" cy="130" rx="200" ry="100" fill="url(#eye-halo)" />

        {/* Flame layers — memoized, never re-render on cursor/scroll */}
        <FlameLayers cx={220} side="left" />
        <FlameLayers cx={540} side="right" />

        {/* Pupils — re-render freely on cursor/scroll */}
        <Pupil cx={220} side="left" px={px} py={py} />
        <Pupil cx={540} side="right" px={px} py={py} />
      </svg>
    </div>
  );
}

// ─── Memoized flame layers + embers (no cursor / scroll deps) ───────────────

/** Six stacked flame outline layers, each morphing at its own phase
 *  + speed + width + opacity. Together they read as a halo of ripples
 *  dancing around the eye silhouette — many outlines, all moving. */
const FLAME_LAYER_CONFIGS = [
  { phase: 0,    width: 4.4, color: "#a5f3fc", opacity: 0.28, dur: "3.0s",  dashClass: "flame-dash-1" },
  { phase: 0.27, width: 3.6, color: "#67e8f9", opacity: 0.4,  dur: "2.6s",  dashClass: "flame-dash-2" },
  { phase: 0.51, width: 2.8, color: "#22d3ee", opacity: 0.55, dur: "2.0s",  dashClass: "flame-dash-3" },
  { phase: 0.78, width: 2.2, color: "#06b6d4", opacity: 0.75, dur: "1.6s",  dashClass: "flame-dash-4" },
  { phase: 1.13, width: 1.6, color: "#0ea5b7", opacity: 0.9,  dur: "1.25s", dashClass: "flame-dash-5" },
  { phase: 1.41, width: 1.0, color: "#67e8f9", opacity: 1,    dur: "0.9s",  dashClass: "flame-dash-6" },
] as const;

const FlameLayers = memo(function FlameLayers({
  cx,
  side,
}: {
  cx: number;
  side: "left" | "right";
}) {
  const basePath = felineEyePath(side);
  return (
    // Outer translate moves origin to (cx, 121), which is the eye's
    // VERTICAL MIDLINE in viewBox coords (eye top y=-47, bottom y=28
    // → midline y=-9.5 in local; → viewBox 130 + -9 ≈ 121). The
    // animateTransform scale composes with this translate + scales
    // around (0, 0) of this group, which is now the eye middle —
    // squish hinges correctly.
    <g transform={`translate(${cx}, 121)`}>
      <BlinkAnimate />
     <g transform="translate(0, 9)">
      {/* Stack of 6 morphing outlines — different phase + speed +
          width + opacity each, so they ripple independently and read
          as a fire halo around the eye silhouette. */}
      {FLAME_LAYER_CONFIGS.map((cfg, i) => (
        <path
          key={i}
          className={cfg.dashClass}
          d={basePath}
          fill="none"
          stroke={cfg.color}
          strokeWidth={cfg.width}
          opacity={cfg.opacity}
        >
          <animate
            attributeName="d"
            values={FLAME_FRAMES[i][side]}
            dur={cfg.dur}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines={SPLINES}
          />
        </path>
      ))}

      {/* Sharp inner outline — undistorted, the "real" predator edge */}
      <path
        d={basePath}
        fill="rgba(8,30,40,0.3)"
        stroke="#06b6d4"
        strokeWidth="1.2"
      />

      {/* Iris fill */}
      <path d={felineIrisPath(side)} fill="url(#iris-grad)" opacity="0.32" />

      {/* Embers — six rising particles per eye */}
      <Embers side={side} />
     </g>
    </g>
  );
});

/** Periodic blink — SMIL animateTransform with type="scale" composes
 *  with the parent <g>'s translate via additive="sum". Scale center
 *  is (0, 0) of the parent's local coord, which we positioned at the
 *  eye's vertical midline. */
function BlinkAnimate() {
  return (
    <animateTransform
      attributeName="transform"
      type="scale"
      additive="sum"
      values="1 1; 1 1; 1 0.04; 1 0.04; 1 1; 1 1"
      keyTimes="0; 0.92; 0.94; 0.95; 0.97; 1"
      dur="6.4s"
      repeatCount="indefinite"
    />
  );
}

const Embers = memo(function Embers({ side }: { side: "left" | "right" }) {
  const flip = side === "left" ? -1 : 1;
  const seeds = [
    { x: -60 * flip, delay: 0,    dur: 2.4, riseHi: 60, riseFar: 84 },
    { x: -10 * flip, delay: 0.4,  dur: 2.6, riseHi: 64, riseFar: 92 },
    { x:  30 * flip, delay: 0.8,  dur: 2.2, riseHi: 58, riseFar: 78 },
    { x:  70 * flip, delay: 1.2,  dur: 2.5, riseHi: 62, riseFar: 86 },
    { x: 100 * flip, delay: 0.2,  dur: 2.3, riseHi: 56, riseFar: 80 },
    { x: -90 * flip, delay: 1.6,  dur: 2.4, riseHi: 66, riseFar: 88 },
  ];
  return (
    <g>
      {seeds.map((s, i) => (
        <ellipse
          key={i}
          cx={s.x}
          cy={-38}
          rx="2"
          ry="3"
          fill="#67e8f9"
          opacity="0"
        >
          <animate
            attributeName="cy"
            values={`-38;-${s.riseHi};-${s.riseFar}`}
            dur={`${s.dur}s`}
            begin={`${s.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;0"
            dur={`${s.dur}s`}
            begin={`${s.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="rx"
            values="2;1.4;0.6"
            dur={`${s.dur}s`}
            begin={`${s.delay}s`}
            repeatCount="indefinite"
          />
        </ellipse>
      ))}
    </g>
  );
});

// ─── Pupil (re-renders on cursor / scroll) ──────────────────────────────────

function Pupil({
  cx,
  side,
  px,
  py,
}: {
  cx: number;
  side: "left" | "right";
  px: number;
  py: number;
}) {
  return (
    // Same shifted-translate trick as FlameLayers so blink scale
    // hinges on the eye's vertical midline.
    <g transform={`translate(${cx}, 121)`}>
      <BlinkAnimate />
     <g transform="translate(0, 9)">
      <g clipPath={`url(#clip-eye-${side})`}>
        <g transform={`translate(${px}, ${py})`}>
          <ellipse
            rx="12"
            ry="30"
            fill="#06b6d4"
            opacity="0.3"
            filter="url(#eye-glow)"
          />
          <ellipse
            rx="8"
            ry="26"
            fill="#020409"
            stroke="#22d3ee"
            strokeWidth="0.9"
          />
          <ellipse rx="3.5" ry="20" fill="#06b6d4" opacity="0.85" />
          <ellipse
            cx="-1.8"
            cy="-9"
            rx="2"
            ry="5"
            fill="#ecfeff"
            opacity="0.95"
          />
        </g>
      </g>
     </g>
    </g>
  );
}
