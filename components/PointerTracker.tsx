"use client";

import { useEffect } from "react";

/** Everything that wants to know where the pointer is over it. */
const TARGETS = "[data-pointer], .card-interactive, .edge-glow";

/**
 * Writes the pointer's position, as `--mx` / `--my` relative to each element,
 * onto every hover-aware surface under it — the card whose edge lights up
 * where the cursor is, and the line-art grid inside it that brightens beneath
 * the cursor. Nested targets each get their own coordinates, which is why it
 * walks up the tree rather than stopping at the first match.
 *
 * One listener for the whole app, one write per animation frame, and nothing
 * at all on touch screens, where there is no pointer to follow.
 */
export function PointerTracker() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches) return;

    let frame = 0;
    let last: PointerEvent | null = null;

    const paint = () => {
      frame = 0;
      if (!last) return;
      let el = (last.target as Element | null)?.closest?.(TARGETS) as HTMLElement | null;
      while (el) {
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${last.clientX - rect.left}px`);
        el.style.setProperty("--my", `${last.clientY - rect.top}px`);
        el = el.parentElement?.closest(TARGETS) as HTMLElement | null;
      }
    };

    const onMove = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
