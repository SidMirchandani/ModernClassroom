import type {
  ActivityStatus,
  ResourceTrack,
  Section,
  SectionActivityStatus,
  StudentProgress,
  TrackProgress,
  TrackStep,
} from "./types";
import type { CurriculumUnit } from "./db/types";
import {
  getActiveSteps,
  getRequiredTracks,
  getTracks,
  getVisibleTracks,
  isTrackEmpty,
  stableTrackId,
} from "./section-tracks";
import { getCurrentUnitIndex, getUnitPhase } from "./unit-phase";

export function isActivityFinished(status: ActivityStatus | undefined): boolean {
  return status === "done" || status === "help";
}

export function emptyTrackProgress(): TrackProgress {
  return { learn: "locked", practice: "locked" };
}

/**
 * Progress written before sections were split by resource stored one flat
 * learn/practice/extra triple per section. Legacy curricula migrate to a
 * "Coursework" track plus an "Extra Material" track with deterministic ids,
 * so the old triple maps straight onto them.
 */
export function migrateSectionProgress(
  sectionId: string,
  stored: SectionActivityStatus | undefined
): SectionActivityStatus {
  if (!stored) return { tracks: {} };
  if (stored.tracks) return stored;

  const tracks: Record<string, TrackProgress> = {};

  if (stored.learn || stored.practice) {
    tracks[stableTrackId(sectionId, "custom")] = {
      learn: stored.learn ?? "locked",
      practice: stored.practice ?? "locked",
      ...(stored.practiceProofUrl ? { practiceProofUrl: stored.practiceProofUrl } : {}),
      ...(stored.practiceApproved !== undefined
        ? { practiceApproved: stored.practiceApproved }
        : {}),
      ...(stored.sentBackForReview ? { sentBackForReview: true } : {}),
    };
  }

  if (stored.extra) {
    tracks[stableTrackId(sectionId, "extra")] = {
      learn: stored.extra,
      practice: "locked",
    };
  }

  return { tracks };
}

export function getTrackProgress(
  sectionProgress: SectionActivityStatus | undefined,
  trackId: string
): TrackProgress | undefined {
  return sectionProgress?.tracks?.[trackId];
}

/** Every step this track actually asks for is marked Done. */
export function isTrackComplete(
  track: ResourceTrack,
  trackProgress: TrackProgress | undefined
): boolean {
  const steps = getActiveSteps(track);
  if (steps.length === 0) return true;
  return steps.every((step) => trackProgress?.[step] === "done");
}

/** Done *or* Help — asking for help never blocks you from moving on. */
export function isTrackFinished(
  track: ResourceTrack,
  trackProgress: TrackProgress | undefined
): boolean {
  const steps = getActiveSteps(track);
  if (steps.length === 0) return true;
  return steps.every((step) => isActivityFinished(trackProgress?.[step]));
}

export function trackHasHelp(
  track: ResourceTrack,
  trackProgress: TrackProgress | undefined
): boolean {
  return getActiveSteps(track).some((step) => trackProgress?.[step] === "help");
}

/** A section is complete when every required track is Done end to end. */
export function isSectionComplete(
  section: Section | undefined,
  sectionProgress: SectionActivityStatus | undefined
): boolean {
  if (!section) return false;
  const required = getRequiredTracks(section);
  if (required.length === 0) return false;
  return required.every((track) =>
    isTrackComplete(track, getTrackProgress(sectionProgress, track.id))
  );
}

/** Loose version used for unlocking — Help counts as finished. */
export function isSectionFinished(
  section: Section | undefined,
  sectionProgress: SectionActivityStatus | undefined
): boolean {
  if (!section) return false;
  const required = getRequiredTracks(section);
  if (required.length === 0) return true;
  return required.every((track) =>
    isTrackFinished(track, getTrackProgress(sectionProgress, track.id))
  );
}

export function sectionHasHelp(
  section: Section | undefined,
  sectionProgress: SectionActivityStatus | undefined
): boolean {
  if (!section) return false;
  return getVisibleTracks(section).some((track) =>
    trackHasHelp(track, getTrackProgress(sectionProgress, track.id))
  );
}

export function isBeyondBlock(
  sections: Section[],
  sectionId: string,
  blockSectionId: string | null
): boolean {
  if (!blockSectionId) return false;
  const blockIdx = sections.findIndex((s) => s.id === blockSectionId);
  const sectionIdx = sections.findIndex((s) => s.id === sectionId);
  if (blockIdx < 0 || sectionIdx < 0) return false;
  return sectionIdx > blockIdx;
}

export function canAccessSection(
  progress: StudentProgress,
  sectionId: string,
  sections: Section[],
  blockSectionId: string | null = null
): boolean {
  const idx = sections.findIndex((s) => s.id === sectionId);
  if (idx < 0) return false;
  if (isBeyondBlock(sections, sectionId, blockSectionId)) return false;
  if (idx === 0) return true;

  for (let i = 0; i < idx; i++) {
    const prev = sections[i];
    if (!isSectionFinished(prev, progress.sections[prev.id])) return false;
  }
  return true;
}

