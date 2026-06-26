"use client";

import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export type SubunitViewMode = "edit" | "student";

interface SubunitViewToggleProps {
  mode: SubunitViewMode;
  onChange: (mode: SubunitViewMode) => void;
}

export function SubunitViewToggle({ mode, onChange }: SubunitViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
      <button
        type="button"
        onClick={() => onChange("edit")}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          mode === "edit"
            ? "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300"
            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        )}
      >
        <Pencil className="w-3.5 h-3.5" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => onChange("student")}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          mode === "student"
            ? "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300"
            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        )}
      >
        <Eye className="w-3.5 h-3.5" />
        Student view
      </button>
    </div>
  );
}
