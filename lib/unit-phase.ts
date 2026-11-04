import type { CurriculumUnit } from "./db/types";
import { parseCurriculumDate } from "./classroom/plan";

export type UnitPhase = "finished" | "active" | "upcoming" | "not-started";

/**
 * Where a unit stands against the class's place in the year. Before the first
 * dated lesson (`classHasStarted`) nothing has started anywhere. A class's
 * students live in Google Classroom, so who has joined here says nothing.
 */
export function getUnitPhase(
  unitIndex: number,
  currentUnitIndex: number,
  started = true
): UnitPhase {
  if (!started) return "not-started";
  if (unitIndex < currentUnitIndex) return "finished";
  if (unitIndex > currentUnitIndex) return "upcoming";
  return "active";
}

export const UNIT_PHASE_LABEL: Record<UnitPhase, string> = {
  finished: "Finished",
  active: "Active",
  upcoming: "Upcoming",
  // The same words the status chips use for work nobody has begun.
  "not-started": "Not Started",
};

export const UNIT_PHASE_CLASSES: Record<UnitPhase, string> = {
  finished:
    "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800",
  active:
    "bg-white dark:bg-slate-900 border border-primary/30 text-primary dark:text-primary-glow border border-primary/25",
  upcoming:
    "bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800",
  "not-started":
    "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-500 border border-slate-200 dark:border-slate-800",
};

/** Resolve which unit the class is currently working in from the progress gate. */
export function getCurrentUnitIndex(
  units: Pick<CurriculumUnit, "subunits">[],
  blockSectionId: string | null
): number {
  if (units.length === 0) return 0;

  const lastUnit = units.length - 1;
  const lastSectionId = units[lastUnit]?.subunits.at(-1)?.id ?? null;
  const effectiveBlock = blockSectionId ?? lastSectionId;
  if (!effectiveBlock) return 0;

  for (let i = 0; i < units.length; i++) {
    if (units[i].subunits.some((s) => s.id === effectiveBlock)) {
      return i;
    }
  }

  const allIds = units.flatMap((u) => u.subunits.map((s) => s.id));
  const blockIdx = allIds.indexOf(effectiveBlock);
  if (blockIdx < 0) return 0;

  let offset = 0;
  for (let i = 0; i < units.length; i++) {
    offset += units[i].subunits.length;
    if (blockIdx < offset) return i;
  }

  return lastUnit;
}

/** Whether the calendar has reached any lesson. A class with no dates counts as started. */
export function classHasStarted(units: Pick<CurriculumUnit, "subunits">[], today: Date): boolean {
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = units
    .flatMap((u) => u.subunits)
    .map((s) => parseCurriculumDate(s.date, today))
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .map((d) => Date.UTC(d.year, d.month - 1, d.day));
  return days.length === 0 || Math.min(...days) <= now;
}

/**
 * Which unit the class is in by the calendar: the last one whose first dated
 * lesson is on or before today. Before the year starts, the first unit.
 */
export function getCurrentUnitIndexByDate(
  units: Pick<CurriculumUnit, "subunits">[],
  today: Date
): number {
  const day = (d: { year: number; month: number; day: number }) => Date.UTC(d.year, d.month - 1, d.day);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  let current = 0;
  units.forEach((unit, i) => {
    const starts = unit.subunits
      .map((s) => parseCurriculumDate(s.date, today))
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map(day);
    if (starts.length && Math.min(...starts) <= now) current = i;
  });
  return current;
}
