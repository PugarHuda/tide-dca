"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animate a number from 0 (or from previous value) to `target` over
 * `durationMs`. Uses requestAnimationFrame with an ease-out cubic.
 *
 * Stable across re-renders: when `target` changes, animates from the
 * current displayed value to the new target rather than restarting at 0.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === value) return;
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
    }
    startTimeRef.current = null;
    startValueRef.current = value;

    const tick = (now: number) => {
      if (startTimeRef.current == null) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out cubic — fast start, gentle finish
      const eased = 1 - Math.pow(1 - t, 3);
      const next =
        startValueRef.current + (target - startValueRef.current) * eased;
      setValue(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
