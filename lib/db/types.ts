import type { AccentId, ClassIconId } from "../class-appearance";
import type {
  Checkpoint,
  CheckpointGrade,
  Section,
  SectionActivityStatus,
} from "../types";

/** @deprecated Global role is no longer used for permissions; class role is per-class. */
export type UserRole = "member" | "teacher" | "student";

export interface DbUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  /** Their own colour, chosen in the profile menu. Never the class's. */
  accent?: AccentId;
  createdAt: string;
}

export interface CurriculumUnit {
  id: string;
  title: string;
  subunits: Section[];
  /** Dated quizzes, tests and projects anchored between subunits. */
  checkpoints: Checkpoint[];
}

export interface DbClass {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  units: CurriculumUnit[];
  blockSectionId: string | null;
  /** Teacher's Customize choices. Absent means the house default. */
  color?: AccentId;
  icon?: ClassIconId;
  /** Standing guidance for the AI curriculum import, kept between runs. */
  importInstructions?: string;
  /** Bumped by the server on every curriculum write. Absent in the demo. */
  version?: number;
  createdAt: string;
}

export interface DbEnrollment {
  classId: string;
  studentId: string;
  joinedAt: string;
}

export interface DbInvite {
  id: string;
  classId: string;
  emailOrUsername: string;
  invitedAt: string;
}

export type DbProgressSection = SectionActivityStatus;

export interface DbStudentProgress {
  classId: string;
  studentId: string;
  sections: Record<string, DbProgressSection>;
  checkpoints?: Record<string, CheckpointGrade>;
}

export interface Database {
  users: DbUser[];
  classes: DbClass[];
  enrollments: DbEnrollment[];
  invites: DbInvite[];
  progress: DbStudentProgress[];
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  accent?: AccentId;
}

export interface ClassSummary {
  id: string;
  name: string;
  code: string;
  role: "teacher" | "student";
  studentCount: number;
  subunitCount: number;
  color?: AccentId;
  icon?: ClassIconId;
}
