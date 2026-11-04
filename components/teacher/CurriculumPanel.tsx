"use client";

import { useEffect, useState } from "react";
import { CloudUpload, Loader2, RotateCcw, X } from "lucide-react";
import type { GridLink } from "@/lib/classroom/grid";
import type { CurriculumUnit } from "@/lib/db/types";
import type { CurriculumImporter } from "@/lib/use-curriculum-import";
import { ActionCard } from "./ActionCard";
import { CurriculumReview } from "./CurriculumReview";
import { CurriculumTable } from "./CurriculumTable";

interface CurriculumPanelProps {
  units: CurriculumUnit[];
  links?: GridLink[];
  importer: CurriculumImporter;
}

/**
 * The Curriculum tab, for teachers who do not live in software.
 *
 * At the top, always, one large panel says what reading a file does and has
 * one button that says "Upload a file" — the curriculum's one use of AI, and
 * the one way to change it: an updated file, reviewed row by row. Below, the
 * curriculum to read, quizzes and tests in place among the subunits. There is
 * nothing to edit by hand, so nothing to get wrong by accident.
 *
 * Once a file's changes are saved, a banner offers Undo for as long as nothing
 * has changed since.
 */
export function CurriculumPanel({ units, links, importer }: CurriculumPanelProps) {
  const { review } = importer;
  const [undoHidden, setUndoHidden] = useState(false);

  // A new import's Undo shows again.
  useEffect(() => {
    if (importer.undo) setUndoHidden(false);
  }, [importer.lastAppliedCount, importer.undo]);

  if (review) return <CurriculumReview review={review} />;

  const empty = units.length === 0;

  return (
    <div className="space-y-5">
      {/* The one place a file comes in: big, worded, never missed. */}
      <ActionCard
        icon={CloudUpload}
        working={importer.running}
        title={empty ? "Build your curriculum from a file" : "Update your curriculum from a file"}
        action={
          <button type="button" onClick={() => importer.setDialogOpen(true)} className="btn btn-lg btn-primary">
            {importer.running ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Reading your file…
              </>
            ) : (
              "Upload a file"
            )}
          </button>
        }
      >
        {empty
          ? "Upload your pacing guide, calendar or syllabus and we'll set up your units and subunits. You'll check everything before it's saved."
          : "Have a new pacing guide or calendar? Upload it and we'll show you what's different. Nothing changes until you say yes."}
      </ActionCard>

      {importer.undo && !undoHidden && (
        <div className="fade-in flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/20 px-4 py-3">
          <span className="flex-1 min-w-[12rem] text-[15px] text-emerald-900 dark:text-emerald-100">
            Saved {importer.lastAppliedCount} change{importer.lastAppliedCount === 1 ? "" : "s"} from your file.
          </span>
          <button
            type="button"
            disabled={importer.applying}
            onClick={() => void importer.undo?.()}
            className="btn btn-md btn-secondary"
          >
            <RotateCcw className="w-4 h-4" />
            Undo these changes
          </button>
          <button
            type="button"
            onClick={() => setUndoHidden(true)}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-emerald-800/60 hover:text-emerald-900 dark:text-emerald-200/60 dark:hover:text-emerald-100 transition-colors"
            aria-label="Hide this message"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {importer.applyError && (
        <p className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-[15px] text-rose-800 dark:text-rose-200">
          {importer.applyError}
        </p>
      )}

      {!empty && <CurriculumTable units={units} links={links} />}
    </div>
  );
}
