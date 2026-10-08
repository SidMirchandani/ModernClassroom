import type { Checkpoint, CheckpointGrade, CheckpointKind } from "@/lib/types";
import { formatGrade, gradeToneClass } from "@/lib/grades";
import { CalendarDays, ClipboardCheck, FlaskConical, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A dated marker between sections. The card stays white — only the left stripe,
 * the icon and the title carry the hue, so a page full of checkpoints reads as
 * a list rather than a row of coloured blocks.
 */
export const CHECKPOINT_KIND_META: Record<
  CheckpointKind,
  { label: string; Icon: typeof ClipboardCheck; stripe: string; accent: string }
> = {
  quiz: {
    label: "Quiz",
    Icon: ClipboardCheck,
    stripe: "bg-amber-400",
    accent: "text-amber-700 dark:text-amber-400",
  },
  test: {
    label: "Test",
    Icon: FileText,
    stripe: "bg-rose-400",
    accent: "text-rose-700 dark:text-rose-400",
  },
  checkpoint: {
    label: "Checkpoint",
    Icon: ClipboardCheck,
    stripe: "bg-sky-400",
    accent: "text-sky-700 dark:text-sky-400",
  },
  project: {
    label: "Project",
    Icon: FlaskConical,
    stripe: "bg-violet-400",
    accent: "text-violet-700 dark:text-violet-400",
  },
};

export function CheckpointRow({
  checkpoint,
  compact = false,
  grade,
}: {
  checkpoint: Checkpoint;
  compact?: boolean;
  /** The student's mark, once the teacher has entered one. */
  grade?: CheckpointGrade;
}) {
  const meta = CHECKPOINT_KIND_META[checkpoint.kind];
  const { Icon } = meta;

  return (
    <div className="flex items-stretch">
      <div className={cn("w-0.5 shrink-0 rounded-full my-2", meta.stripe)} aria-hidden />
      <div
        className={cn(
          "flex items-start gap-2.5 min-w-0 flex-1",
          compact ? "px-3 py-2" : "px-4 py-3"
        )}
      >
        <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", meta.accent)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "font-semibold text-slate-800 dark:text-slate-200",
                compact ? "text-xs" : "text-sm"
              )}
            >
              {checkpoint.title}
            </span>
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", meta.accent)}>
              {meta.label}
            </span>
            {checkpoint.date && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <CalendarDays className="w-3 h-3" />
                {checkpoint.date}
              </span>
            )}
            {grade && (
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  gradeToneClass(grade)
                )}
                title="Your score"
              >
                {formatGrade(grade)}
              </span>
            )}
          </div>
          {checkpoint.note?.trim() && (
            <p
              className={cn(
                "text-slate-500 dark:text-slate-400 mt-0.5",
                compact ? "text-[11px]" : "text-xs"
              )}
            >
              {checkpoint.note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
