import type { TeacherSectionStatus } from "./class-progress";

/**
 * One vocabulary for every "where is this at" label in the app — the student's
 * resource badges, the teacher's grid chips and the section pills all read from
 * here, so a colour never means two things.
 *
 * Colour sits on the surface, never on another colour: chips are the card's own
 * white (slate-900 in dark) with a tinted border and tinted text. Filled
 * lozenges stacked inside tinted rows made the whole page read as noise.
 */
export type ProgressStatus = TeacherSectionStatus | "locked";

export const STATUS_LABEL: Record<ProgressStatus, string> = {
  locked: "Locked",
  "not-started": "Not Started",
  "in-progress": "In Progress",
  review: "Submitted",
  help: "Help!",
  complete: "Done",
};

/** Teacher grid uses tighter wording — a column header has no room for prose. */
export const STATUS_LABEL_SHORT: Record<ProgressStatus, string> = {
  locked: "—",
  "not-started": "—",
  "in-progress": "Active",
  review: "Review",
  help: "Help!",
  complete: "Done",
};

const SURFACE = "bg-white dark:bg-slate-900";

export const STATUS_CHIP: Record<ProgressStatus, string> = {
  locked: `${SURFACE} border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600`,
  "not-started": `${SURFACE} border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500`,
  "in-progress": `${SURFACE} border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-400`,
  review: `${SURFACE} border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400`,
  help: `${SURFACE} border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400`,
  complete: `${SURFACE} border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400`,
};

/** Dot/stripe fill for the same statuses, where a chip is too heavy. */
export const STATUS_DOT: Record<ProgressStatus, string> = {
  locked: "bg-slate-300 dark:bg-slate-700",
  "not-started": "bg-slate-300 dark:bg-slate-700",
  "in-progress": "bg-sky-500",
  review: "bg-amber-500",
  help: "bg-rose-500",
  complete: "bg-emerald-500",
};
