"use client";

import { useMemo } from "react";
import type { CurriculumUnit } from "@/lib/db/types";
import type { Checkpoint, Section, StudentProgress } from "@/lib/types";
import {
  canAccessSection,
  getStudentSectionStatus,
  hasRevisionNotice,
  isBeyondBlock,
} from "@/lib/class-progress";
import {
  CheckCircle2,
  ClipboardCheck,
  HelpCircle,
  LayoutGrid,
  Lock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  units: CurriculumUnit[];
  /** Only this unit is listed — the strip's navigator moves between them. */
  unitIndex: number;
  progress: StudentProgress;
  activeSectionId: string;
  onSelect: (id: string) => void;
  onTeacherBlocked?: () => void;
  blockSectionId?: string | null;
  /** Renders a Class Dashboard row above the list — the phone sheet uses it. */
  onSelectOverview?: () => void;
  overviewActive?: boolean;
  className?: string;
}

export function SectionSidebarContent({
  units,
  unitIndex,
  progress,
  activeSectionId,
  onSelect,
  onTeacherBlocked,
  blockSectionId = null,
  onSelectOverview,
  overviewActive = false,
}: Omit<Props, "className">) {
  // Access is judged against the whole course even though one unit is shown —
  // whether 4.1 is open depends on everything before it, not on its own unit.
  const sections: Section[] = useMemo(
    () => units.flatMap((u) => u.subunits),
    [units]
  );

  const unit = units[unitIndex];
  if (!unit) return null;

  return (
    <>
      {onSelectOverview && (
        <button
          type="button"
          onClick={onSelectOverview}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-2 mb-3 rounded-lg text-left text-sm font-medium transition-colors",
            overviewActive
              ? "bg-white dark:bg-slate-900 border border-primary/30 text-primary dark:text-primary-glow"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
          Class Dashboard
        </button>
      )}

      <div className="px-2 mb-2">
        <span className="eyebrow-muted block">{unit.title}</span>
      </div>

      <nav className="space-y-0.5">
        {unit.subunits.map((section) => {
          const status = getStudentSectionStatus(progress, section.id, sections);
          const needsRevision = hasRevisionNotice(progress.sections[section.id]);
          const isActive = section.id === activeSectionId;
          const teacherBlocked = isBeyondBlock(sections, section.id, blockSectionId);
          const accessible = canAccessSection(
            progress,
            section.id,
            sections,
            blockSectionId
          );
          const progressionLocked = !accessible && !teacherBlocked;
          const after = (unit.checkpoints ?? []).filter(
            (c) => c.afterSectionId === section.id
          );

          return (
            <div key={section.id}>
              <button
                type="button"
                disabled={progressionLocked}
                onClick={() => {
                  if (teacherBlocked) {
                    onTeacherBlocked?.();
                    return;
                  }
                  onSelect(section.id);
                }}
                className={cn(
                  "w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-colors",
                  progressionLocked && "opacity-45 cursor-not-allowed",
                  teacherBlocked && "opacity-45 cursor-pointer",
                  isActive
                    ? "bg-white dark:bg-slate-900 border border-primary/30"
                    : accessible
                      ? "hover:bg-slate-100 dark:hover:bg-slate-800"
                      : ""
                )}
              >
                <StatusIcon
                  status={status}
                  locked={!accessible}
                  teacherBlocked={teacherBlocked}
                  active={isActive}
                  needsRevision={needsRevision}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "text-sm font-semibold leading-tight",
                        isActive
                          ? "text-primary dark:text-primary-glow"
                          : accessible
                            ? "text-slate-700 dark:text-slate-300"
                            : "text-slate-400 dark:text-slate-600"
                      )}
                    >
                      {section.id}
                    </div>
                    {section.date && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-600 shrink-0 tabular-nums">
                        {section.date}
                      </div>
                    )}
                    {needsRevision && (
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 shrink-0"
                        title="Sent back for review"
                      >
                        <AlertCircle className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-500 leading-[1.3] mt-0.5">
                    {section.title}
                  </div>
                </div>
              </button>

              {after.map((checkpoint) => (
                <CheckpointStop key={checkpoint.id} checkpoint={checkpoint} />
              ))}
            </div>
          );
        })}
      </nav>
    </>
  );
}

function CheckpointStop({ checkpoint }: { checkpoint: Checkpoint }) {
  return (
    <div className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 my-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <ClipboardCheck className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 leading-tight">
          {checkpoint.title}
        </div>
        {checkpoint.date && (
          <div className="text-[10px] text-amber-700/70 dark:text-amber-400/70 tabular-nums">
            {checkpoint.date}
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionSidebar({ className, ...props }: Props) {
  return (
    <aside
      className={cn(
        // 100px = the sticky header above it: h-14 navbar + h-11 class strip.
        "w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 py-4 px-3 sticky top-[100px] self-start max-h-[calc(100vh-100px)] overflow-y-auto no-scrollbar",
        className
      )}
    >
      <SectionSidebarContent {...props} />
    </aside>
  );
}

function StatusIcon({
  status,
  locked,
  teacherBlocked,
  active,
  needsRevision,
}: {
  status: "not-started" | "in-progress" | "complete" | "help";
  locked: boolean;
  teacherBlocked?: boolean;
  active: boolean;
  needsRevision?: boolean;
}) {
  if (locked) {
    return (
      <Lock
        className={cn(
          "w-3 h-3 shrink-0 mt-1",
          teacherBlocked
            ? "text-rose-400 dark:text-rose-600"
            : "text-slate-300 dark:text-slate-700"
        )}
      />
    );
  }
  if (status === "complete") {
    return <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500 mt-0.5" />;
  }
  if (status === "help") {
    return <HelpCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 mt-0.5" />;
  }
  if (status === "in-progress") {
    return (
      <div className="relative shrink-0 mt-0.5">
        <div
          className={cn(
            "w-3.5 h-3.5 rounded-full border-2",
            active ? "border-primary" : "border-primary/60 dark:border-primary-glow/60"
          )}
        />
        {needsRevision && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
        )}
      </div>
    );
  }
  return (
    <div className="w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5 border-slate-300 dark:border-slate-700" />
  );
}
