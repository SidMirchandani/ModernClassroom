"use client";

import type { ReactNode } from "react";
import { useOverlayTransition } from "@/lib/use-overlay-transition";
import { cn } from "@/lib/utils";

interface CollapseProps {
  open: boolean;
  children: ReactNode;
  /** Applied to the content box, where padding and borders belong. */
  className?: string;
}

/**
 * A section that slides open to exactly its height and slides shut again.
 *
 * Mounted only while open or closing, like the overlays: a closed track can
 * hold videos and embeds, and keeping every one of them alive off-screen
 * would load all of them on every page. Something already open on first
 * render appears open — there is nothing to animate from.
 */
export function Collapse({ open, children, className }: CollapseProps) {
  const { mounted, shown } = useOverlayTransition(open, 420);
  if (!mounted) return null;

  return (
    <div className={cn("collapse-grid", shown && "is-open")} inert={!open}>
      <div>
        <div className={className}>{children}</div>
      </div>
    </div>
  );
}
