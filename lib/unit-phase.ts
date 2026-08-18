import type { CurriculumUnit } from "./db/types";

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
    "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800",
  active:
    "bg-white dark:bg-slate-900 border border-primary/30 text-primary dark:text-primary-glow border border-primary/25",
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
