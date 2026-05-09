"use client";

import { memo, useEffect, useRef, useState } from "react";

/**
 * Predator eyes — clean SVG cat-eye pair, no fire effects.
 *
 * Sharp almond outline with asymmetric upturn (outer corner higher
 * than inner — alert predator tilt). Iris fills with cyan gradient,
 * pupil tracks cursor + glances down as user scrolls. Subtle halo
 * glow behind each eye for atmospheric depth.
 *
 * Fixed-position wrapper (.landing-eyes-fixed) keeps the eyes visible
 * across the entire landing scroll.
 */

function felineEyePath(side: "left" | "right"): string {
  const flip = side === "left" ? -1 : 1;
  const X = (n: number) => n * flip;
  return [
    `M ${X(-118)} 6`,
    `L ${X(-92)} ${-12}`,
    `C ${X(-50)} ${-42}, ${X(20)} ${-50}, ${X(75)} ${-46}`,
    `C ${X(105)} ${-42}, ${X(122)} ${-30}, ${X(130)} ${-16}`,
    `L ${X(132)} ${-8}`,
    `L ${X(124)} 2`,
    `C ${X(108)} 18, ${X(55)} 28, ${X(0)} 28`,
    `C ${X(-55)} 26, ${X(-92)} 18, ${X(-104)} 14`,
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

/** Generate a perturbed eye outline path. Bezier control points jitter
 *  by small sin/cos deltas based on `perturb` array — produces subtly
 *  different silhouettes per keyframe. Sharp inner/outer corners stay
 *  anchored (hardcoded L points) so the eye keeps its predator look. */
function felineEyePathPerturbed(
  side: "left" | "right",
  p: number[],
): string {
  const flip = side === "left" ? -1 : 1;
  const X = (n: number) => n * flip;
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

function buildKeyframes(side: "left" | "right", phase: number): string {
  const frames = [0, 1, 2, 3, 4, 5].map((i) => {
    const seed = (i + phase) * 11;
    const p = Array.from({ length: 8 }, (_, j) => {
      const angle = (seed + j * 1.3) * 0.7;
      // Top control points (j < 4) jitter more than bottom — outline
      // dances more toward the top, giving the eye a calm "alive" feel
      // without overdoing motion.
      const isTop = j < 4;
      const amp = isTop ? 4 : 2;
      return Math.sin(angle) * amp + Math.cos(angle * 2.1) * (amp * 0.5);
    });
    return felineEyePathPerturbed(side, p);
  });
  return frames.concat(frames[0]).join(";");
}

// Module-scope so the `<animate>` values attribute stays stable across
// React re-renders (cursor + scroll changes won't restart the timeline).
const OUTLINE_FRAMES = {
  left: buildKeyframes("left", 0),
  right: buildKeyframes("right", 0),
} as const;

const SPLINES = "0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1";

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
        style={{ display: "block" }}
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

        {/* Halos behind each eye */}
        <ellipse cx="220" cy="130" rx="200" ry="100" fill="url(#eye-halo)" />
        <ellipse cx="540" cy="130" rx="200" ry="100" fill="url(#eye-halo)" />

        <EyeShape cx={220} side="left" />
        <EyeShape cx={540} side="right" />

        <Pupil cx={220} side="left" px={px} py={py} />
        <Pupil cx={540} side="right" px={px} py={py} />
      </svg>
    </div>
  );
}

const EyeShape = memo(function EyeShape({
  cx,
  side,
}: {
  cx: number;
  side: "left" | "right";
}) {
  const path = felineEyePath(side);
  return (
    <g transform={`translate(${cx}, 130)`}>
      {/* Sharp outline — d-attribute morphs between 6 perturbed
          keyframes so the silhouette subtly waves. Module-scope
          values string keeps the animation timeline stable across
          React re-renders. */}
      <path
        d={path}
        fill="rgba(8,30,40,0.4)"
        stroke="#06b6d4"
        strokeWidth="1.8"
      >
        <animate
          attributeName="d"
          values={OUTLINE_FRAMES[side]}
          dur="3.2s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines={SPLINES}
        />
      </path>
      {/* Iris fill — slightly inset path with vertical cyan gradient */}
      <path d={felineClipPath(side)} fill="url(#iris-grad)" opacity="0.4" />
    </g>
  );
});

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
