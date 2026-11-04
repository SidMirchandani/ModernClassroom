"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 1500;

/**
 * A number that runs to its value the first time it is scrolled to. Without
 * JavaScript, or with less motion asked for, it is simply the value.
 */
export function CountTo({
  from,
  to,
  prefix = "",
  suffix = "",
  suffixOne,
}: {
  from: number;
  to: number;
  prefix?: string;
  suffix?: string;
  /** The word when the number is exactly 1. */
  suffixOne?: string;
}) {
  const [value, setValue] = useState(to);
  const node = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const target = node.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setValue(from);
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        const started = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - started) / DURATION_MS);
          const eased = 1 - Math.pow(1 - t, 4);
          setValue(Math.round(from + (to - from) * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(target);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [from, to]);

  const word = value === 1 && suffixOne !== undefined ? suffixOne : suffix;
  return (
    <span ref={node} className="tabular-nums">
      {prefix}
      {value}
      {word}
    </span>
  );
}
