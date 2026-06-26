import { UNIT } from "./data";
import { isBeyondProgressBlock } from "./progress-block-store";
import type { ActivityStatus, SectionActivityStatus, StudentProgress } from "./types";

export function isActivityFinished(status: ActivityStatus | undefined): boolean {
  return status === "done" || status === "help";
}

export function isSectionComplete(
  sectionProgress: SectionActivityStatus | undefined
): boolean {
  if (!sectionProgress) return false;
  return sectionProgress.learn === "done" && sectionProgress.practice === "done";
}

export function sectionHasHelp(
  sectionProgress: SectionActivityStatus | undefined
): boolean {
  if (!sectionProgress) return false;
  return (
    sectionProgress.learn === "help" ||
    sectionProgress.practice === "help" ||
    sectionProgress.extra === "help"
  );
}

export function canAccessSection(
  progress: StudentProgress,
  sectionId: string
): boolean {
  const idx = UNIT.sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) return false;
  if (isBeyondProgressBlock(sectionId)) return false;
  if (idx === 0) return true;

  for (let i = 0; i < idx; i++) {
    const prevId = UNIT.sections[i].id;
    const prev = progress.sections[prevId];
    if (!prev || !isActivityFinished(prev.learn) || !isActivityFinished(prev.practice)) {
      return false;
    }
  }
  return true;
}

export function getDefaultSectionProgress(sectionId: string): SectionActivityStatus {
  const idx = UNIT.sections.findIndex((s) => s.id === sectionId);
  if (idx === 0) {
    return { learn: "available", practice: "locked", extra: "locked" };
  }
  return { learn: "locked", practice: "locked", extra: "locked" };
}

export function resolveSectionProgress(
  progress: StudentProgress,
  sectionId: string
): SectionActivityStatus {
  const stored = progress.sections[sectionId];
  if (stored) return stored;

  if (canAccessSection(progress, sectionId)) {
    return { learn: "available", practice: "locked", extra: "locked" };
  }
  return getDefaultSectionProgress(sectionId);
}

export function normalizeProgress(progress: StudentProgress): StudentProgress {
  const sections: StudentProgress["sections"] = {};

  for (const section of UNIT.sections) {
    const stored = progress.sections[section.id];
    if (!canAccessSection(progress, section.id)) {
      sections[section.id] = {
        learn: "locked",
        practice: "locked",
        extra: "locked",
        ...(stored?.practiceProofUrl ? { practiceProofUrl: stored.practiceProofUrl } : {}),
      };
      continue;
    }

    const base = stored ?? {
      learn: "available",
      practice: "locked",
      extra: "locked",
    };

    const learn =
      base.learn === "locked" ? "available" : base.learn;

    const practice =
      isActivityFinished(learn) && base.practice === "locked"
        ? "available"
        : base.practice;

    const extra =
      isActivityFinished(practice) && base.extra === "locked"
        ? "available"
        : base.extra;

    sections[section.id] = {
      ...base,
      learn,
      practice,
      extra,
    };
  }

  return { ...progress, sections };
}

/** Index of the first section that is not fully complete (learn + practice done). */
export function getCurrentSectionIndex(progress: StudentProgress): number {
  const idx = UNIT.sections.findIndex(
    (s) => !isSectionComplete(progress.sections[s.id])
  );
  return idx === -1 ? UNIT.sections.length : idx;
}

export function needsTeacherReview(
  sectionProgress: SectionActivityStatus | undefined
): boolean {
  if (!sectionProgress) return false;
  return (
    sectionProgress.practice === "done" && sectionProgress.practiceApproved !== true
  );
}

export {
  applySendBackForReview,
  hasRevisionNotice,
  resolveHelpAsAllGood,
} from "./class-progress";

export type TeacherSectionStatus =
  | "not-started"
  | "in-progress"
  | "complete"
  | "help"
  | "review";

/**
 * Teacher-facing section status. Differs from student view by showing
 * "review" when practice is submitted but not yet teacher-approved.
 */
export function getTeacherSectionStatus(
  progress: StudentProgress,
  sectionId: string
): TeacherSectionStatus {
  const sectionProgress = progress.sections[sectionId];

  if (needsTeacherReview(sectionProgress)) return "review";

  const sectionIdx = UNIT.sections.findIndex((s) => s.id === sectionId);
  if (sectionIdx < 0) return "not-started";

  const currentIdx = getCurrentSectionIndex(progress);

  if (sectionIdx < currentIdx) return "complete";
  if (sectionIdx > currentIdx) return "not-started";
  if (sectionHasHelp(sectionProgress)) return "help";
  return "in-progress";
}

/**
 * Per-section status for a student (student-facing sidebar):
 * - complete: finished sections before the current one
 * - in-progress (Active): current section, not stuck on help
 * - help: current section with a help request — no Active anywhere
 * - not-started: sections after the current one
 */
export function getStudentSectionStatus(
  progress: StudentProgress,
  sectionId: string
): "not-started" | "in-progress" | "complete" | "help" {
  const sectionIdx = UNIT.sections.findIndex((s) => s.id === sectionId);
  if (sectionIdx < 0) return "not-started";

  const currentIdx = getCurrentSectionIndex(progress);

  if (sectionIdx < currentIdx) return "complete";
  if (sectionIdx > currentIdx) return "not-started";

  const sectionProgress = progress.sections[sectionId];
  if (sectionHasHelp(sectionProgress)) return "help";
  return "in-progress";
}
