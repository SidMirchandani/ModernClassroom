import { applySendBackForReview, resolveHelpAsAllGood } from "./class-progress";
import { DEMO_PROGRESS } from "./data";
import { DEMO_PROOF_PLACEHOLDER } from "./demo-proof";
import type { StudentProgress } from "./types";

const STORAGE_KEY = "modern-classroom-progress";
export const PROGRESS_CHANGE_EVENT = "progress-change";

function enrichProgress(data: StudentProgress[]): StudentProgress[] {
  return data.map((p) => ({
    ...p,
    sections: Object.fromEntries(
      Object.entries(p.sections).map(([id, sp]) => {
        if (sp.practice !== "done") return [id, sp];
        return [
          id,
          {
            ...sp,
            practiceProofUrl: sp.practiceProofUrl ?? DEMO_PROOF_PLACEHOLDER,
            practiceApproved: sp.practiceApproved ?? p.studentId === "s4",
          },
        ];
      })
    ),
  }));
}

export function getInitialClassProgress(): StudentProgress[] {
  return enrichProgress(structuredClone(DEMO_PROGRESS));
}

export function loadClassProgress(): StudentProgress[] {
  if (typeof window === "undefined") return getInitialClassProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StudentProgress[];
  } catch {
    /* use fresh demo data */
  }
  const initial = getInitialClassProgress();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export function saveClassProgress(all: StudentProgress[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent(PROGRESS_CHANGE_EVENT));
}

export function loadStudentProgress(studentId: string): StudentProgress {
  const all = loadClassProgress();
  return (
    all.find((p) => p.studentId === studentId) ?? {
      studentId,
      unitId: 3,
      sections: {},
    }
  );
}

export function upsertStudentProgress(updated: StudentProgress): StudentProgress[] {
  const all = loadClassProgress();
  const idx = all.findIndex((p) => p.studentId === updated.studentId);
  if (idx >= 0) all[idx] = updated;
  else all.push(updated);
  saveClassProgress(all);
  return all;
}

export function approvePracticeSubmission(
  studentId: string,
  sectionId: string
): StudentProgress[] {
  const all = loadClassProgress();
  const progress = all.find((p) => p.studentId === studentId);
  const section = progress?.sections[sectionId];
  if (!progress || !section) return all;

  progress.sections[sectionId] = {
    ...section,
    practiceApproved: true,
    sentBackForReview: false,
  };
  saveClassProgress(all);
  return all;
}

export function sendBackPracticeSubmission(
  studentId: string,
  sectionId: string
): StudentProgress[] {
  const all = loadClassProgress();
  const progress = all.find((p) => p.studentId === studentId);
  const section = progress?.sections[sectionId];
  if (!progress || !section) return all;

  progress.sections[sectionId] = applySendBackForReview(section);
  saveClassProgress(all);
  return all;
}

export function resolveHelpRequest(
  studentId: string,
  sectionId: string,
  resolution: "all-good" | "send-back"
): StudentProgress[] {
  const all = loadClassProgress();
  const progress = all.find((p) => p.studentId === studentId);
  const section = progress?.sections[sectionId];
  if (!progress || !section) return all;

  progress.sections[sectionId] =
    resolution === "send-back"
      ? applySendBackForReview(section)
      : resolveHelpAsAllGood(section);
  saveClassProgress(all);
  return all;
}
