import type { CurriculumUnit } from "./db/types";
import type { StudentProgress } from "./types";
import { isBeyondBlock, isSectionComplete } from "./class-progress";

export type TodoBucket = "past" | "this-week" | "next-week";

export const TODO_BUCKET_LABEL: Record<TodoBucket, string> = {
  past: "Past Due",
  "this-week": "Due This Week",
  "next-week": "Due Next Week",
};

export interface TodoItem {
  key: string;
  classId: string;
  className: string;
  kind: "section" | "checkpoint";
  /** Section id ("3.4") for a subunit, checkpoint id otherwise. */
  id: string;
  title: string;
  /** The teacher's own wording — "10/12", "10/12 or 10/13". */
  dueLabel: string;
  due: Date;
  bucket: TodoBucket;
  /** The section to open; a checkpoint points at the one it follows. */
  sectionId?: string;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Dates on the timeline sheet are written the way a teacher writes them —
 * "10/12", "10/12 or 10/13", "1/5 - 1/7". Take the *last* M/D in the string:
 * a spread of days is a window, and the work is not late until it closes. The
 * year comes from the school year — August onward is the autumn term, anything
 * earlier belongs to the calendar year after it started.
 */
export function parseDueDate(raw: string | undefined, today: Date): Date | null {
  if (!raw) return null;

  const matches = [...raw.matchAll(/(\d{1,2})\s*\/\s*(\d{1,2})/g)];
  const match = matches.at(-1);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const startYear = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const year = month >= 8 ? startYear : startYear + 1;
  return new Date(year, month - 1, day);
}

/**
 * Past due, this week, next week — anything further out is not a to-do yet.
 * Weeks end on Sunday, so "this week" shrinks as the week goes on.
 */
function bucketFor(due: Date, today: Date): TodoBucket | null {
  const todayStart = startOfDay(today);
  if (due < todayStart) return "past";

  const daysToSunday = (7 - todayStart.getDay()) % 7;
  const endOfThisWeek = new Date(todayStart);
  endOfThisWeek.setDate(endOfThisWeek.getDate() + daysToSunday);
  if (due <= endOfThisWeek) return "this-week";

  const endOfNextWeek = new Date(endOfThisWeek);
  endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);
  if (due <= endOfNextWeek) return "next-week";

  return null;
}

interface ClassTodoInput {
  classId: string;
  className: string;
  units: CurriculumUnit[];
  progress: StudentProgress;
  /** The teacher's gate. Work the class has not been let into is not yet owed. */
  blockSectionId?: string | null;
}

/** Everything one class wants from a student in the next two weeks, plus overdue. */
export function buildClassTodos(input: ClassTodoInput, today = new Date()): TodoItem[] {
  const { classId, className, units, progress, blockSectionId = null } = input;
  const sections = units.flatMap((u) => u.subunits);
  const items: TodoItem[] = [];

  for (const unit of units) {
    for (const section of unit.subunits) {
      if (isSectionComplete(section, progress.sections[section.id])) continue;
      // Behind the class is a to-do; ahead of the gate is not assigned yet.
      if (isBeyondBlock(sections, section.id, blockSectionId)) continue;

      const due = parseDueDate(section.date, today);
      if (!due) continue;
      const bucket = bucketFor(due, today);
      if (!bucket) continue;

      items.push({
        key: `${classId}:section:${section.id}`,
        classId,
        className,
        kind: "section",
        id: section.id,
        title: section.title,
        dueLabel: section.date ?? "",
        due,
        bucket,
        sectionId: section.id,
      });
    }

    for (const checkpoint of unit.checkpoints ?? []) {
      const anchor = sections.find((s) => s.id === checkpoint.afterSectionId);
      if (
        checkpoint.afterSectionId &&
        isBeyondBlock(sections, checkpoint.afterSectionId, blockSectionId)
      ) {
        continue;
      }
      // A checkpoint carries no progress of its own, so the section it follows
      // stands in for it: once that is signed off, the quiz has been sat.
      if (anchor && isSectionComplete(anchor, progress.sections[anchor.id])) continue;
      const due = parseDueDate(checkpoint.date, today);
      if (!due) continue;
      const bucket = bucketFor(due, today);
      if (!bucket) continue;

      items.push({
        key: `${classId}:checkpoint:${checkpoint.id}`,
        classId,
        className,
        kind: "checkpoint",
        id: checkpoint.id,
        title: checkpoint.title,
        dueLabel: checkpoint.date ?? "",
        due,
        bucket,
        sectionId: checkpoint.afterSectionId ?? undefined,
      });
    }
  }

  return sortTodos(items);
}

/** The same list across every class a student sits in. */
export function buildTodosForClasses(
  inputs: ClassTodoInput[],
  today = new Date()
): TodoItem[] {
  return sortTodos(inputs.flatMap((input) => buildClassTodos(input, today)));
}

function sortTodos(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => a.due.getTime() - b.due.getTime());
}

export function groupTodos(items: TodoItem[]): { bucket: TodoBucket; items: TodoItem[] }[] {
  const order: TodoBucket[] = ["past", "this-week", "next-week"];
  return order
    .map((bucket) => ({ bucket, items: items.filter((i) => i.bucket === bucket) }))
    .filter((group) => group.items.length > 0);
}

/** What the button badge counts: overdue plus whatever is due this week. */
export function urgentTodoCount(items: TodoItem[]): number {
  return items.filter((i) => i.bucket === "past" || i.bucket === "this-week").length;
}
