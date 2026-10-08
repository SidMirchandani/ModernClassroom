"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    ready: Promise<void>;
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

    // flushSync so the snapshot the browser takes "after" really has the new
    // theme in it — including this button's own icon.
    const transition = doc.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });

    transition.ready
      .then(() => {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 560,
            // An even ease-in-out, not an ease-out: a strong ease-out covers
            // most of the screen at once and then crawls through the far
            // corner, which reads as the circle stalling three-quarters in.
            easing: "cubic-bezier(0.45, 0, 0.55, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => {});

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
