"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useOverlayTransition } from "@/lib/use-overlay-transition";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * A centred popup. The page behind is **blurred, never darkened** — the blur
 * ramps in and out with the dialog rather than snapping on, and because that
 * blur is what separates the dialog from the page, the dialog has no shadow.
 */
export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const { mounted, shown } = useOverlayTransition(open, 300);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Held for as long as the overlay is on screen, closing animation included —
  // releasing it early snaps the scrollbar back mid-transition.
  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mounted]);

  // Drives the page blur. Keyed on `shown` rather than `mounted` so the blur
  // ramps in and out in step with the dialog; the page keeps unblurring after
  // the dialog has gone, which is what makes the close feel like one motion.
  useEffect(() => {
    if (!shown) return;
    document.body.classList.add("overlay-open");
    return () => document.body.classList.remove("overlay-open");
  }, [shown]);

  if (!mounted || typeof document === "undefined") return null;

  // Through a portal, always. A `fixed` overlay is contained by any ancestor
  // with a filter or a transform — the To-Do button lives inside the blurred
  // class strip, which was trapping the whole popup inside that 44px band.
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className={cn("absolute inset-0 overlay-backdrop", shown && "is-shown")}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 float-pane-raised flex flex-col",
          "overlay-panel",
          shown && "is-shown",
          className
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
