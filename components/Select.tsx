"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  className?: string;
  size?: "sm" | "default";
}

/**
 * A real dropdown rather than a native `<select>`. The browser draws a native
 * option list with its own font and highlight colour that no CSS reaches, so
 * anywhere a teacher sees the list we draw it ourselves.
 *
 * The panel renders through a portal: these live inside tables with
 * `overflow-x-auto` and cards with `overflow-hidden`, which would otherwise
 * clip an absolutely-positioned menu.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = "Select…",
  title,
  className,
  size = "default",
}: Props) {
  const [open, setOpen] = useState(false);
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
    // Anchored to the viewport, so any scroll or resize has to re-place it.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const selected = options.find((o) => o.value === value);

  // Flip above the trigger when there is not enough room below it.
  const estimatedHeight = Math.min(options.length * 36 + 8, 264);
  const openUp =
    rect !== null && rect.bottom + estimatedHeight > window.innerHeight && rect.top > estimatedHeight;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full inline-flex items-center justify-between gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-left transition-colors hover:border-slate-300 dark:hover:border-slate-600",
          size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
          open && "border-primary",
          className
        )}
      >
        <span
          className={cn(
            "truncate",
            selected
              ? "text-slate-700 dark:text-slate-200"
              : "text-slate-400 dark:text-slate-500"
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{
              position: "fixed",
              left: rect.left,
              minWidth: rect.width,
              ...(openUp
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.bottom + 4 }),
            }}
            className="z-[200] max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 float-pane-raised shadow-z5 py-1"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 pl-3 pr-2 py-2 text-sm text-left whitespace-nowrap transition-colors hover:bg-slate-50 dark:hover:bg-slate-800",
                    isSelected
                      ? "text-primary dark:text-primary-glow font-medium"
                      : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  <span className="flex-1">{option.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
