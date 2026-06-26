import type { CurriculumUnit } from "./db/types";
import type { ActivityStatus, SectionActivityStatus, StudentProgress } from "./types";
import { getCurrentUnitIndex, getUnitPhase } from "./unit-phase";

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

export function isBeyondBlock(
  sectionIds: string[],
  sectionId: string,
  blockSectionId: string | null
): boolean {
  if (!blockSectionId) return false;
  const blockIdx = sectionIds.indexOf(blockSectionId);
  const sectionIdx = sectionIds.indexOf(sectionId);
  if (blockIdx < 0 || sectionIdx < 0) return false;
  return sectionIdx > blockIdx;
}

export function canAccessSection(
  progress: StudentProgress,
  sectionId: string,
  sectionIds: string[],
  blockSectionId: string | null = null
): boolean {
  const idx = sectionIds.indexOf(sectionId);
  if (idx < 0) return false;
  if (isBeyondBlock(sectionIds, sectionId, blockSectionId)) return false;
  if (idx === 0) return true;

  for (let i = 0; i < idx; i++) {
    const prevId = sectionIds[i];
    const prev = progress.sections[prevId];
    if (!prev || !isActivityFinished(prev.learn) || !isActivityFinished(prev.practice)) {
      return false;
    }
  }
  return true;
}

export function getDefaultSectionProgress(
  sectionIds: string[],
  sectionId: string
): SectionActivityStatus {
  const idx = sectionIds.indexOf(sectionId);
  if (idx === 0) {
    return { learn: "available", practice: "locked", extra: "locked" };
  }
  return { learn: "locked", practice: "locked", extra: "locked" };
}

export function resolveSectionProgress(
  progress: StudentProgress,
  sectionId: string,
  sectionIds: string[],
  blockSectionId: string | null = null
): SectionActivityStatus {
  const stored = progress.sections[sectionId];
  if (stored) return stored;

  if (canAccessSection(progress, sectionId, sectionIds, blockSectionId)) {
    return { learn: "available", practice: "locked", extra: "locked" };
  }
  return getDefaultSectionProgress(sectionIds, sectionId);
}

export function normalizeProgress(
  progress: StudentProgress,
  sectionIds: string[],
  blockSectionId: string | null = null
): StudentProgress {
  const sections: StudentProgress["sections"] = {};

  for (const sectionId of sectionIds) {
    const stored = progress.sections[sectionId];
    if (!canAccessSection(progress, sectionId, sectionIds, blockSectionId)) {
      sections[sectionId] = {
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

    const learn = base.learn === "locked" ? "available" : base.learn;
    const practice =
      isActivityFinished(learn) && base.practice === "locked"
        ? "available"
        : base.practice;
    const extra =
      isActivityFinished(practice) && base.extra === "locked"
        ? "available"
        : base.extra;

    sections[sectionId] = { ...base, learn, practice, extra };
  }

  return { ...progress, sections };
}

export function getCurrentSectionIndex(
  progress: StudentProgress,
  sectionIds: string[]
): number {
  const idx = sectionIds.findIndex(
    (id) => !isSectionComplete(progress.sections[id])
  );
  return idx === -1 ? sectionIds.length : idx;
}

export function needsTeacherReview(
  sectionProgress: SectionActivityStatus | undefined
): boolean {
  if (!sectionProgress) return false;
  return (
    sectionProgress.practice === "done" && sectionProgress.practiceApproved !== true
  );
}

export function hasRevisionNotice(
  sectionProgress: SectionActivityStatus | undefined
): boolean {
  return sectionProgress?.sentBackForReview === true;
}

export function applySendBackForReview(
  section: SectionActivityStatus
): SectionActivityStatus {
  const updated: SectionActivityStatus = { ...section };

  if (updated.practice === "done") {
    updated.practice = "available";
    updated.practiceApproved = false;
    delete updated.practiceProofUrl;
  }

  if (updated.learn === "help") updated.learn = "available";
  if (updated.practice === "help") updated.practice = "available";
  if (updated.extra === "help") updated.extra = "available";

  updated.sentBackForReview = true;
  return updated;
}

export function resolveHelpAsAllGood(
  section: SectionActivityStatus
): SectionActivityStatus {
  const updated: SectionActivityStatus = { ...section };

  if (updated.learn === "help") updated.learn = "available";
  if (updated.practice === "help") updated.practice = "available";
  if (updated.extra === "help") updated.extra = "available";

  return updated;
}

export type TeacherSectionStatus =
  | "not-started"
  | "in-progress"
  | "complete"
  | "help"
  | "review";

export function getTeacherSectionStatus(
  progress: StudentProgress,
  sectionId: string,
  sectionIds: string[]
): TeacherSectionStatus {
  const sectionProgress = progress.sections[sectionId];

  if (needsTeacherReview(sectionProgress)) return "review";

  const sectionIdx = sectionIds.indexOf(sectionId);
  if (sectionIdx < 0) return "not-started";

  const currentIdx = getCurrentSectionIndex(progress, sectionIds);

  if (sectionIdx < currentIdx) return "complete";
  if (sectionIdx > currentIdx) return "not-started";
  if (sectionHasHelp(sectionProgress)) return "help";
  return "in-progress";
}

/** Count help requests visible to the teacher across all units. */
export function countClassHelpRequests(
  units: CurriculumUnit[],
  classProgress: StudentProgress[],
  blockSectionId: string | null
): number {
  if (units.length === 0) return 0;

  const currentUnitIndex = getCurrentUnitIndex(units, blockSectionId);
  let count = 0;

  for (let uIdx = 0; uIdx < units.length; uIdx++) {
    const unitPhase = getUnitPhase(uIdx, currentUnitIndex);
    if (unitPhase === "upcoming") continue;

    const sectionIds = units[uIdx].subunits.map((s) => s.id);
    const isActiveUnit = unitPhase === "active";
    const gateActive = isActiveUnit && blockSectionId !== null;
    const blockIndex = blockSectionId ? sectionIds.indexOf(blockSectionId) : -1;

    for (const progress of classProgress) {
      for (let sIdx = 0; sIdx < sectionIds.length; sIdx++) {
        if (unitPhase === "finished") continue;
        if (gateActive && blockIndex >= 0 && sIdx > blockIndex) continue;
        if (getTeacherSectionStatus(progress, sectionIds[sIdx], sectionIds) === "help") {
          count++;
        }
      }
    }
  }

  return count;
}

export function getStudentSectionStatus(
  progress: StudentProgress,
  sectionId: string,
  sectionIds: string[]
): "not-started" | "in-progress" | "complete" | "help" {
  const sectionIdx = sectionIds.indexOf(sectionId);
  if (sectionIdx < 0) return "not-started";

  const currentIdx = getCurrentSectionIndex(progress, sectionIds);

  if (sectionIdx < currentIdx) return "complete";
  if (sectionIdx > currentIdx) return "not-started";

  const sectionProgress = progress.sections[sectionId];
  if (sectionHasHelp(sectionProgress)) return "help";
  return "in-progress";
}
