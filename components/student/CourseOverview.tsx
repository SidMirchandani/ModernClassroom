"use client";

import { useMemo, useState } from "react";
import type { CurriculumUnit } from "@/lib/db/types";
import type { CurriculumNews } from "@/lib/curriculum-news";
import type { Checkpoint, Section, StudentProgress } from "@/lib/types";
import {
  canAccessSection,
  getSectionCompletionRatio,
  isSectionComplete,
  sectionHasHelp,
} from "@/lib/class-progress";
import { getCurrentUnitIndex, getUnitPhase, UNIT_PHASE_LABEL } from "@/lib/unit-phase";
import { TrackStatusDots } from "@/components/TrackStatusDots";
import { CheckpointRow } from "@/components/CheckpointRow";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** What the teacher has changed since this student last looked. */
  news?: CurriculumNews;
  className: string;
  units: CurriculumUnit[];
  progress: StudentProgress;
  blockSectionId: string | null;
  onOpenSection: (sectionId: string) => void;
}

interface Located {
  unit: CurriculumUnit;
  unitIndex: number;
  section: Section;
}

/**
 * The student's landing page: the whole curriculum up front, the dates it runs
 * to, what is coming up, and how far each resource has got — the thing the
 * spreadsheet used to do, before anything is opened.
 */
