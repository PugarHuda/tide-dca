"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated predator eyes for the hero. Two cyan eyes with vertical-slit
 * pupils that track the cursor; the outer outline distorts continuously
 * via SVG `feTurbulence` to mimic flame flicker.
 *
 * Narrative tie-in: "Bots blind, retail wins" — Tide is the watcher.
 * Visual reinforces the predator/protector framing without cute mascots.
 *
 * Implementation notes:
 *   - feTurbulence + feDisplacementMap distorts the outline edge
 *   - Animated `seed` + `baseFrequency` make the distortion flicker over time
 *   - Cursor tracking via mousemove → pupil offset clamped within sclera
 *   - prefers-reduced-motion kills the flame animation + cursor tracking
 *
 * The filter is expensive on low-end GPUs. We size the SVG modestly (~520px
 * wide on desktop, ~280px on mobile) and rely on the browser's filter
 * compositing instead of canvas/WebGL.
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
      // Normalize cursor position relative to eye-pair center
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      // Soft normalization — clamp to viewport scale
      setCursor({
        x: Math.max(-1, Math.min(1, cx / 400)),
        y: Math.max(-1, Math.min(1, cy / 300)),
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduceMotion]);

  // Pupil shift — bounded so pupil stays within sclera
  const px = cursor.x * 14;
  const py = cursor.y * 5;

  return (
    <div ref={ref} className="eyes" aria-hidden>
      <svg
        viewBox="0 0 520 140"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        <defs>
          <filter
            id="eye-flame"
            x="-30%"
            y="-80%"
            width="160%"
            height="260%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.025 0.06"
              numOctaves="2"
              seed="2"
              result="turb"
            >
              {!reduceMotion && (
                <>
                  <animate
                    attributeName="seed"
                    values="2;7;3;9;5;2"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="baseFrequency"
                    values="0.025 0.06;0.04 0.09;0.02 0.05;0.025 0.06"
                    dur="3.2s"
                    repeatCount="indefinite"
                  />
                </>
              )}
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="turb"
              scale="9"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          <filter id="eye-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="1.6" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="iris-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="55%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
        </defs>

        <Eye cx={140} px={px} py={py} />
        <Eye cx={380} px={px} py={py} />
      </svg>
    </div>
  );
}

function Eye({ cx, px, py }: { cx: number; px: number; py: number }) {
  return (
    <g transform={`translate(${cx}, 70)`}>
      {/* Outer flame outline — distorted by feTurbulence, repeated 3x at
          decreasing opacity for layered fire feel */}
      <ellipse
        rx="92"
        ry="33"
        fill="none"
        stroke="#67e8f9"
        strokeWidth="2.5"
        filter="url(#eye-flame)"
        opacity="0.55"
      />
      <ellipse
        rx="92"
        ry="33"
        fill="none"
        stroke="#06b6d4"
        strokeWidth="1.4"
        filter="url(#eye-flame)"
        opacity="0.85"
      />
      {/* Sharp inner outline — undistorted, reads as the "real" eye edge */}
      <ellipse
        rx="92"
        ry="33"
        fill="rgba(6,182,212,0.04)"
        stroke="#06b6d4"
        strokeWidth="0.8"
      />
      {/* Iris fill (faint cyan) */}
      <ellipse
        rx="88"
        ry="29"
        fill="url(#iris-grad)"
        opacity="0.18"
      />
      {/* Vertical-slit pupil — predator signature */}
      <g transform={`translate(${px}, ${py})`}>
        <ellipse
          rx="6.5"
          ry="22"
          fill="#0a1014"
          stroke="#06b6d4"
          strokeWidth="0.6"
          filter="url(#eye-glow)"
        />
        {/* Inner glow inside pupil */}
        <ellipse
          rx="3"
          ry="16"
          fill="#06b6d4"
          opacity="0.8"
        />
        {/* Specular highlight */}
        <ellipse
          cx="-1.5"
          cy="-7"
          rx="1.4"
          ry="4"
          fill="#ecfeff"
          opacity="0.85"
        />
      </g>
    </g>
  );
}
