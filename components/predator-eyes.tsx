"use client";

import { memo, useEffect, useRef, useState } from "react";

/**
 * Animated feline predator eyes with flame outlines.
 *
 * Architecture (rewritten — earlier versions had a subtle bug where
 * keyframe computation lived INSIDE the component function. Each
 * cursor or scroll event re-rendered the component, which regenerated
 * the SMIL animate `values` attribute, which made the browser restart
 * the animation from frame 0 — manifesting as visually static eyes.):
 *
 *   - All flame keyframes pre-computed at MODULE scope. They're
 *     stable across re-renders.
 *   - <FlameLayers /> is React.memo'd and takes no props that change
 *     during user interaction. SMIL animations run uninterrupted.
 *   - Pupil tracking lives in a separate inner component that is
 *     allowed to re-render freely.
 *
 * Animation sources (stacked for visibility across browsers):
 *   1. SVG <animate> on path d → silhouette morphs through 6 keyframes
 *   2. SVG <animate> on stroke-dashoffset → dash pattern runs
 *   3. CSS @keyframes on transform → scale + skew pulse
 *   4. SVG <animate> on ember ovals → upward rise with fade
 *
 * No more dependency on feTurbulence animation — that filter was
 * caching itself across browsers and never re-evaluating.
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

/** Pre-computed flame keyframes — module-scope so they are stable
 *  across React re-renders. SMIL <animate> values attribute stays
 *  identical, so the browser's animation timeline never resets. */
const FLAME_FRAMES = {
  outer: {
    left: buildKeyframes("left", 0),
    right: buildKeyframes("right", 0),
  },
  mid: {
    left: buildKeyframes("left", 0.43),
    right: buildKeyframes("right", 0.43),
  },
} as const;

function buildKeyframes(side: "left" | "right", phase: number): string {
  const frames = [0, 1, 2, 3, 4, 5].map((i) => {
    const seed = (i + phase) * 11;
    // Bias the perturbation upward — top control points jump more than
    // bottom ones — so the silhouette dances more like a real flame
    // (fire rises, doesn't slosh symmetrically).
    const p = Array.from({ length: 8 }, (_, j) => {
      const angle = (seed + j * 1.3) * 0.7;
      const isTop = j < 4;
      const amp = isTop ? 8 : 3;
      return Math.sin(angle) * amp + Math.cos(angle * 2.1) * (amp * 0.6);
    });
    return felineEyePath(side, p);
  });
  return frames.concat(frames[0]).join(";");
}

const SPLINES = "0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1";

/** Flame tongue paths — thin vertical spikes that lick upward from the
 *  top edge of the eye. Each tongue morphs through 4 keyframes where
 *  the tip wiggles + height pulses. Pre-computed at module level. */
function tongueKeyframes(amplitude: number, height: number): string {
  const frames = [0, 1, 2, 3].map((i) => {
    const wiggle = Math.sin(i * 1.7) * amplitude;
    const h = height * (0.7 + Math.sin(i * 2.3) * 0.3); // height pulses
    return [
      `M ${-6} 0`,
      `Q ${-3 + wiggle * 0.4} ${-h * 0.4}, ${wiggle} ${-h}`,
      `Q ${3 + wiggle * 0.4} ${-h * 0.4}, ${6} 0`,
      `Z`,
    ].join(" ");
  });
  return frames.concat(frames[0]).join(";");
}

const TONGUE_KEYFRAMES = [
  tongueKeyframes(3, 26),
  tongueKeyframes(5, 32),
  tongueKeyframes(2, 22),
  tongueKeyframes(6, 36),
  tongueKeyframes(3, 28),
  tongueKeyframes(4, 30),
];

const TONGUE_SPLINES = "0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1";

// ─── Component ──────────────────────────────────────────────────────────────

