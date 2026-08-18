"use client";

import { useEffect, useState } from "react";

/**
 * Keeps an overlay in the DOM long enough to animate out. `mounted` says
 * whether to render it at all; `shown` is the flag the transition classes read,
 * and it only flips a frame after mounting so there is something to move from.
 */
export function useOverlayTransition(open: boolean, duration = 180) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames, not one: a single rAF can still run before the browser has
      // painted the hidden state, and the transition then has nothing to move
      // from — the overlay snaps to its end state. The timer is a backstop for
      // a tab that is not painting at all, where rAF is throttled.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      const fallback = setTimeout(() => setShown(true), 60);
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
        clearTimeout(fallback);
      };
    }

    setShown(false);
    const timer = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(timer);
  }, [open, duration]);

  return { mounted, shown };
}
