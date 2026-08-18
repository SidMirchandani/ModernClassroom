"use client";

import { Plus, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { SectionObjective } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  objectives: SectionObjective[];
  onChange: (objectives: SectionObjective[]) => void;
  onSave: (objectives: SectionObjective[]) => void;
  placeholder?: string;
  addLabel?: string;
  emptyLabel?: string;
  dotClass?: string;
  compact?: boolean;
}

/**
 * Editable list of learning targets. Used both for a section's shared
 * objectives and for the CED targets that hang off a single resource.
 */
export function ObjectiveListEditor({
  objectives,
  onChange,
  onSave,
  placeholder = "Write a learning objective…",
  addLabel = "Add Objective",
  emptyLabel = "No objectives yet.",
  dotClass = "bg-primary",
  compact = false,
}: Props) {
  function replaceAt(index: number, text: string): SectionObjective[] {
    return objectives.map((obj, i) => (i === index ? { ...obj, text } : obj));
  }

  return (
    <div>
      {objectives.length === 0 ? (
        <p className="text-sm text-slate-400 italic mb-3">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {objectives.map((obj, i) => (
            <li key={obj.id} className="flex items-center gap-2">
              <span
                className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotClass)}
                aria-hidden
              />
              <input
                type="text"
                value={obj.text}
                onChange={(e) => onChange(replaceAt(i, e.target.value))}
                onBlur={(e) => onSave(replaceAt(i, e.target.value))}
                placeholder={placeholder}
                className={cn(
                  "flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20",
                  compact ? "px-2.5 py-1.5 text-sm" : "px-3 py-2 text-sm"
                )}
              />
              <button
                type="button"
                onClick={() => onSave(objectives.filter((_, j) => j !== i))}
                className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
                title="Remove objective"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => onSave([...objectives, { id: uuidv4(), text: "" }])}
        className="mt-3 text-sm text-primary dark:text-primary-glow hover:underline flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />
        {addLabel}
      </button>
    </div>
  );
}
