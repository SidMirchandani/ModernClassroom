export type ActivityStatus = "locked" | "available" | "done" | "help";

export interface SectionObjective {
  id: string;
  text: string;
}

/**
 * A section is split by *resource*, not by generic phase. The three sources a
 * course leans on (an approved textbook, AP Classroom, a guided-notes series)
 * never line up section-for-section, so each gets its own parallel track with
 * its own reference numbering and its own learning targets.
 */
export type TrackKind = "textbook" | "apclassroom" | "guided" | "extra" | "custom";

/** Inside a track the order is fixed: read/watch it, then do the deliverable. */
export type TrackStep = "learn" | "practice";

export type ContentBlockType = TrackStep;

export interface BlockAttachment {
  id: string;
  kind: "link" | "file";
  label?: string;
  url: string;
  fileName?: string;
}

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  title: string;
  description?: string;
  attachments: BlockAttachment[];
}

export interface ResourceTrack {
  id: string;
  kind: TrackKind;
  label: string;
  /** This resource's own numbering for the section, e.g. "Ch 2.4" or "Topic 1.7". */
  reference?: string;
  /** Learning targets specific to this resource (CED targets live here for AP Classroom). */
  objectives: SectionObjective[];
  blocks: ContentBlock[];
  /** Optional tracks are visible and trackable but never gate section completion. */
  optional?: boolean;
  /** Practice in this track needs a screenshot before it can be marked Done. */
  proofRequired?: boolean;
}

/** @deprecated Pre-track block shape kept only so stored curricula can be migrated. */
export interface LegacyContentBlock {
  id: string;
  type: string;
  title: string;
  description?: string;
  attachments: BlockAttachment[];
}

export interface Section {
  id: string;
  title: string;
  /** Targets that hold across every resource for this section. */
  objectives: SectionObjective[];
  tracks: ResourceTrack[];
  /** Soft due date from the class timeline. Free text — "10/12" or "10/12 or 10/13". */
  date?: string;
  /** @deprecated Legacy field — migrated to tracks on load */
  blocks?: LegacyContentBlock[];
  /** @deprecated Legacy field — migrated to tracks on load */
  learnResources?: { label: string; url: string }[];
  /** @deprecated Legacy field — migrated to tracks on load */
  practiceDescription?: string;
  /** @deprecated Legacy field — migrated to tracks on load */
  extraMaterials?: { label: string; url: string }[];
}

export type CheckpointKind = "quiz" | "test" | "checkpoint" | "project";

/** A dated marker sitting between sections — the thing students study toward. */
export interface Checkpoint {
  id: string;
  kind: CheckpointKind;
  title: string;
  /** Free text so "10/12 or 10/13" survives intact. */
  date?: string;
  /** Sits after this section in the unit; null pins it to the top. */
  afterSectionId: string | null;
  note?: string;
  /** What it is scored out of. Absent means the default. */
  maxPoints?: number;
}

/**
 * A student's result on one checkpoint. The total is stored per student rather
 * than read from the checkpoint, so a mark entered under an old total still
 * reads correctly until that grade sheet is saved again.
 */
export interface CheckpointGrade {
  score: number;
  outOf: number;
}

export interface Unit {
  id: number;
  title: string;
  sections: Section[];
  checkpoints: Checkpoint[];
}

export interface TrackProgress {
  learn: ActivityStatus;
  practice: ActivityStatus;
  practiceProofUrl?: string;
  /** Teacher has approved the practice submission */
  practiceApproved?: boolean;
  /** Teacher sent work back — student should revise and resubmit */
  sentBackForReview?: boolean;
  gradeNumerator?: number;
  gradeDenominator?: number;
}

export type SectionActivityStatus = {
  tracks: Record<string, TrackProgress>;
  /** @deprecated Pre-track flat shape — migrated into `tracks` on load */
  learn?: ActivityStatus;
  /** @deprecated Pre-track flat shape — migrated into `tracks` on load */
  practice?: ActivityStatus;
  /** @deprecated Pre-track flat shape — migrated into `tracks` on load */
  extra?: ActivityStatus;
  /** @deprecated Pre-track flat shape — migrated into `tracks` on load */
  practiceProofUrl?: string;
  /** @deprecated Pre-track flat shape — migrated into `tracks` on load */
  practiceApproved?: boolean;
  /** @deprecated Pre-track flat shape — migrated into `tracks` on load */
  sentBackForReview?: boolean;
};

export interface StudentProgress {
  studentId: string;
  unitId: number;
  sections: Record<string, SectionActivityStatus>;
  /** Keyed by checkpoint id. Only graded checkpoints appear. */
  checkpoints?: Record<string, CheckpointGrade>;
}

export interface Student {
  id: string;
  name: string;
  avatar: string;
}
