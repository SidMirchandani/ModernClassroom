"use client";

import { useMemo } from "react";
import type { CurriculumUnit } from "@/lib/db/types";
import type { Checkpoint, CheckpointKind, Section } from "@/lib/types";
import { curriculumView } from "@/lib/classroom/edits";
import type { GridLink } from "@/lib/classroom/grid";
import { cn } from "@/lib/utils";

interface CurriculumTableProps {
  units: CurriculumUnit[];
  /** How the class stands in Google Classroom, for a linked class. */
  links?: GridLink[];
}

const GONE_TITLE = "Deleted in Google Classroom";

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
 * here to set off by accident. Changes made in Google Classroom show here too.
 */
export function CurriculumTable({ units, links = [] }: CurriculumTableProps) {
  const view = useMemo(() => curriculumView(units, links), [units, links]);

  function renderEntries(unit: CurriculumUnit) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {courseOrder(unit).map((entry) =>
          entry.kind === "subunit" ? (
            <span
              key={entry.section.id}
              title={view.gone.has(entry.section.id) ? GONE_TITLE : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700",
                view.gone.has(entry.section.id) && "line-through opacity-60"
              )}
            >
              <span className="font-mono text-xs text-slate-400">{entry.section.id}</span>
              {entry.section.title}
              {entry.section.date && <span className="text-[10px] text-slate-400">{entry.section.date}</span>}
            </span>
          ) : (
            <span
              key={entry.checkpoint.id}
              title={view.gone.has(entry.checkpoint.id) ? GONE_TITLE : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border",
                CHECKPOINT_CHIP[entry.checkpoint.kind],
                view.gone.has(entry.checkpoint.id) && "line-through opacity-60"
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

      {(view.edits > 0 || view.gone.size > 0) && (
        <p className="mb-3 text-[15px] text-slate-600 dark:text-slate-300">
          Showing changes you made in Google Classroom. Anything crossed out was deleted there.
        </p>
      )}

      <div className="card overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {view.units.map((unit) => (
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
