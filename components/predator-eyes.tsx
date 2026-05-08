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

  // Scroll listener — drives a subtle parallax + pupil "look down" as
  // the user scrolls into the page. Makes the eyes feel anchored to
  // the world but tracking the viewer's gaze.
  useEffect(() => {
    if (reduceMotion) return;
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduceMotion]);

  // Pupil tracking: cursor + scroll-driven downward look (capped)
  const scrollNorm = Math.min(1, scrollY / 1200);
  const px = cursor.x * 22;
  const py = cursor.y * 8 + scrollNorm * 6; // pupils glance down as user scrolls

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
          {/* Macro flame — bold silhouette dance, visible across scroll */}
          <filter
            id="flame-macro"
            x="-50%"
            y="-150%"
            width="200%"
            height="400%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02 0.055"
              numOctaves="2"
              seed="3"
              result="t1"
            >
              {!reduceMotion && (
                <>
                  <animate
                    attributeName="seed"
                    values="3;9;2;11;5;7;3"
                    dur="1.6s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="baseFrequency"
                    values="0.02 0.055;0.035 0.085;0.015 0.04;0.02 0.055"
                    dur="2.6s"
                    repeatCount="indefinite"
                  />
                </>
              )}
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="t1"
              scale="18"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* Micro flame — fast shimmer on the silhouette */}
          <filter
            id="flame-micro"
            x="-30%"
            y="-80%"
            width="160%"
            height="260%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.09 0.2"
              numOctaves="3"
              seed="5"
              result="t2"
            >
              {!reduceMotion && (
                <>
                  <animate
                    attributeName="seed"
                    values="5;14;2;11;6;5"
                    dur="0.8s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="baseFrequency"
                    values="0.09 0.2;0.13 0.28;0.07 0.18;0.09 0.2"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                </>
              )}
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="t2"
              scale="7"
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
 * Natural feline eye path. Geometry written for the RIGHT eye (wing
 * tip at +x); LEFT eye mirrors x so each eye's outer corner points
 * AWAY from the pair's center axis.
 *
 * Proportions modelled after an actual cat at rest:
 *   - Almond ratio width:height ≈ 3.2 : 1
 *   - Outer corner sits ~12px higher than inner (alert tilt)
 *   - Top arc rises 1.7x further than bottom drops (asymmetric eyelid)
 *   - No exaggerated makeup-style wing — clean upturn only
 */
function felineEyePath(side: "left" | "right"): string {
  const flip = side === "left" ? -1 : 1;
  const X = (n: number) => n * flip;

  return [
    `M ${X(-115)} 4`,                                       // inner corner
    `C ${X(-75)} ${-22}, ${X(-25)} ${-47}, ${X(15)} ${-47}`, // top arc up
    `C ${X(70)} ${-47}, ${X(105)} ${-32}, ${X(125)} ${-18}`, // top arc bending down
    `L ${X(130)} ${-8}`,                                     // outer corner (slight upturn)
    `C ${X(105)} 16, ${X(50)} 27, ${X(0)} 27`,                // bottom arc
    `C ${X(-55)} 25, ${X(-98)} 18, ${X(-115)} 4`,             // back to inner
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
  const flip = side === "left" ? -1 : 1;
  const X = (n: number) => n * flip;
  // Slightly inset path that fills the eye with cyan iris gradient
  const d = [
    `M ${X(-105)} 4`,
    `C ${X(-68)} ${-18}, ${X(-22)} ${-42}, ${X(15)} ${-42}`,
    `C ${X(64)} ${-42}, ${X(96)} ${-28}, ${X(115)} ${-15}`,
    `L ${X(118)} ${-7}`,
    `C ${X(95)} 14, ${X(45)} 24, ${X(0)} 24`,
    `C ${X(-50)} 22, ${X(-90)} 16, ${X(-105)} 4`,
    `Z`,
  ].join(" ");
  return <path d={d} fill="url(#iris-grad)" opacity="0.32" />;
}
