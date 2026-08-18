"use client";

import type { Section } from "@/lib/types";

interface Props {
  section: Section;
  onChange: (section: Section) => void;
  onSave: (section: Section) => void;
}

/**
 * When this section is meant to be finished by. Kept as free text so
 * "10/12 or 10/13" survives intact.
 */
export function SubunitScheduleEditor({ section, onChange, onSave }: Props) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
        Due Date
      </h2>
      <p className="text-xs text-slate-400 dark:text-slate-600 mb-3">
        A soft due date students can plan around — it never locks anything on its own.
        Use the progress gate for that.
      </p>

      <input
        type="text"
        value={section.date ?? ""}
        onChange={(e) => onChange({ ...section, date: e.target.value })}
        onBlur={(e) => onSave({ ...section, date: e.target.value })}
        placeholder="e.g. 10/12 or 10/13"
        className="w-full max-w-xs px-3 h-11 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </section>
  );
}
