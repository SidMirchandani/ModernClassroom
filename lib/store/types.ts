import type { AccentId } from "../class-appearance";
import type {
  ClassSummary,
  DbClass,
  DbInvite,
  DbStudentProgress,
  PublicUser,
} from "../db/types";
import type { CurriculumUnit } from "../db/types";

export type ClassRole = "teacher" | "student";

export interface RosterStudent {
  id: string;
  name: string;
  username: string;
  avatar: string;
}

export interface ClassDetail {
  class: DbClass;
  role: ClassRole;
  students: RosterStudent[];
  invites: DbInvite[];
  progress: DbStudentProgress[];
  teacherName: string;
}

export type ClassPatch = Partial<
  Pick<DbClass, "name" | "units" | "blockSectionId" | "color" | "icon" | "importInstructions">
>;

/** A section that changed number: every row keyed by `from` moves to `to`. */
export interface SectionRemap {
  from: string;
  to: string;
}

/**
 * Everything the app asks of its data. Two things implement it: the local
 * store, which is the demo and also the cache, and the synced store, which
 * wraps it with Supabase. Every call is async so the two are interchangeable.
 */
export interface Store {
  getCurrentUser(): Promise<PublicUser | null>;

  listClassSummaries(userId: string): Promise<ClassSummary[]>;
  getClassDetail(
    classId: string,
    userId: string,
    preferredRole?: ClassRole
  ): Promise<ClassDetail | null>;

  createClassForTeacher(teacherId: string, templateId?: string): Promise<DbClass>;
  duplicateClass(classId: string, teacherId: string): Promise<DbClass | null>;
  deleteClass(classId: string, teacherId: string): Promise<boolean>;
  updateClass(classId: string, patch: ClassPatch): Promise<DbClass | null>;
  /**
   * Writes a whole curriculum, moving every student's rows for any section
   * that changed number. With `expectedVersion` the write is refused if the
   * class changed since it was read; without, later wins.
   */
  applyCurriculum(
    classId: string,
    units: CurriculumUnit[],
    remaps: SectionRemap[],
    expectedVersion?: number | null
  ): Promise<DbClass | null>;

  unenrollStudent(classId: string, studentId: string): Promise<boolean>;
  joinClassWithCode(
    userId: string,
    code: string
  ): Promise<{ id: string; name: string; code: string }>;
  inviteToClass(
    classId: string,
    teacherId: string,
    handle: string
  ): Promise<{ students: RosterStudent[]; invites: DbInvite[] }>;

  saveStudentProgress(progress: DbStudentProgress): Promise<void>;
  saveAllClassProgress(classId: string, all: DbStudentProgress[]): Promise<void>;

  setUserAccent(userId: string, accent: AccentId): Promise<void>;

  /**
   * Erase the signed-in account and everything that cannot outlive it. Never
   * queued: this one needs the server to actually confirm it happened.
   */
  deleteAccount(): Promise<void>;
}

/** Fired after any change lands, locally or otherwise. Re-read on it. */
export const STORE_CHANGED_EVENT = "modern-classroom:store-changed";

export type SyncStatus = "synced" | "pending" | "offline" | "error";

export interface SyncState {
  status: SyncStatus;
  /** Writes still waiting to reach the server. */
  pending: number;
}

/** Fired whenever the sync state moves. `detail` is a `SyncState`. */
export const SYNC_EVENT = "modern-classroom:sync";
