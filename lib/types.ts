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

export interface Section {
  id: string;
  title: string;
  objectives: SectionObjective[];
  learnResources: { label: string; url: string }[];
  practiceDescription: string;
  extraMaterials: { label: string; url: string }[];
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
