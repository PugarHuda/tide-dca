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

          {/* Per-eye clipPaths in LOCAL coordinate space (origin = eye center).
              Each clipPath is referenced inside its eye's transform group so
              the path coords align with the iris inset bowl. Pupil never
              escapes the visible eye outline regardless of cursor position. */}
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

        <FelineEye cx={220} side="left" px={px} py={py} />
        <FelineEye cx={540} side="right" px={px} py={py} />
      </svg>
    </div>
  );
}

/**
 * Sharp feline eye path with explicit pointed corners. Geometry for
 * the RIGHT eye; LEFT mirrors x so each eye's outer corner points
 * away from the pair's center.
 *
 * Sharpness trick: straight L segments enter and leave each tip at
 * different angles, so the corner stays a true point. Smooth cubic
 * curves only fill the top + bottom arcs between the tips. This
 * survives the turbulence displacement filter — the inner sharp
 * outline reads clearly even when the outer flame layers smear.
 *
 * Proportions:
 *   - Width:height ≈ 3.4 : 1
 *   - Outer corner ~14px higher than inner (alert predator tilt)
 *   - Both tips meet the arcs at ~70° corner angles → pointed
 */
function felineEyePath(side: "left" | "right"): string {
  const flip = side === "left" ? -1 : 1;
  const X = (n: number) => n * flip;

  return [
    `M ${X(-118)} 6`,                                       // inner tip (sharp point)
    `L ${X(-92)} ${-12}`,                                   // straight up-out from inner
    `C ${X(-50)} ${-42}, ${X(20)} ${-50}, ${X(75)} ${-46}`,  // top apex curve
    `C ${X(105)} ${-42}, ${X(122)} ${-30}, ${X(130)} ${-16}`, // approach outer
    `L ${X(132)} ${-8}`,                                     // outer tip apex
    `L ${X(124)} 2`,                                         // sharp turn at outer
    `C ${X(108)} 18, ${X(55)} 28, ${X(0)} 28`,                // bottom arc
    `C ${X(-55)} 26, ${X(-92)} 18, ${X(-104)} 14`,            // approach inner from below
    `L ${X(-118)} 6`,                                         // close to inner tip
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

      {/* Pupil — vertical slit, tracks cursor, clipped to iris bowl
          so it never escapes the visible eye outline. */}
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

function FelineIris({ side }: { side: "left" | "right" }) {
  const flip = side === "left" ? -1 : 1;
  const X = (n: number) => n * flip;
  // Slightly inset version of the outline path — drives both the iris
  // fill and the pupil clipPath. Inset ~6px so the iris doesn't bleed
  // through the sharp outline stroke.
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

/** Same shape as FelineIris but exposed as a string for clipPath use. */
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
