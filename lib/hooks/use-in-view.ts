"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Track whether a node has scrolled into the viewport at least once.
 * Sticky once true — landing-page reveals shouldn't replay on every scroll
 * back. Returns the ref to attach + the boolean state.
 */
export function useInView<T extends Element>(
  options: IntersectionObserverInit = { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setSeen(true);
          obs.disconnect();
          break;
        }
      }
    }, options);
    obs.observe(node);
    return () => obs.disconnect();
  }, [options]);

  return [ref, seen];
}