/**
 * Resolve a track's live status. Tracks run in parallel — all of them open as
 * soon as the section does, because the textbook and AP Classroom cover the
 * same objectives in a different order. Inside a track, Learn gates Practice.
 */
export function resolveTrackProgress(
  track: ResourceTrack,
  stored: TrackProgress | undefined,
  accessible: boolean
): TrackProgress {
  const base: TrackProgress = stored ?? emptyTrackProgress();

  if (!accessible) {
    return {
      ...base,
      learn: "locked",
      practice: "locked",
    };
  }

  const steps = getActiveSteps(track);
  const hasLearn = steps.includes("learn");
  const hasPractice = steps.includes("practice");

  let learn = base.learn;
  if (hasLearn && learn === "locked") learn = "available";

  let practice = base.practice;
  if (hasPractice && practice === "locked" && (!hasLearn || isActivityFinished(learn))) {
    practice = "available";
  }

  return { ...base, learn, practice };
}

export function resolveSectionProgress(
  progress: StudentProgress,
  sectionId: string,
  sections: Section[],
  blockSectionId: string | null = null
): SectionActivityStatus {
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return { tracks: {} };

  const stored = migrateSectionProgress(sectionId, progress.sections[sectionId]);
  const accessible = canAccessSection(progress, sectionId, sections, blockSectionId);
  const tracks: Record<string, TrackProgress> = {};

  for (const track of getTracks(section)) {
    if (isTrackEmpty(track)) continue;
    tracks[track.id] = resolveTrackProgress(track, stored.tracks?.[track.id], accessible);
  }

  return { tracks };
}

export function normalizeProgress(
  progress: StudentProgress,
  sections: Section[],
  blockSectionId: string | null = null
): StudentProgress {
  const sectionStates: StudentProgress["sections"] = {};

  for (const section of sections) {
    sectionStates[section.id] = resolveSectionProgress(
      progress,
      section.id,
      sections,
      blockSectionId
    );
  }

  return { ...progress, sections: sectionStates };
}

/** Index of the first section that is not fully complete. */
export function getCurrentSectionIndex(
  progress: StudentProgress,
  sections: Section[]
): number {
  const idx = sections.findIndex(
    (section) => !isSectionComplete(section, progress.sections[section.id])
  );
  return idx === -1 ? sections.length : idx;
}

/** Practice submitted but not yet signed off by the teacher. */
export function trackNeedsReview(
  track: ResourceTrack,
  trackProgress: TrackProgress | undefined
): boolean {
  if (!trackProgress) return false;
  if (!getActiveSteps(track).includes("practice")) return false;
  return trackProgress.practice === "done" && trackProgress.practiceApproved !== true;
}

export function needsTeacherReview(
  section: Section | undefined,
  sectionProgress: SectionActivityStatus | undefined
): boolean {
  if (!section) return false;
  return getVisibleTracks(section).some((track) =>
    trackNeedsReview(track, getTrackProgress(sectionProgress, track.id))
  );
}

export function hasRevisionNotice(
  sectionProgress: SectionActivityStatus | undefined
): boolean {
  if (!sectionProgress?.tracks) return false;
  return Object.values(sectionProgress.tracks).some((t) => t.sentBackForReview === true);
}

export function trackHasRevisionNotice(
  trackProgress: TrackProgress | undefined
): boolean {
  return trackProgress?.sentBackForReview === true;
}

function sendBackTrack(track: TrackProgress): TrackProgress {
  const updated: TrackProgress = { ...track };

  if (updated.practice === "done") {
    updated.practice = "available";
    updated.practiceApproved = false;
    delete updated.practiceProofUrl;
  }

  if (updated.learn === "help") updated.learn = "available";
  if (updated.practice === "help") updated.practice = "available";

  updated.sentBackForReview = true;
  return updated;
}

/** Send one track back for revision; the rest of the section is untouched. */
export function applySendBackForTrack(
  section: SectionActivityStatus,
  trackId: string
): SectionActivityStatus {
  const existing = section.tracks?.[trackId];
  if (!existing) return section;
  return {
    ...section,
    tracks: { ...section.tracks, [trackId]: sendBackTrack(existing) },
  };
}

export function applySendBackForReview(
  section: SectionActivityStatus
): SectionActivityStatus {
  const tracks: Record<string, TrackProgress> = {};
  for (const [id, track] of Object.entries(section.tracks ?? {})) {
    tracks[id] = sendBackTrack(track);
  }
  return { ...section, tracks };
}

function clearHelp(track: TrackProgress): TrackProgress {
  const updated: TrackProgress = { ...track };
  if (updated.learn === "help") updated.learn = "available";
  if (updated.practice === "help") updated.practice = "available";
  return updated;
}

