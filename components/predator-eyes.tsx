"use client";

import { memo, useEffect, useRef, useState } from "react";

/**
 * Fire eyes — hybrid canvas + SVG.
 *
 * Canvas (behind): particle system that emits from points along each
 * eye outline. Particles rise upward + drift outward, fade over their
 * lifetime, render with additive blending so overlapping particles
 * brighten — the classic technique for realistic fire on web. Reads as
 * actual flame licking off the outline, not a stylized triangle.
 *
 * SVG (on top): sharp cat-eye outline + iris + cursor-tracking pupil.
 * The outline stays crisp and predator-shaped; the canvas fills in the
 * fire energy around and rising from it.
 *
 * Why this combination instead of pure SVG: SVG primitives (paths,
 * filters, animated d-attribute) can stylize but cannot do organic
 * particle motion at the density needed to read as real fire. Canvas
 * 2D with `globalCompositeOperation: "lighter"` is the standard
 * approach and is GPU-accelerated in modern browsers.
 *
 * Refs informing this approach:
 *   - thecodeplayer.com/walkthrough/html5-canvas-experiment-a-cool-flame-fire-effect-using-particles
 *   - davepagurek.com/blog/fire-particles-for-html5-canvas
 */

// ─── Geometry: cat-eye outline path (shared with SVG render) ────────────────

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

// SVG viewBox coords. Eye centers at (220, 130) and (540, 130) in 760×260.
const VIEW_W = 760;
const VIEW_H = 260;
const EYE_CENTERS = [
  { x: 220, y: 130 }, // left of pair
  { x: 540, y: 130 }, // right of pair
];

/**
 * Sample a point on the cat-eye outline at parametric angle θ in [0, 2π).
 * Returns local coords centered at (0, 0). The outline isn't a true
 * ellipse — top is taller than bottom, asymmetric like the SVG path.
 */
function eyeOutlinePoint(theta: number): { x: number; y: number; nx: number; ny: number } {
  // Width: ~125, top height: ~47, bottom height: ~28
  // θ = 0 → outer corner (right), π/2 → bottom, π → inner corner, 3π/2 → top
  const a = 125; // semi-major (horizontal)
  const topB = 47;
  const botB = 28;

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const b = sinT > 0 ? botB : topB; // sin > 0 = below center (positive y)

  const x = a * cosT;
  const y = b * sinT;

  // Outward normal — for an ellipse, normal at (a cos θ, b sin θ) points
  // along (b cos θ, a sin θ) normalized
  const nxRaw = b * cosT;
  const nyRaw = a * sinT;
  const len = Math.sqrt(nxRaw * nxRaw + nyRaw * nyRaw) || 1;
  return { x, y, nx: nxRaw / len, ny: nyRaw / len };
}

// ─── Particle system ───────────────────────────────────────────────────────

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;     // 0..1, 1 = dead
  maxLife: number;  // seconds
  size: number;
  hot: number;      // 0..1, brightness boost
};

const MAX_PARTICLES = 480;

function emitParticle(
  particles: Particle[],
  eyeCenter: { x: number; y: number },
  side: "left" | "right",
): void {
  if (particles.length >= MAX_PARTICLES) return;
  // Bias spawning toward the top half of the outline (fire rises from
  // the rim, more of it visible at the top).
  let theta: number;
  const r = Math.random();
  if (r < 0.6) {
    // top half: 3π/2 ± π/2
    theta = Math.PI * 1.5 + (Math.random() - 0.5) * Math.PI;
  } else if (r < 0.85) {
    // outer corner area
    theta = Math.PI * 2 - Math.random() * Math.PI * 0.4;
    if (side === "left") theta = Math.PI - theta;
  } else {
    // bottom half (less)
    theta = Math.random() * Math.PI;
  }

  const local = eyeOutlinePoint(theta);
  const x = eyeCenter.x + local.x;
  const y = eyeCenter.y + local.y;

  // Initial velocity: outward push + strong upward bias (fire rises)
  // px/sec in local SVG coordinate space (will be scaled by canvas DPR)
  const speed = 8 + Math.random() * 14;
  const upwardBias = 35 + Math.random() * 30;
  const jitter = (Math.random() - 0.5) * 8;

  particles.push({
    x,
    y,
    vx: local.nx * speed + jitter,
    vy: local.ny * speed * 0.4 - upwardBias, // dampen outward y, bias up
    life: 0,
    maxLife: 0.7 + Math.random() * 0.6,
    size: 6 + Math.random() * 9,
    hot: Math.random() * 0.4 + 0.6,
  });
}

