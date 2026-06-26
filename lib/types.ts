export type ActivityStatus = "locked" | "available" | "done" | "help";

export interface Activity {
  type: "learn" | "practice" | "extra";
  label: string;
  url?: string;
  proofRequired?: boolean;
}

export interface SectionObjective {
  id: string;
  text: string;
}

export type ContentBlockType = "learn" | "practice" | "extra";

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

export interface Section {
  id: string;
  title: string;
  objectives: SectionObjective[];
  blocks: ContentBlock[];
  /** @deprecated Legacy field — migrated to blocks on load */
  learnResources?: { label: string; url: string }[];
  /** @deprecated Legacy field — migrated to blocks on load */
  practiceDescription?: string;
  /** @deprecated Legacy field — migrated to blocks on load */
  extraMaterials?: { label: string; url: string }[];
}

export interface Unit {
  id: number;
  title: string;
  sections: Section[];
  quizzes: { id: string; title: string; dueDate: string; afterSection: string }[];
  testDate: string;
}

export type SectionActivityStatus = {
  learn: ActivityStatus;
  practice: ActivityStatus;
  extra: ActivityStatus;
  practiceProofUrl?: string;
  /** Teacher has approved the practice screenshot submission */
  practiceApproved?: boolean;
  /** Teacher sent work back — student should revise and resubmit */
  sentBackForReview?: boolean;
  gradeNumerator?: number;
  gradeDenominator?: number;
};

export interface StudentProgress {
  studentId: string;
  unitId: number;
  sections: Record<string, SectionActivityStatus>;
}

export interface Student {
  id: string;
  name: string;
  avatar: string;
}
