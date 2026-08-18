import type { Checkpoint, CheckpointGrade } from "./types";

/** What a checkpoint is scored out of when the teacher has not said otherwise. */
export const DEFAULT_CHECKPOINT_POINTS = 100;

export function checkpointMax(checkpoint: Pick<Checkpoint, "maxPoints">): number {
  return checkpoint.maxPoints ?? DEFAULT_CHECKPOINT_POINTS;
}

/** "18/20" — the marks as written, not a derived percentage. */
export function formatGrade(grade: CheckpointGrade): string {
  return `${trimNumber(grade.score)}/${trimNumber(grade.outOf)}`;
}

export function gradeRatio(grade: CheckpointGrade): number {
  return grade.outOf > 0 ? grade.score / grade.outOf : 0;
}

/**
 * Marks are worth reading at a glance, but the app has one status vocabulary
 * and grades are not part of it — so a score gets weight, not a colour, except
 * for a failing mark which a teacher does need to spot in a full row.
 */
export function gradeToneClass(grade: CheckpointGrade): string {
  return gradeRatio(grade) < 0.6
    ? "text-rose-600 dark:text-rose-400"
    : "text-slate-700 dark:text-slate-200";
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
