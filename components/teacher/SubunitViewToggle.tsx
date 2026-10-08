"use client";

import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSlidingPill } from "@/lib/use-sliding-pill";

export type SubunitViewMode = "edit" | "student";

interface SubunitViewToggleProps {
  mode: SubunitViewMode;
  onChange: (mode: SubunitViewMode) => void;
}

const OPTIONS: { id: SubunitViewMode; label: string; icon: typeof Pencil }[] = [
  { id: "edit", label: "Edit", icon: Pencil },
  { id: "student", label: "Student view", icon: Eye },
];

export function SubunitViewToggle({ mode, onChange }: SubunitViewToggleProps) {
  const { containerRef, pillStyle, ready } = useSlidingPill<HTMLDivElement>(mode);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5"
    >
      {ready && (
        <span
          aria-hidden
          style={pillStyle}
          className="tab-pill rounded-md border border-primary/30"
        />
      )}
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            data-active={active}
            onClick={() => onChange(id)}
            className={cn(
              "relative z-[1] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-300",
              active
                ? cn(
                    "text-primary dark:text-primary-glow",
                    !ready && "border border-primary/30"
                  )
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
