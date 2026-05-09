"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated feline predator eyes with flame outlines.
 *
 * Animation strategy (rewritten — earlier filter-only approach didn't
 * register as visible motion in many browsers because Chrome / Safari
 * cache filter primitive outputs even when SMIL or React-state changes
 * the seed attribute):
 *
 *   1. Outline d morphs between 3 flame keyframes via SMIL <animate>.
 *      Path-d animation is universally supported and never cached —
 *      the silhouette VISIBLY ripples like fire.
 *   2. Each flame stroke layer also pulses via CSS transform (scale +
 *      skew) so the layers shift relative to each other. GPU-accelerated,
 *      always renders.
 *   3. Stroke-dashoffset on the outer flame stroke makes the dash pattern
 *      "run" around the silhouette like fire flowing.
 *   4. Six "ember" ovals rise + fade from the top of each eye via SMIL
 *      animate on cy + opacity. Real upward motion makes the fire feel
 *      alive even when other layers are subtle.
 *   5. The static turbulence filter still adds a one-shot distortion to
 *      the outer flame stroke, but it isn't the source of visible motion
 *      anymore — just a texture.
 *
 * Cursor + scroll tracking on pupils preserved from earlier iterations.
 */
export function PredatorEyes() {
  const ref = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduceMotion(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
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
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduceMotion]);

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
          {/* Static turbulence — adds one-shot texture to the outer stroke,
              not the source of motion anymore. */}
          <filter
            id="flame-tex"
            x="-50%"
            y="-150%"
            width="200%"
            height="400%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.025 0.07"
              numOctaves="2"
              seed="7"
              result="t1"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="t1"
              scale="14"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

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

        <FelineEye cx={220} side="left" px={px} py={py} animate={!reduceMotion} />
        <FelineEye cx={540} side="right" px={px} py={py} animate={!reduceMotion} />
      </svg>
    </div>
  );
}

/**
 * Sharp feline eye path. The "perturb" parameter applies tiny
 * +/- offsets to the curve control points so we can generate distinct
 * shape variants for the d-attribute SMIL animation keyframes.
 */
function felineEyePath(
  side: "left" | "right",
  perturb: number[] = new Array(8).fill(0),
): string {
  const flip = side === "left" ? -1 : 1;
  const X = (n: number) => n * flip;
  // perturb[0..7] applied to non-corner control points so shape ripples
  // but the sharp tips stay anchored
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

/** Generate flame keyframes for SMIL d-animation. Each frame perturbs
 *  the path control points by small amounts so the silhouette ripples.
 */
function flameKeyframes(side: "left" | "right"): string {
  const frames = [0, 1, 2, 3, 4].map((i) => {
    const seed = i * 11;
    const p = Array.from({ length: 8 }, (_, j) => {
      const angle = (seed + j * 1.3) * 0.7;
      return Math.sin(angle) * 4 + Math.cos(angle * 2.1) * 2;
    });
    return felineEyePath(side, p);
  });
  // Loop back to first frame for seamless restart
  return frames.concat(frames[0]).join(";");
}

function FelineEye({
  cx,
  side,
  px,
  py,
  animate,
}: {
  cx: number;
  side: "left" | "right";
  px: number;
  py: number;
  animate: boolean;
}) {
  const path = felineEyePath(side);
  const morphFrames = flameKeyframes(side);

  return (
    <g transform={`translate(${cx}, 130)`}>
      {/* Outer flame — d-animation morphs the silhouette continuously,
          CSS class adds dashoffset running pattern + scale pulse. */}
      <path
        className="flame-flow-out"
        d={path}
        fill="none"
        stroke="#67e8f9"
        strokeWidth="2.6"
        filter="url(#flame-tex)"
        opacity="0.7"
      >
        {animate && (
          <animate
            attributeName="d"
            values={morphFrames}
            dur="2.2s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
          />
        )}
      </path>
      {/* Mid flame — independent morph cycle (faster + offset phase) */}
      <path
        className="flame-flow-mid"
        d={path}
        fill="none"
        stroke="#06b6d4"
        strokeWidth="1.6"
        opacity="0.95"
      >
        {animate && (
          <animate
            attributeName="d"
            values={flameKeyframesPhase(side, 0.35)}
            dur="1.4s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
          />
        )}
      </path>
      {/* Sharp inner outline — undistorted, the "real" predator edge */}
      <path
        d={path}
        fill="rgba(8,30,40,0.3)"
        stroke="#06b6d4"
        strokeWidth="1.2"
      />

      {/* Iris fill */}
      <FelineIris side={side} />

      {/* Embers — small ovals rising from the top of each eye, fading
          out as they ascend. Real upward motion sells the "fire" feel
          regardless of how the outline animation is rendering. */}
      {animate && <Embers side={side} />}

      {/* Pupil — vertical slit, tracks cursor, clipped to iris bowl */}
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

/** Same flameKeyframes but with a phase offset so mid + outer flame
 *  layers don't rip in lockstep — they shift relative to each other. */
function flameKeyframesPhase(side: "left" | "right", phase: number): string {
  const frames = [0, 1, 2, 3, 4].map((i) => {
    const seed = (i + phase) * 11;
    const p = Array.from({ length: 8 }, (_, j) => {
      const angle = (seed + j * 1.7) * 0.5;
      return Math.sin(angle) * 3 + Math.cos(angle * 1.9) * 1.5;
    });
    return felineEyePath(side, p);
  });
  return frames.concat(frames[0]).join(";");
}

function FelineIris({ side }: { side: "left" | "right" }) {
  const flip = side === "left" ? -1 : 1;
  const X = (n: number) => n * flip;
  const d = [
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
  return <path d={d} fill="url(#iris-grad)" opacity="0.32" />;
}

/** Six embers per eye, each starting at a different x along the top
 *  edge with a different delay. They rise (cy decreases) and fade
 *  (opacity → 0) over a 2-2.5s cycle. SMIL <animate> on cy + opacity
 *  is universally supported and never cached. */
function Embers({ side }: { side: "left" | "right" }) {
  const flip = side === "left" ? -1 : 1;
  const seeds = [
    { x: -60 * flip, delay: 0,    dur: 2.4, riseHi: 56, riseFar: 76 },
    { x: -10 * flip, delay: 0.4,  dur: 2.6, riseHi: 60, riseFar: 84 },
    { x:  30 * flip, delay: 0.8,  dur: 2.2, riseHi: 54, riseFar: 72 },
    { x:  70 * flip, delay: 1.2,  dur: 2.5, riseHi: 58, riseFar: 80 },
    { x: 100 * flip, delay: 0.2,  dur: 2.3, riseHi: 52, riseFar: 74 },
    { x: -90 * flip, delay: 1.6,  dur: 2.4, riseHi: 62, riseFar: 82 },
  ];
  return (
    <g>
      {seeds.map((s, i) => (
        <Ember key={i} {...s} />
      ))}
    </g>
  );
}

function Ember({
  x,
  delay,
  dur,
  riseHi,
  riseFar,
}: {
  x: number;
  delay: number;
  dur: number;
  riseHi: number;
  riseFar: number;
}) {
  return (
    <ellipse cx={x} cy={-38} rx="1.6" ry="2.4" fill="#67e8f9" opacity="0">
      <animate
        attributeName="cy"
        values={`-38;-${riseHi};-${riseFar}`}
        dur={`${dur}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="0;0.85;0"
        dur={`${dur}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
      <animate
        attributeName="rx"
        values="1.6;1.2;0.6"
        dur={`${dur}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
    </ellipse>
  );
}
