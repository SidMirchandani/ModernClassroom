"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useOverlayTransition } from "@/lib/use-overlay-transition";
import { cn } from "@/lib/utils";

interface Props {
  /** Contents of the trigger button, or a function of the open state. */
  label: ReactNode | ((open: boolean) => ReactNode);
  triggerClassName?: string | ((open: boolean) => string);
  triggerTitle?: string;
  /** Sets `data-accent` on the trigger, so its ring can be someone's colour. */
  triggerAccent?: string;
  align?: "left" | "right";
  /** Panel width in pixels — panels are anchored, not stretched to the trigger. */
  width?: number;
  panelClassName?: string;
  children: (close: () => void) => ReactNode;
}

/**
 * A button with a panel hung off it. Like the dropdown, the panel renders
 * through a portal so a card with `overflow-hidden` or a horizontally
 * scrolling table cannot clip it, and it re-places itself on scroll.
 */
export function Popover({
  label,
  triggerClassName,
  triggerTitle,
  triggerAccent,
  align = "right",
  width = 320,
  panelClassName,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const { mounted, shown } = useOverlayTransition(open, 220);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  // Anchored to the trigger, then pulled back inside the viewport — on a phone
  // a right-aligned panel would otherwise hang off the edge.
  let left = 0;
  if (rect) {
    const raw = align === "right" ? rect.right - width : rect.left;
    const max = (typeof window !== "undefined" ? window.innerWidth : width) - width - 8;
    left = Math.max(8, Math.min(raw, Math.max(8, max)));
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={triggerTitle}
        data-accent={triggerAccent}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={typeof triggerClassName === "function" ? triggerClassName(open) : triggerClassName}
      >
        {typeof label === "function" ? label(open) : label}
      </button>

      {mounted &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            style={{
              position: "fixed",
              top: rect.bottom + 8,
              left,
              width,
              maxHeight: `calc(100vh - ${rect.bottom + 24}px)`,
            }}
            className={cn(
              "z-[200] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 float-pane-raised shadow-z5",
              "overlay-panel",
              shown && "is-shown",
              panelClassName
            )}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body
        )}
    </>
  );
}
