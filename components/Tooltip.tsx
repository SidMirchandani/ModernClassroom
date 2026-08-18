"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOverlayTransition } from "@/lib/use-overlay-transition";
import { cn } from "@/lib/utils";

interface Props {
  /** What the thing being hovered means. */
  label: ReactNode;
  children: ReactNode;
  /** Applied to the wrapper that carries the hover, not to the tip. */
  className?: string;
}

const WIDTH = 220;

/**
 * A styled hover explanation, in place of the browser's native `title` bubble —
 * which arrives late, in the OS font, and cannot be read on a dark page. It
 * portals to `<body>` so a table cell cannot clip it, and it never takes the
 * pointer, so hovering the tip cannot steal the hover from the thing under it.
 */
export function Tooltip({ label, children, className }: Props) {
  const [open, setOpen] = useState(false);
  const { mounted, shown } = useOverlayTransition(open, 150);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  const place = useCallback(() => {
    if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  // Above by default; below when the top of the viewport is in the way.
  const below = rect !== null && rect.top < 64;
  let left = 0;
  if (rect) {
    const centred = rect.left + rect.width / 2 - WIDTH / 2;
    const max = (typeof window !== "undefined" ? window.innerWidth : WIDTH) - WIDTH - 8;
    left = Math.max(8, Math.min(centred, Math.max(8, max)));
  }

  return (
    <>
      <span
        ref={anchorRef}
        className={className}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>

      {mounted &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left,
              width: WIDTH,
              ...(below ? { top: rect.bottom + 8 } : { bottom: window.innerHeight - rect.top + 8 }),
            }}
            className={cn(
              "z-[250] pointer-events-none px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 float-pane-raised shadow-z5",
              "text-xs leading-snug text-slate-600 dark:text-slate-300 text-left",
              "overlay-panel",
              shown && "is-shown"
            )}
          >
            {label}
          </div>,
          document.body
        )}
    </>
  );
}
