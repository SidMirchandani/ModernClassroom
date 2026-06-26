import type { CurriculumUnit } from "./db/types";
import type { StudentProgress } from "./types";

export type UnitPhase = "finished" | "active" | "upcoming";

export function getUnitPhase(unitIndex: number, currentUnitIndex: number): UnitPhase {
  if (unitIndex < currentUnitIndex) return "finished";
  if (unitIndex > currentUnitIndex) return "upcoming";
  return "active";
}

export const UNIT_PHASE_LABEL: Record<UnitPhase, string> = {
  finished: "Finished",
  active: "Active",
  upcoming: "Upcoming",
};

export const UNIT_PHASE_CLASSES: Record<UnitPhase, string> = {
  finished:
    "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800",
  active:
    "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800",
  upcoming:
    "bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800",
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

export function allCompleteProgress(
  studentIds: string[],
  sectionIds: string[],
  unitId = 1
): StudentProgress[] {
  return studentIds.map((studentId) => ({
    studentId,
    unitId,
    sections: Object.fromEntries(
      sectionIds.map((id) => [
        id,
        {
          learn: "done" as const,
          practice: "done" as const,
          extra: "done" as const,
          practiceApproved: true,
        },
      ])
    ),
  }));
}
