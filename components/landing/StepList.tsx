"use client";

import { useEffect, useState } from "react";
import { CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The list beside the steps, which stays put while they scroll past and marks
 * the one on screen. Wide screens only: on a phone each step carries its own
 * title, and a list pinned to the top would just cover it.
 */
export function StepList({ steps }: { steps: { id: string; label: string }[] }) {
  const [active, setActive] = useState(steps[0]?.id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    // A narrow band across the middle of the screen: whichever step is in it.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    for (const step of steps) {
      const node = document.getElementById(step.id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [steps]);

  return (
    <ol className="sticky top-28 space-y-3">
      {steps.map((step) => {
        const on = step.id === active;
        return (
          <li key={step.id}>
            <a
              href={`#${step.id}`}
              aria-current={on ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 text-[17px] transition-colors",
                on
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              {on && <CornerDownRight className="w-4 h-4 shrink-0" aria-hidden />}
              {step.label}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
