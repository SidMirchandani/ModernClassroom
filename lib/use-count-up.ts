"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that runs up to its value instead of appearing at it, and runs
 * from the old value to the new one when it changes — a student finishing a
 * section ticks the class average up rather than swapping it.
 *
 * Strings pass straight through, so a caller can hand over "—" or a value
 * with a suffix ("72%") and only the digits move.
 */
export function useCountUp(value: string | number, duration = 900): string {
  const target = parse(value);
  const [shown, setShown] = useState(target ? 0 : null);
  const from = useRef(0);

  useEffect(() => {
    if (!target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(target.number);
      from.current = target.number;
      return;
    }

    const start = performance.now();
    const origin = from.current;
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutExpo: most of the distance early, then a long gentle settle.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const current = origin + (target.number - origin) * eased;
      setShown(current);
      from.current = current;
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target?.number, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target || shown === null) return String(value);
  return `${target.prefix}${Math.round(shown)}${target.suffix}`;
}

function parse(value: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? { prefix: "", number: value, suffix: "" } : null;
  }
  const match = value.match(/^(\D*)(-?\d+)(\D*)$/);
  return match ? { prefix: match[1], number: Number(match[2]), suffix: match[3] } : null;
}
