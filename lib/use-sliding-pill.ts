"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Positions one highlight under whichever item in a container carries
 * `data-active="true"`, so a tab bar's selection slides between tabs instead
 * of jumping. Re-measures when the active key changes and whenever the
 * container resizes (a font loading, a label changing, the window narrowing).
 *
 * The first placement is instant — a pill that slid in from the left edge on
 * every page load would be motion with nothing behind it.
 */
export function useSlidingPill<T extends HTMLElement>(activeKey: string) {
  const containerRef = useRef<T>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const active = container.querySelector<HTMLElement>('[data-active="true"]');
      setBox(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeKey]);

  // Flipped after the first box has painted, so only later moves animate.
  useLayoutEffect(() => {
    if (!box || placed.current) return;
    const id = requestAnimationFrame(() => {
      placed.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [box]);

  const style: CSSProperties | undefined = box
    ? {
        left: box.left,
        width: box.width,
        transition: placed.current ? undefined : "none",
      }
    : undefined;

  return { containerRef, pillStyle: style, ready: box !== null };
}