export function CourseOverview({
  className,
  units,
  progress,
  blockSectionId,
  onOpenSection,
  news,
}: Props) {
  // Access is a whole-course question: a later unit's first section is only
  // open once everything before it is finished AND the gate has moved past it.
  // Judging it against one unit's list would unlock 4.1, 5.1 and so on.
  const allSections = useMemo(() => units.flatMap((u) => u.subunits), [units]);
  const currentUnitIndex = getCurrentUnitIndex(units, blockSectionId);
  const [openUnits, setOpenUnits] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(units.map((u, i) => [u.id, i === currentUnitIndex]))
  );

  const { upNext, totals } = useMemo(() => {
    let complete = 0;
    let total = 0;
    let found: Located | null = null;

    units.forEach((unit, unitIndex) => {
      unit.subunits.forEach((section) => {
        total++;
        const sectionProgress = progress.sections[section.id];
        if (isSectionComplete(section, sectionProgress)) {
          complete++;
        } else if (
          !found &&
          canAccessSection(progress, section.id, allSections, blockSectionId)
        ) {
          found = { unit, unitIndex, section };
        }
      });
    });

    return { upNext: found as Located | null, totals: { complete, total } };
  }, [units, allSections, progress, blockSectionId]);

  const upcoming = useMemo(() => {
    const list: { unit: CurriculumUnit; checkpoint: Checkpoint }[] = [];
    units.forEach((unit, unitIndex) => {
      if (unitIndex < currentUnitIndex) return;
      unit.checkpoints?.forEach((checkpoint) => list.push({ unit, checkpoint }));
    });
    return list.slice(0, 4);
  }, [units, currentUnitIndex]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {className}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Everything in the course, in order, with the dates it runs to. Work at your own
          pace — your teacher can see where you are.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Sections Complete"
          value={`${totals.complete} / ${totals.total}`}
        />
        <StatTile
          label="Currently Working On"
          value={upNext ? `${upNext.section.id}` : "All caught up"}
          hint={upNext?.section.title}
        />
        <StatTile
          label="Class Can Work Through"
          value={blockSectionId ?? "No limit set"}
          hint={blockSectionId ? "Set by your teacher" : undefined}
        />
      </div>

      {upNext && (
        <div
          data-tour="up-next"
          className="rounded-2xl border border-2 border-primary/40 bg-white dark:bg-slate-900 p-5"
        >
          <p className="eyebrow">
            Up Next
          </p>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {upNext.section.id} · {upNext.section.title}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {upNext.unit.title}
                {upNext.section.date ? ` · due ${upNext.section.date}` : ""}
              </p>
              <div className="mt-3">
                <TrackStatusDots
                  section={upNext.section}
                  sectionProgress={progress.sections[upNext.section.id]}
                  accessible
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenSection(upNext.section.id)}
              className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors shrink-0"
            >
              Open Section
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="eyebrow-muted mb-2">
            Upcoming Assessments
          </p>
          <div className="space-y-2">
            {upcoming.map(({ unit, checkpoint }) => (
              <CheckpointRow
                key={`${unit.id}-${checkpoint.id}`}
                checkpoint={checkpoint}
                grade={progress.checkpoints?.[checkpoint.id]}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="eyebrow-muted mb-2">
          Full Curriculum
        </p>
        <div className="space-y-3">
          {units.map((unit, unitIndex) => {
            const phase = getUnitPhase(unitIndex, currentUnitIndex);
            const open = openUnits[unit.id] ?? false;
            const unitComplete = unit.subunits.filter((s) =>
              isSectionComplete(s, progress.sections[s.id])
            ).length;
            const unitNews = news
              ? unit.subunits.filter((s) => news.has(s.id)).length +
                (unit.checkpoints ?? []).filter((c) => news.has(c.id)).length
              : 0;

            return (
              <div
                key={unit.id}
                className="card overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenUnits((prev) => ({ ...prev, [unit.id]: !open }))
                  }
                  aria-expanded={open}
                  className="w-full flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                      {unit.title}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">
                      {unitComplete} of {unit.subunits.length} sections complete
                    </div>
                  </div>
                  {/* A collapsed unit would hide its flags, so it carries the
                      count itself — otherwise the banner sends the student
                      hunting through units for what changed. */}
                  {unitNews > 0 && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary text-white shrink-0"
                      title="Changed since you were last here"
                    >
                      {unitNews} new
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                      phase === "active"
                        ? "bg-white dark:bg-slate-900 border border-primary/30 text-primary dark:text-primary-glow"
                        : phase === "finished"
                          ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    )}
                  >
                    {UNIT_PHASE_LABEL[phase]}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-slate-400 shrink-0 transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </button>

                {open && (
                  <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {unit.subunits.map((section) => {
                      const sectionProgress = progress.sections[section.id];
                      const accessible = canAccessSection(
                        progress,
                        section.id,
                        allSections,
                        blockSectionId
                      );
                      const complete = isSectionComplete(section, sectionProgress);
                      const help = sectionHasHelp(section, sectionProgress);
                      const ratio = getSectionCompletionRatio(section, sectionProgress);
                      const after = (unit.checkpoints ?? []).filter(
                        (c) => c.afterSectionId === section.id
                      );

                      return (
                        <div key={section.id}>
                          <button
                            type="button"
                            disabled={!accessible}
                            onClick={() => onOpenSection(section.id)}
                            className={cn(
                              "w-full flex items-start gap-3 px-4 sm:px-5 py-3 text-left transition-colors",
                              accessible
                                ? "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                : "opacity-55 cursor-not-allowed"
                            )}
                          >
                            <div className="w-5 shrink-0 flex justify-center pt-0.5">
                              {!accessible ? (
                                <Lock className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700" />
                              ) : complete ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : help ? (
                                <HelpCircle className="w-4 h-4 text-rose-500" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-primary" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              {/* Plain text flow, not a flex row — a long title
                                  wraps as a sentence instead of leaving the id
                                  stranded on a line of its own. */}
                              <p className="text-sm leading-snug">
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {section.id}
                                </span>{" "}
                                <span className="text-slate-500 dark:text-slate-400">
                                  {section.title}
                                </span>{" "}
                                {news?.get(section.id) && (
                                  <span
                                    className="inline-flex items-center align-middle px-1 h-4 rounded text-[9px] font-bold uppercase tracking-wide bg-primary text-white"
                                    title={
                                      news.get(section.id) === "new"
                                        ? "Added since you were last here"
                                        : "Changed since you were last here"
                                    }
                                  >
                                    {news.get(section.id) === "new" ? "New" : "Upd"}
                                  </span>
                                )}
                              </p>
                              {section.date && (
                                <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-600 mt-0.5">
                                  <CalendarDays className="w-3 h-3" />
                                  Due {section.date}
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 flex items-center gap-3 pt-0.5">
                              {ratio.total > 0 && (
                                <span className="text-[11px] text-slate-400 dark:text-slate-600 tabular-nums hidden sm:inline">
                                  {ratio.done}/{ratio.total}
                                </span>
                              )}
                              <TrackStatusDots
                                section={section}
                                sectionProgress={sectionProgress}
                                accessible={accessible}
                                size="xs"
                              />
                            </div>
                          </button>

                          {after.map((checkpoint) => (
                            <div key={checkpoint.id} className="px-5 pb-3">
                              <CheckpointRow
                                checkpoint={checkpoint}
                                compact
                                grade={progress.checkpoints?.[checkpoint.id]}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Reads as a label/value row on a phone and as a stacked card from `sm` up —
 * three full-height cards stacked would eat most of a small screen.
 */
function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card px-4 py-3 flex items-baseline justify-between gap-3 sm:block">
      <div className="eyebrow-muted shrink-0">
        {label}
      </div>
      <div className="min-w-0 text-right sm:text-left">
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 sm:mt-1 truncate">
          {value}
        </div>
        {hint && (
          <div className="text-xs text-slate-400 dark:text-slate-600 truncate sm:mt-0.5">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
