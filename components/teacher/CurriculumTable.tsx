"use client";

import type { CurriculumUnit } from "@/lib/db/types";
import type { Checkpoint, CheckpointKind, Section } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CurriculumTableProps {
  units: CurriculumUnit[];
}

const CHECKPOINT_CHIP: Record<CheckpointKind, string> = {
  quiz: "border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300",
  test: "border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300",
  checkpoint: "border-primary/30 text-primary dark:text-primary-glow",
  project: "border-violet-200 dark:border-violet-900 text-violet-700 dark:text-violet-300",
};

type Entry = { kind: "subunit"; section: Section } | { kind: "checkpoint"; checkpoint: Checkpoint };

/**
 * A unit in course order: quizzes and tests sit where they fall — after the
 * subunit they follow — rather than in a column of their own. Checkpoints
 * pinned to no subunit come first; one naming a subunit that is not there
 * any more goes last rather than disappearing.
 */
function courseOrder(unit: CurriculumUnit): Entry[] {
  const checkpoints = unit.checkpoints ?? [];
  const ids = new Set(unit.subunits.map((s) => s.id));
  const entries: Entry[] = checkpoints
    .filter((c) => c.afterSectionId === null)
    .map((checkpoint) => ({ kind: "checkpoint", checkpoint }));
  for (const section of unit.subunits) {
    entries.push({ kind: "subunit", section });
    for (const checkpoint of checkpoints.filter((c) => c.afterSectionId === section.id)) {
      entries.push({ kind: "checkpoint", checkpoint });
    }
  }
  for (const checkpoint of checkpoints) {
    if (checkpoint.afterSectionId !== null && !ids.has(checkpoint.afterSectionId)) {
      entries.push({ kind: "checkpoint", checkpoint });
    }
  }
  return entries;
}

/**
 * The curriculum, to read. Changing it is done by uploading an updated file
 * (the card above), not by hand here: one way to change it, and nothing
 * here to set off by accident.
 */
export function CurriculumTable({ units }: CurriculumTableProps) {
  function renderEntries(unit: CurriculumUnit) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {courseOrder(unit).map((entry) =>
          entry.kind === "subunit" ? (
            <span
              key={entry.section.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <span className="font-mono text-xs text-slate-400">{entry.section.id}</span>
              {entry.section.title}
              {entry.section.date && <span className="text-[10px] text-slate-400">{entry.section.date}</span>}
            </span>
          ) : (
            <span
              key={entry.checkpoint.id}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border",
                CHECKPOINT_CHIP[entry.checkpoint.kind]
              )}
            >
              {entry.checkpoint.title}
              {entry.checkpoint.date && <span className="text-[10px] opacity-75">{entry.checkpoint.date}</span>}
            </span>
          )
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Curriculum</h2>

      <div className="card overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {units.map((unit) => (
          <div key={unit.id} className="px-4 py-4 flex flex-col cq-md:flex-row gap-3 cq-md:gap-6">
            <span className="cq-md:w-48 shrink-0 font-semibold text-primary dark:text-primary-glow">
              {unit.title}
            </span>
            <div className="min-w-0 flex-1">{renderEntries(unit)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
