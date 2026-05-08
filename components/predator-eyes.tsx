"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated predator eyes — large, centered, sharp almond shape with
 * multi-layer flame outline that flickers + cursor-tracking pupils.
 *
 * Narrative tie-in: "Bots blind, retail wins" — Tide is the watcher.
 *
 * Implementation:
 *   - Eye shape is a hand-crafted path (vesica piscis / almond) with
 *     sharp inner + outer corners — reads as predator vs. cartoon round
 *   - Outer outline distorts via feTurbulence + feDisplacementMap with
 *     two simultaneous turbulence frequencies for layered "fire" feel
 *   - 5-layer flame stack (varying stroke width + opacity + colors)
 *     gives the outline depth without single-pass aliasing
 *   - Cursor tracking via mousemove → pupil offset clamped within eye
 *   - prefers-reduced-motion kills all animation, leaves a sharp static
 *     SVG that still reads as a predator silhouette
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

  // Pupil shift bounded so it stays inside the iris bowl
  const px = cursor.x * 22;
  const py = cursor.y * 8;

  return (
    <div ref={ref} className="eyes" aria-hidden>
      <svg
        viewBox="0 0 720 220"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        <defs>
          {/* Macro flame distortion — large, slow, sweeping movement */}
          <filter
            id="flame-macro"
            x="-30%"
            y="-100%"
            width="160%"
            height="300%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018 0.045"
              numOctaves="2"
              seed="3"
              result="t1"
            >
              {!reduceMotion && (
                <>
                  <animate
                    attributeName="seed"
                    values="3;7;2;9;5;3"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="baseFrequency"
                    values="0.018 0.045;0.03 0.07;0.015 0.04;0.018 0.045"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                </>
              )}
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="t1"
              scale="16"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* Micro flame distortion — small, fast, fine-grain shimmer */}
          <filter
            id="flame-micro"
            x="-20%"
            y="-60%"
            width="140%"
            height="220%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.08 0.15"
              numOctaves="3"
              seed="5"
              result="t2"
            >
              {!reduceMotion && (
                <animate
                  attributeName="seed"
                  values="5;11;2;8;5"
                  dur="0.9s"
                  repeatCount="indefinite"
                />
              )}
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="t2"
              scale="6"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          <filter id="eye-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="1.8" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="iris-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0c4a6e" />
          </linearGradient>

          <radialGradient id="eye-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background halos — bleed cyan glow behind each eye */}
        <ellipse cx="200" cy="110" rx="180" ry="80" fill="url(#eye-halo)" />
        <ellipse cx="520" cy="110" rx="180" ry="80" fill="url(#eye-halo)" />

        <Eye cx={200} px={px} py={py} />
        <Eye cx={520} px={px} py={py} />
      </svg>
    </div>
  );
}

/** Almond / vesica-piscis path. Sharp corners at left + right tips. */
function eyePath(rx = 130, ry = 50) {
  // Cubic Bezier control points tuned so the curves bow out toward the
  // vertical midline before snapping back to the sharp horizontal tips.
  const cy = ry * 1.05;
  return [
    `M ${-rx} 0`,
    `C ${-rx * 0.55} ${-cy}, ${rx * 0.55} ${-cy}, ${rx} 0`,
    `C ${rx * 0.55} ${cy}, ${-rx * 0.55} ${cy}, ${-rx} 0`,
    `Z`,
  ].join(" ");
}

function Eye({ cx, px, py }: { cx: number; px: number; py: number }) {
  const path = eyePath();
  return (
    <g transform={`translate(${cx}, 110)`}>
      {/* Outer wide flame — slowest distortion, biggest spread, faintest */}
      <path
        d={path}
        fill="none"
        stroke="#a5f3fc"
        strokeWidth="2"
        filter="url(#flame-macro)"
        opacity="0.35"
      />
      <path
        d={path}
        fill="none"
        stroke="#67e8f9"
        strokeWidth="3"
        filter="url(#flame-macro)"
        opacity="0.55"
      />
      {/* Mid flame — fast micro distortion, mid weight */}
      <path
        d={path}
        fill="none"
        stroke="#06b6d4"
        strokeWidth="2.2"
        filter="url(#flame-micro)"
        opacity="0.85"
      />
      {/* Sharp inner outline — undistorted, the "real" predator edge */}
      <path
        d={path}
        fill="rgba(6,182,212,0.05)"
        stroke="#06b6d4"
        strokeWidth="1.2"
      />
      {/* Iris fill */}
      <path
        d={eyePath(126, 47)}
        fill="url(#iris-grad)"
        opacity="0.22"
      />

      {/* Vertical-slit pupil — tracks cursor */}
      <g transform={`translate(${px}, ${py})`}>
        {/* Pupil glow halo */}
        <ellipse
          rx="14"
          ry="36"
          fill="#06b6d4"
          opacity="0.25"
          filter="url(#eye-glow)"
        />
        {/* Pupil core — almost-black, sharp */}
        <ellipse
          rx="9"
          ry="32"
          fill="#050810"
          stroke="#22d3ee"
          strokeWidth="0.8"
        />
        {/* Inner pupil glow */}
        <ellipse rx="4" ry="24" fill="#06b6d4" opacity="0.85" />
        {/* Specular highlight — bright dot, sells the lens */}
        <ellipse
          cx="-2"
          cy="-10"
          rx="2"
          ry="6"
          fill="#ecfeff"
          opacity="0.9"
        />
      </g>
    </g>
  );
}