export function resolveHelpAsAllGood(
  section: SectionActivityStatus
): SectionActivityStatus {
  const tracks: Record<string, TrackProgress> = {};
  for (const [id, track] of Object.entries(section.tracks ?? {})) {
    tracks[id] = clearHelp(track);
  }
  return { ...section, tracks };
}

export function resolveHelpForTrack(
  section: SectionActivityStatus,
  trackId: string
): SectionActivityStatus {
  const existing = section.tracks?.[trackId];
  if (!existing) return section;
  return {
    ...section,
    tracks: { ...section.tracks, [trackId]: clearHelp(existing) },
  };
}

/** Approve a track's practice submission. */
export function applyApproveTrack(
  section: SectionActivityStatus,
  trackId: string
): SectionActivityStatus {
  const existing = section.tracks?.[trackId];
  if (!existing) return section;
  return {
    ...section,
    tracks: {
      ...section.tracks,
      [trackId]: { ...existing, practiceApproved: true, sentBackForReview: false },
    },
  };
}

export type TeacherSectionStatus =
  | "not-started"
  | "in-progress"
  | "complete"
  | "help"
  | "review";

/** Status of one resource track for one student — what the teacher grid shows. */
export function getTeacherTrackStatus(
  track: ResourceTrack,
  trackProgress: TrackProgress | undefined,
  accessible: boolean
): TeacherSectionStatus {
  if (trackNeedsReview(track, trackProgress)) return "review";
  if (trackHasHelp(track, trackProgress)) return "help";
  if (isTrackComplete(track, trackProgress)) return "complete";
  if (!accessible) return "not-started";

  const steps = getActiveSteps(track);
  const started = steps.some((step) => {
    const status = trackProgress?.[step];
    return status === "done" || status === "help";
  });
  return started ? "in-progress" : "not-started";
}

export function getTeacherSectionStatus(
  progress: StudentProgress,
  sectionId: string,
  sections: Section[]
): TeacherSectionStatus {
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return "not-started";

  const sectionProgress = progress.sections[sectionId];

  if (needsTeacherReview(section, sectionProgress)) return "review";

  const sectionIdx = sections.findIndex((s) => s.id === sectionId);
  const currentIdx = getCurrentSectionIndex(progress, sections);

  if (sectionIdx < currentIdx) return "complete";
  if (sectionIdx > currentIdx) return "not-started";
  if (sectionHasHelp(section, sectionProgress)) return "help";
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
    if (unitPhase !== "active") continue;

    const sections = units[uIdx].subunits;
    const blockIndex = blockSectionId
      ? sections.findIndex((s) => s.id === blockSectionId)
      : -1;

    for (const progress of classProgress) {
      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        if (blockIndex >= 0 && sIdx > blockIndex) continue;
        const section = sections[sIdx];
        const sectionProgress = progress.sections[section.id];
        for (const track of getVisibleTracks(section)) {
          if (trackHasHelp(track, getTrackProgress(sectionProgress, track.id))) count++;
        }
      }
    }
  }

  return count;
}

export function getStudentSectionStatus(
  progress: StudentProgress,
  sectionId: string,
  sections: Section[]
): "not-started" | "in-progress" | "complete" | "help" {
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return "not-started";

  const sectionIdx = sections.findIndex((s) => s.id === sectionId);
  const currentIdx = getCurrentSectionIndex(progress, sections);

  if (sectionIdx < currentIdx) return "complete";
  if (sectionIdx > currentIdx) return "not-started";

  if (sectionHasHelp(section, progress.sections[sectionId])) return "help";
  return "in-progress";
}

/** Apply a student status change to one step of one track. */
export function applyStepStatus(
  sectionProgress: SectionActivityStatus | undefined,
  trackId: string,
  step: TrackStep,
  status: "done" | "help",
  proofUrl?: string
): SectionActivityStatus {
  const tracks = { ...(sectionProgress?.tracks ?? {}) };
  const existing = tracks[trackId] ?? emptyTrackProgress();
  const updated: TrackProgress = { ...existing, [step]: status };

  if (step === "practice") {
    if (status === "done") {
      if (proofUrl) updated.practiceProofUrl = proofUrl;
      updated.practiceApproved = false;
      updated.sentBackForReview = false;
    } else {
      updated.practiceApproved = undefined;
    }
  }

  tracks[trackId] = updated;
  return { ...sectionProgress, tracks };
}

/** Fraction of required track steps a student has marked Done in a section. */
export function getSectionCompletionRatio(
  section: Section,
  sectionProgress: SectionActivityStatus | undefined
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const track of getRequiredTracks(section)) {
    const trackProgress = getTrackProgress(sectionProgress, track.id);
    for (const step of getActiveSteps(track)) {
      total++;
      if (trackProgress?.[step] === "done") done++;
    }
  }
  return { done, total };
}
