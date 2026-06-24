import type { Section, SectionActivityStatus } from "../types";

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
  createdAt: string;
}

export interface CurriculumUnit {
  id: string;
  title: string;
  subunits: Section[];
}

export interface DbClass {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  units: CurriculumUnit[];
  blockSectionId: string | null;
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

export interface DbProgressSection extends SectionActivityStatus {
  gradeNumerator?: number;
  gradeDenominator?: number;
}

export interface DbStudentProgress {
  classId: string;
  studentId: string;
  sections: Record<string, DbProgressSection>;
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
}

export interface ClassSummary {
  id: string;
  name: string;
  code: string;
  role: "teacher" | "student";
  studentCount: number;
  subunitCount: number;
}
