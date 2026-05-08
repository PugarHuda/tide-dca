"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated feline eyes — winged cat-eye shape (makeup-style) with
 * asymmetric sharp outer wing-tips, multi-layer flame outlines, and
 * decorative flame tendrils that lick outward from the wing tips.
 *
 * Path is hand-built so the inner corner is a soft pointed tip and the
 * outer corner extends upward into a sharp winged-eyeliner flick. Each
 * eye is mirrored across the hero center axis (left eye = mirror of
 * right) so the wings face outward, like predator eyes catching light
 * from above.
 *
 * Flame: TWO independent turbulence filters animate simultaneously —
 *   - flame-macro: slow + wide displacement (scale 22), drives the
 *     silhouette-level dance you read as "fire moving"
 *   - flame-micro: fast + tight displacement (scale 9), gives the edge
 *     a continuous shimmer that never repeats visibly
 * The result is a pseudo-random distortion that always looks alive.
 *
 * Tendrils: 4 short paths extending from each wing tip, also distorted
 * by the macro filter, with staggered opacity so they read as embers
 * trailing into the night sky.
 */
export function PredatorEyes() {
  const ref = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
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

  const px = cursor.x * 22;
  const py = cursor.y * 8;

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
          {/* Macro flame — large, slow displacement. Tuned softer for
              background-atmospheric use; it should breathe behind the
              text, not compete with it. */}
          <filter
            id="flame-macro"
            x="-50%"
            y="-150%"
            width="200%"
            height="400%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018 0.05"
              numOctaves="2"
              seed="3"
              result="t1"
            >
              {!reduceMotion && (
                <>
                  <animate
                    attributeName="seed"
                    values="3;7;1;9;5;2;3"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="baseFrequency"
                    values="0.018 0.05;0.028 0.07;0.014 0.04;0.018 0.05"
                    dur="3.4s"
                    repeatCount="indefinite"
                  />
                </>
              )}
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="t1"
              scale="14"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* Micro flame — fast, very subtle shimmer */}
          <filter
            id="flame-micro"
            x="-30%"
            y="-80%"
            width="160%"
            height="260%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.1 0.18"
              numOctaves="2"
              seed="5"
              result="t2"
            >
              {!reduceMotion && (
                <animate
                  attributeName="seed"
                  values="5;13;2;9;5"
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              )}
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="t2"
              scale="5"
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
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
            <stop offset="55%" stopColor="#06b6d4" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Halos behind each eye */}
        <ellipse cx="220" cy="130" rx="200" ry="100" fill="url(#eye-halo)" />
        <ellipse cx="540" cy="130" rx="200" ry="100" fill="url(#eye-halo)" />

        <FelineEye cx={220} side="left" px={px} py={py} />
        <FelineEye cx={540} side="right" px={px} py={py} />
      </svg>
    </div>
  );
}

/**
 * Path for one feline eye, parameterized by orientation. The inner
 * corner is the side facing toward the center of the face; the outer
 * corner has the upward winged-eyeliner extension.
 */
function felineEyePath(side: "left" | "right"): string {
  // Right-eye geometry; left-eye is x-flipped via `flip`
  const flip = side === "right" ? 1 : -1;
  const X = (n: number) => n * flip;

  // Inner corner is at small positive x for right (closer to center),
  // outer corner is at negative x with upward wing for right. For left,
  // x flips so outer wing is on the LEFT side (away from center).
  return [
    `M ${X(105)} 4`,                                    // inner corner tip
    `C ${X(60)} ${-30}, ${X(0)} ${-44}, ${X(-60)} ${-40}`, // top arc rolling up
    `C ${X(-100)} ${-38}, ${X(-130)} ${-36}, ${X(-150)} ${-44}`,
    `L ${X(-160)} ${-52}`,                              // wing apex (sharp)
    `L ${X(-128)} ${-22}`,                              // wing under-tip
    `C ${X(-90)} ${-8}, ${X(-30)} 12, ${X(20)} 18`,     // bottom arc back
    `C ${X(60)} 18, ${X(90)} 14, ${X(105)} 4`,
    `Z`,
  ].join(" ");
}

function FelineEye({
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
  const path = felineEyePath(side);
  return (
    <g transform={`translate(${cx}, 130)`}>
      {/* Outer flame — slow distortion, biggest spread, faint */}
      <path
        d={path}
        fill="none"
        stroke="#67e8f9"
        strokeWidth="2.4"
        filter="url(#flame-macro)"
        opacity="0.5"
      />
      {/* Mid flame — fast shimmer */}
      <path
        d={path}
        fill="none"
        stroke="#06b6d4"
        strokeWidth="1.6"
        filter="url(#flame-micro)"
        opacity="0.85"
      />
      {/* Sharp inner outline — undistorted, the "real" predator edge */}
      <path
        d={path}
        fill="rgba(8,30,40,0.3)"
        stroke="#06b6d4"
        strokeWidth="1.2"
      />

      {/* Iris — slightly inset feline path */}
      <FelineIris side={side} />

      {/* Pupil — vertical slit, tracks cursor */}
      <g transform={`translate(${px}, ${py})`}>
        <ellipse
          rx="14"
          ry="40"
          fill="#06b6d4"
          opacity="0.3"
          filter="url(#eye-glow)"
        />
        <ellipse
          rx="9"
          ry="34"
          fill="#020409"
          stroke="#22d3ee"
          strokeWidth="0.9"
        />
        <ellipse rx="4" ry="26" fill="#06b6d4" opacity="0.85" />
        <ellipse
          cx="-2"
          cy="-12"
          rx="2.2"
          ry="6"
          fill="#ecfeff"
          opacity="0.95"
        />
      </g>
    </g>
  );
}

function FelineIris({ side }: { side: "left" | "right" }) {
  const flip = side === "right" ? 1 : -1;
  const X = (n: number) => n * flip;
  // Slightly inset path that fills the eye with cyan iris gradient
  const d = [
    `M ${X(98)} 3`,
    `C ${X(55)} ${-26}, ${X(0)} ${-38}, ${X(-58)} ${-34}`,
    `C ${X(-95)} ${-32}, ${X(-122)} ${-30}, ${X(-138)} ${-36}`,
    `L ${X(-145)} ${-42}`,
    `L ${X(-118)} ${-18}`,
    `C ${X(-85)} ${-6}, ${X(-30)} 10, ${X(20)} 16`,
    `C ${X(58)} 16, ${X(85)} 12, ${X(98)} 3`,
    `Z`,
  ].join(" ");
  return <path d={d} fill="url(#iris-grad)" opacity="0.32" />;
}
