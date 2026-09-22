"use client";

import { isDemoMode } from "../demo-seed";
import { supabaseConfigured } from "../supabase/client";
import { DEMO_DB_KEY, DEMO_SESSION_KEY, LocalStore } from "./local";
import { SyncedStore } from "./synced";
import type { Store } from "./types";

export type {
  ClassDetail,
  ClassPatch,
  ClassRole,
  RosterStudent,
  SectionRemap,
  Store,
  SyncState,
  SyncStatus,
} from "./types";
export { STORE_CHANGED_EVENT, SYNC_EVENT } from "./types";
export { findSubunit, getAllSubunits } from "./local";
export { outbox, FORCE_OFFLINE_KEY } from "./outbox";

let demoStore: LocalStore | null = null;
let syncedStore: SyncedStore | null = null;

/**
 * Which store is live right now. The demo is a world of its own in
 * localStorage and never touches the server; everyone else goes through the
 * synced store. Decided per call, because entering or leaving the demo
 * changes the answer without a reload.
 */
export function activeStore(): Store {
  if (isDemoMode()) {
    return (demoStore ??= new LocalStore(DEMO_DB_KEY, DEMO_SESSION_KEY));
  }
  if (!supabaseConfigured()) {
    throw new Error("Supabase is not configured. Open the demo, or set the env variables.");
  }
  return (syncedStore ??= new SyncedStore());
}

/** The synced store, when that is what is live — for sign-out housekeeping. */
export function syncedStoreIfActive(): SyncedStore | null {
  return isDemoMode() ? null : syncedStore;
}

/**
 * The one import the rest of the app uses. Each call is routed to whichever
 * store is live, so components never ask which world they are in.
 */
export const store: Store = {
  getCurrentUser: () => activeStore().getCurrentUser(),
  listClassSummaries: (userId) => activeStore().listClassSummaries(userId),
  getClassDetail: (classId, userId, role) => activeStore().getClassDetail(classId, userId, role),
  createClassForTeacher: (teacherId, templateId) =>
    activeStore().createClassForTeacher(teacherId, templateId),
  duplicateClass: (classId, teacherId) => activeStore().duplicateClass(classId, teacherId),
  deleteClass: (classId, teacherId) => activeStore().deleteClass(classId, teacherId),
  updateClass: (classId, patch) => activeStore().updateClass(classId, patch),
  applyCurriculum: (classId, units, remaps, expectedVersion) =>
    activeStore().applyCurriculum(classId, units, remaps, expectedVersion),
  unenrollStudent: (classId, studentId) => activeStore().unenrollStudent(classId, studentId),
  joinClassWithCode: (userId, code) => activeStore().joinClassWithCode(userId, code),
  inviteToClass: (classId, teacherId, handle) =>
    activeStore().inviteToClass(classId, teacherId, handle),
  saveStudentProgress: (progress) => activeStore().saveStudentProgress(progress),
  saveAllClassProgress: (classId, all) => activeStore().saveAllClassProgress(classId, all),
  setUserAccent: (userId, accent) => activeStore().setUserAccent(userId, accent),
};
