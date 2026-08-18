"use client";

import { useEffect } from "react";
import type { AccentId } from "./class-appearance";

/**
 * Re-points the whole `primary` ramp at one class's colour for as long as a
 * class page is open. The attribute goes on `<html>` rather than the page's own
 * root because overlays — modals, popovers, tooltips — portal out to `<body>`,
 * and a dialog opened from a green class must not come back blue.
 */
export function useClassTheme(color?: AccentId | null) {
  useEffect(() => {
    const root = document.documentElement;
    if (!color || color === "blue") {
      root.removeAttribute("data-accent");
      return;
    }
    root.setAttribute("data-accent", color);
    return () => root.removeAttribute("data-accent");
  }, [color]);
}
