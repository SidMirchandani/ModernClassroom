"use client";

import { Plus, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { Section } from "@/lib/types";

interface SubunitObjectivesEditorProps {
  section: Section;
  onChange: (section: Section) => void;
  onSave: (section: Section) => void;
}

export function SubunitObjectivesEditor({
  section,
  onChange,
  onSave,
}: SubunitObjectivesEditorProps) {
  function updateText(index: number, text: string) {
    onChange({
      ...section,
      objectives: section.objectives.map((obj, i) =>
        i === index ? { ...obj, text } : obj
      ),
    });
  }

  function saveText(index: number, text: string) {
    const next = {
      ...section,
      objectives: section.objectives.map((obj, i) =>
        i === index ? { ...obj, text } : obj
      ),
    };
    onChange(next);
    onSave(next);
  }

  function removeObjective(index: number) {
    const next = {
      ...section,
      objectives: section.objectives.filter((_, i) => i !== index),
    };
    onChange(next);
    onSave(next);
  }

  function addObjective() {
    const next = {
      ...section,
      objectives: [...section.objectives, { id: uuidv4(), text: "" }],
    };
    onChange(next);
    onSave(next);
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
        Learning objectives
      </h2>

      {section.objectives.length === 0 ? (
        <p className="text-sm text-slate-400 italic mb-3">No objectives yet.</p>
      ) : (
        <ul className="space-y-2">
          {section.objectives.map((obj, i) => (
            <li key={obj.id} className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0"
                aria-hidden
              />
              <input
                type="text"
                value={obj.text}
                onChange={(e) => updateText(i, e.target.value)}
                onBlur={(e) => saveText(i, e.target.value)}
                placeholder="Write a learning objective…"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              <button
                type="button"
                onClick={() => removeObjective(i)}
                className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
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
        onClick={addObjective}
        className="mt-3 text-sm text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Add objective
      </button>
    </section>
  );
}