export function PredatorEyes() {
  const ref = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      setCursor({
        x: Math.max(-1, Math.min(1, cx / 500)),
        y: Math.max(-1, Math.min(1, cy / 350)),
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

          {/* Flame tongue gradient — tip is white-hot, base is cyan.
              Real fire reads bright at apex, denser/cooler at root. */}
          <linearGradient id="tongue-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%"  stopColor="#06b6d4" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#67e8f9" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ecfeff" stopOpacity="0.6" />
          </linearGradient>

          {/* Hot-spot glow for the central top of each eye */}
          <radialGradient id="hot-spot" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#ecfeff" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#67e8f9" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="eye-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
            <stop offset="55%" stopColor="#06b6d4" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>

          <clipPath id="clip-eye-left" clipPathUnits="userSpaceOnUse">
            <path d={felineClipPath("left")} />
          </clipPath>
          <clipPath id="clip-eye-right" clipPathUnits="userSpaceOnUse">
            <path d={felineClipPath("right")} />
          </clipPath>
        </defs>

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

const FlameLayers = memo(function FlameLayers({
  cx,
  side,
}: {
  cx: number;
  side: "left" | "right";
}) {
  const basePath = felineEyePath(side);
  return (
    <g transform={`translate(${cx}, 130)`}>
      {/* Outer flame — morphs slowly through 6 keyframes */}
      <path
        className="flame-flow-out"
        d={basePath}
        fill="none"
        stroke="#67e8f9"
        strokeWidth="2.6"
        opacity="0.75"
      >
        <animate
          attributeName="d"
          values={FLAME_FRAMES.outer[side]}
          dur="2.4s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines={SPLINES}
        />
      </path>

      {/* Mid flame — independent fast morph (phase-shifted keyframes) */}
      <path
        className="flame-flow-mid"
        d={basePath}
        fill="none"
        stroke="#06b6d4"
        strokeWidth="1.8"
        opacity="0.95"
      >
        <animate
          attributeName="d"
          values={FLAME_FRAMES.mid[side]}
          dur="1.4s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines={SPLINES}
        />
      </path>

      {/* Sharp inner outline — undistorted, the "real" predator edge */}
      <path
        d={basePath}
        fill="rgba(8,30,40,0.3)"
        stroke="#06b6d4"
        strokeWidth="1.2"
      />

      {/* Iris fill */}
      <path d={felineIrisPath(side)} fill="url(#iris-grad)" opacity="0.32" />

      {/* Hot-spot glow at top center — pulses brightness */}
      <ellipse cx="0" cy="-44" rx="55" ry="22" fill="url(#hot-spot)">
        <animate
          attributeName="opacity"
          values="0.45;0.85;0.55;0.95;0.45"
          dur="1.6s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="rx"
          values="50;62;52;58;50"
          dur="1.6s"
          repeatCount="indefinite"
        />
      </ellipse>

      {/* Flame tongues — vertical spikes that lick upward from top edge */}
      <FlameTongues side={side} />

      {/* Embers — many rising particles per eye */}
      <Embers side={side} />
    </g>
  );
});

const FlameTongues = memo(function FlameTongues({
  side,
}: {
  side: "left" | "right";
}) {
  const flip = side === "left" ? -1 : 1;
  // 7 tongues distributed along the top edge of the eye, each with own
  // animation phase + duration so they ripple independently.
  const tongues = [
    { x: -85 * flip, baseY: -36, kf: 0, dur: "1.6s", delay: "0s",   scale: 0.8 },
    { x: -55 * flip, baseY: -42, kf: 1, dur: "1.4s", delay: "0.3s", scale: 1.0 },
    { x: -25 * flip, baseY: -46, kf: 2, dur: "1.7s", delay: "0.6s", scale: 1.1 },
    { x:   5 * flip, baseY: -47, kf: 3, dur: "1.3s", delay: "0.9s", scale: 1.2 },
    { x:  35 * flip, baseY: -45, kf: 4, dur: "1.5s", delay: "0.2s", scale: 1.0 },
    { x:  70 * flip, baseY: -38, kf: 5, dur: "1.4s", delay: "0.5s", scale: 0.9 },
    { x: 105 * flip, baseY: -28, kf: 0, dur: "1.6s", delay: "0.8s", scale: 0.7 },
  ];
  return (
    <g>
      {tongues.map((t, i) => (
        <g key={i} transform={`translate(${t.x}, ${t.baseY}) scale(${t.scale})`}>
          <path
            d={TONGUE_KEYFRAMES[t.kf].split(";")[0]}
            fill="url(#tongue-grad)"
            opacity="0.85"
          >
            <animate
              attributeName="d"
              values={TONGUE_KEYFRAMES[t.kf]}
              dur={t.dur}
              begin={t.delay}
              repeatCount="indefinite"
              calcMode="spline"
              keySplines={TONGUE_SPLINES}
            />
            <animate
              attributeName="opacity"
              values="0.4;0.95;0.6;0.9;0.4"
              dur={t.dur}
              begin={t.delay}
              repeatCount="indefinite"
            />
          </path>
        </g>
      ))}
    </g>
  );
});

const Embers = memo(function Embers({ side }: { side: "left" | "right" }) {
  const flip = side === "left" ? -1 : 1;
  // 18 embers per eye, varied sizes/colors/speeds, with horizontal
  // drift via cx animation so they don't rise straight (real sparks
  // wobble in the heat plume).
  const seeds = Array.from({ length: 18 }, (_, i) => {
    // Distribute x positions across top edge of eye + some randomness
    const baseX = (-100 + (i * 220) / 17) * flip;
    const drift = ((i % 3) - 1) * 8 * flip; // left/center/right drift
    return {
      x: baseX,
      driftX: baseX + drift,
      delay: (i * 0.18) % 2.4,
      dur: 1.8 + (i % 4) * 0.2,
      riseHi: 56 + (i % 5) * 6,
      riseFar: 80 + (i % 6) * 8,
      rx: i % 3 === 0 ? 2.4 : i % 3 === 1 ? 1.8 : 1.2,
      // Alternate between cyan and white-hot for color variety
      fill: i % 4 === 0 ? "#ecfeff" : i % 4 === 1 ? "#a5f3fc" : "#67e8f9",
    };
  });
  return (
    <g>
      {seeds.map((s, i) => (
        <ellipse
          key={i}
          cx={s.x}
          cy={-38}
          rx={s.rx}
          ry={s.rx * 1.5}
          fill={s.fill}
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
            attributeName="cx"
            values={`${s.x};${s.driftX};${s.x - (s.driftX - s.x) * 0.5}`}
            dur={`${s.dur}s`}
            begin={`${s.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;0.6;0"
            dur={`${s.dur}s`}
            begin={`${s.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="rx"
            values={`${s.rx};${s.rx * 0.7};0.4`}
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
    <g transform={`translate(${cx}, 130)`}>
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
  );
}
