"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    finished: Promise<void>;
  };
};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  /**
   * The new theme grows out of the button as a circle, via the View
   * Transitions API: the browser snapshots the page, the theme flips
   * underneath, and the new snapshot is revealed through an expanding clip.
   * Where the API is missing it simply switches, which is what it did before.
   */
  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next = isDark ? "light" : "dark";
    const doc = document as ViewTransitionDocument;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!doc.startViewTransition || still) {
      setTheme(next);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // Every other transition is switched off for the length of the switch.
    // Cards, buttons and fields all ease their colours over ~200ms, and the
    // new snapshot is live — so inside the circle the theme was still fading
    // in as the circle grew, and the page seemed to finish after the circle
    // did. With them off, what the circle reveals is already final.
    const root = document.documentElement;
    root.classList.add("theme-switching");

    // The circle itself is a CSS animation on the transition (globals.css,
    // `theme-reveal`); this only tells it where to grow from and how far.
    // It used to be started from here with element.animate() once the
    // transition was ready — but a transition ends when the browser's own
    // animations do (~250ms), and an animation added from script did not
    // always hold it open: on phones the circle got about halfway and the
    // page snapped to the new theme. Declared in CSS, it *is* one of the
    // transition's animations, so the transition lasts exactly as long.
    root.style.setProperty("--vt-x", `${x}px`);
    root.style.setProperty("--vt-y", `${y}px`);
    root.style.setProperty("--vt-r", `${radius}px`);

    // flushSync so the snapshot the browser takes "after" really has the new
    // theme in it — including this button's own icon.
    const transition = doc.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });

    transition.finished
      .catch(() => {})
      .finally(() => root.classList.remove("theme-switching"));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      suppressHydrationWarning
      className="group w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      aria-label="Toggle theme"
    >
      <span className="relative w-4 h-4">
        <Sun
          className={cn(
            "absolute inset-0 w-4 h-4 text-slate-600 dark:text-slate-300 transition-all duration-500 ease-[cubic-bezier(0.34,1.36,0.64,1)]",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 w-4 h-4 text-slate-600 dark:text-slate-300 transition-all duration-500 ease-[cubic-bezier(0.34,1.36,0.64,1)]",
            isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
          )}
        />
      </span>
    </button>
  );
}
