import type { CurriculumUnit } from "../db/types";
import { checkpointKey, lessonKey, parseCurriculumDate, trackKey, type LinkState } from "./plan";

/**
 * The progress grid for a class that lives in Google Classroom: one column per
 * thing a student can turn in, one row per student on Classroom's roster. Pure,
 * like the plan: the route fetches, this decides what each cell says.
 */

export interface GridColumn {
  /** The same key the plan posts under, which is how a turn-in finds its column. */
  key: string;
  /** "3.1", or a quiz's title. */
  head: string;
  /** The lesson's title and resource. Absent for a quiz, whose head says it all. */
  detail?: string;
  date?: string;
  kind: "lesson" | "checkpoint";
}

/** Course order: each lesson's resources, then what comes after that lesson. */
export function gridColumns(unit: CurriculumUnit): GridColumn[] {
  const columns: GridColumn[] = [];
  const checkpoints = unit.checkpoints ?? [];
  const addCheckpoints = (after: string | null) => {
    for (const c of checkpoints.filter((c) => c.afterSectionId === after)) {
      columns.push({ key: checkpointKey(c), head: c.title, date: c.date, kind: "checkpoint" });
    }
  };

  addCheckpoints(null);
  for (const section of unit.subunits) {
    const tracks = section.tracks ?? [];
    if (tracks.length === 0) {
      columns.push({ key: lessonKey(section), head: section.id, detail: section.title, date: section.date, kind: "lesson" });
    }
    for (const track of tracks) {
      // Learn is a material: nothing to turn in, so no column.
      const blocks = track.blocks ?? [];
      if (blocks.length > 0 && !blocks.some((b) => b.type === "practice")) continue;
      columns.push({
        key: trackKey("practice", track),
        head: section.id,
        detail: `${section.title} · ${track.label}`,
        date: section.date,
        kind: "lesson",
      });
    }
    addCheckpoints(section.id);
  }
  return columns;
}

export type SubmissionState = "NEW" | "CREATED" | "TURNED_IN" | "RETURNED" | "RECLAIMED_BY_STUDENT";

export interface CachedSubmission {
  userId: string;
  itemKey: string;
  state: SubmissionState;
  late: boolean;
  assignedGrade: number | null;
  draftGrade: number | null;
}

export interface GridLink {
  itemKey: string;
  state: LinkState;
  scheduledFor: string | null;
}

export type CellStatus = "scheduled" | "returned" | "turned-in" | "late" | "missing" | "not-yet";

export const CELL_LABEL: Record<CellStatus, string> = {
  scheduled: "Not posted yet",
  returned: "Returned",
  "turned-in": "Turned in",
  late: "Turned in late",
  missing: "Missing",
  "not-yet": "Not yet",
};

function isPosted(link: GridLink | undefined, now: Date): boolean {
  if (!link || link.state === "DRAFT" || link.state === "GONE") return false;
  if (link.state === "PUBLISHED") return true;
  // Classroom published it on its date; our record only says it was scheduled.
  return link.scheduledFor !== null && new Date(link.scheduledFor).getTime() <= now.getTime();
}

/** Past the end of its date, by the teacher's own calendar. */
function isOverdue(date: string | undefined, now: Date): boolean {
  const day = parseCurriculumDate(date, now);
  if (!day) return false;
  return new Date(day.year, day.month - 1, day.day + 1).getTime() <= now.getTime();
}

export function cellStatus(
  column: GridColumn,
  link: GridLink | undefined,
  submission: CachedSubmission | undefined,
  now: Date
): CellStatus {
  if (!isPosted(link, now)) return "scheduled";
  if (submission?.state === "RETURNED") return "returned";
  if (submission?.state === "TURNED_IN") return submission.late ? "late" : "turned-in";
  return isOverdue(column.date, now) ? "missing" : "not-yet";
}

/** Of what has been posted so far, how much this student has handed in. */
export function studentOverall(statuses: CellStatus[]): number | null {
  const posted = statuses.filter((s) => s !== "scheduled");
  if (posted.length === 0) return null;
  const done = posted.filter((s) => s === "returned" || s === "turned-in" || s === "late");
  return Math.round((done.length / posted.length) * 100);
}

// ---------------------------------------------------------------------------
// Squaring the cache with what Classroom says
// ---------------------------------------------------------------------------

/**
 * Only what changed gets written, so an unchanged class writes nothing and
 * other open screens are told only about real news. What Classroom no longer
 * has (a student who left) goes.
 */
export function diffRows<T>(
  existing: T[],
  incoming: T[],
  keyOf: (row: T) => string
): { upsert: T[]; remove: T[] } {
  const before = new Map(existing.map((row) => [keyOf(row), row]));
  const after = new Set(incoming.map(keyOf));
  return {
    upsert: incoming.filter((row) => {
      const old = before.get(keyOf(row));
      return !old || JSON.stringify(old) !== JSON.stringify(row);
    }),
    remove: existing.filter((row) => !after.has(keyOf(row))),
  };
}
