"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * The wheel glides rather than jumps, on the landing page only: anywhere people
 * work, scrolling should do exactly what it always does. Touch screens already
 * glide, so they are left alone, and so is anyone who asks for less motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.085, anchors: { offset: -88 } });
    return () => lenis.destroy();
  }, []);
  return null;
}
