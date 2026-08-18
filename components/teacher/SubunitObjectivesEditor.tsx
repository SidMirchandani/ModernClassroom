"use client";

import type { Section } from "@/lib/types";
import { ObjectiveListEditor } from "./ObjectiveListEditor";

interface SubunitObjectivesEditorProps {
  section: Section;
  onChange: (section: Section) => void;
  onSave: (section: Section) => void;
}

/** Targets that hold across every resource in the section. */
export function SubunitObjectivesEditor({
  section,
  onChange,
  onSave,
}: SubunitObjectivesEditorProps) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
        Learning Objectives
      </h2>
      <ObjectiveListEditor
        objectives={section.objectives}
        onChange={(objectives) => onChange({ ...section, objectives })}
        onSave={(objectives) => onSave({ ...section, objectives })}
      />
    </section>
  );
}
