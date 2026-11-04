import type { CachedSubmission } from "./grid";

/**
 * Marks, which live in Google Classroom (ADR-011). A mark typed in the grid is
 * Classroom's draft grade, which only the teacher sees. Returning a column copies
 * each draft to the assigned grade and hands the work back to the student.
 */

/** What Classroom gives an assignment with no total of its own. */
export const DEFAULT_POINTS = 100;

/** A typed mark. Empty clears it; anything else unreadable or negative is refused. */
export function parseMark(raw: string): { ok: true; mark: number | null } | { ok: false } {
  const text = raw.trim();
  if (text === "") return { ok: true, mark: null };
  const mark = Number(text);
  return Number.isFinite(mark) && mark >= 0 ? { ok: true, mark } : { ok: false };
}

/** A column's total. Classroom takes whole points above zero. */
export function parsePoints(raw: string): number | null {
  const points = Number(raw.trim());
  return Number.isInteger(points) && points > 0 ? points : null;
}

/** The mark to show: what the teacher last typed, or what was returned. */
export function markOf(work: CachedSubmission | undefined): number | null {
  return work?.draftGrade ?? work?.assignedGrade ?? null;
}

/** Has a mark the student can't see yet. */
export function isUnreturned(work: CachedSubmission | undefined): boolean {
  if (!work || work.draftGrade === null) return false;
  return work.state !== "RETURNED" || work.draftGrade !== work.assignedGrade;
}

/** Who a column's "Return grades" would reach. */
export function unreturnedIn(itemKey: string, submissions: CachedSubmission[]): CachedSubmission[] {
  return submissions.filter((s) => s.itemKey === itemKey && isUnreturned(s));
}