function updateParticles(particles: Particle[], dt: number): Particle[] {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // Anti-gravity: continuous upward acceleration
    p.vy -= 22 * dt;
    // Horizontal drag
    p.vx *= Math.pow(0.5, dt);
    // Slight horizontal drift jitter for organic motion
    p.vx += (Math.random() - 0.5) * 8 * dt;
    p.life += dt / p.maxLife;
    // Particles shrink as they age + rise (visual taper at flame tip)
    p.size *= Math.pow(0.85, dt);
  }
  return particles.filter((p) => p.life < 1);
}

function renderParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  scale: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const p of particles) {
    const lifeRatio = p.life;       // 0 = young, 1 = dead
    const ageOpacity = (1 - lifeRatio) * 0.85;
    if (ageOpacity < 0.02) continue;

    const size = p.size * scale * (1 - lifeRatio * 0.4);
    if (size < 1) continue;

    // Color: white-hot core when young → cyan when older → dark when dying
    // Use a 3-stop radial gradient for the soft fire glow
    const hot = p.hot * (1 - lifeRatio * 0.7);
    const innerR = Math.floor(180 + hot * 75);  // 180..255
    const innerG = Math.floor(230 + hot * 25);  // 230..255
    const innerB = 255;
    const innerA = ageOpacity * 0.95;

    const midR = 80;
    const midG = 200;
    const midB = 230;
    const midA = ageOpacity * 0.5;

    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
    grad.addColorStop(0, `rgba(${innerR},${innerG},${innerB},${innerA})`);
    grad.addColorStop(0.45, `rgba(${midR},${midG},${midB},${midA})`);
    grad.addColorStop(1, "rgba(8,30,50,0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PredatorEyes() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  // Canvas particle loop. Deliberately decoupled from React state — the
  // animation runs entirely inside the effect's closure, no re-render
  // dependencies that could restart it.
  useEffect(() => {
    if (reduceMotion) return;
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: Particle[] = [];
    let lastTime = performance.now();
    let raf = 0;
    let cwScale = 1;

    const fitCanvas = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      // Convert SVG-space (760 wide) coordinates to canvas-pixel space.
      // We render particles in SVG coords, then scale.
      cwScale = (rect.width * dpr) / VIEW_W;
      ctx.setTransform(cwScale, 0, 0, cwScale, 0, 0);
    };
    fitCanvas();

    const onResize = () => fitCanvas();
    window.addEventListener("resize", onResize);

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Emit ~5 particles per eye per frame at 60fps (capped at MAX)
      const emitCount = Math.max(1, Math.floor(dt * 240));
      for (const eye of EYE_CENTERS) {
        for (let i = 0; i < emitCount; i++) {
          emitParticle(particles, eye, eye.x < VIEW_W / 2 ? "left" : "right");
        }
      }

      const live = updateParticles(particles, dt);
      // Replace array contents in place to keep ref stable
      particles.length = 0;
      particles.push(...live);

      // Clear with subtle fade for trailing glow effect (real fire has trails)
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.setTransform(cwScale, 0, 0, cwScale, 0, 0);

      renderParticles(ctx, particles, 1);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [reduceMotion]);

  // Cursor + scroll listeners for pupil tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
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
    <div ref={wrapperRef} className="eyes" aria-hidden>
      <canvas ref={canvasRef} className="eyes-canvas" />
      <svg
        className="eyes-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
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

          <clipPath id="clip-eye-left" clipPathUnits="userSpaceOnUse">
            <path d={felineClipPath("left")} />
          </clipPath>
          <clipPath id="clip-eye-right" clipPathUnits="userSpaceOnUse">
            <path d={felineClipPath("right")} />
          </clipPath>
        </defs>

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
      {/* Sharp inner outline — undistorted, the "real" predator edge */}
      <path
        d={path}
        fill="rgba(8,30,40,0.45)"
        stroke="#06b6d4"
        strokeWidth="1.8"
      />
      {/* Iris fill */}
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
