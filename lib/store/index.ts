"use client";

import { supabaseConfigured } from "../supabase/client";
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

let syncedStore: SyncedStore | null = null;

/** The store everything goes through: the synced one, over Supabase. */
export function activeStore(): Store {
  if (!supabaseConfigured()) {
    throw new Error("Supabase is not configured. Set the env variables.");
  }
  return (syncedStore ??= new SyncedStore());
}

/** The synced store, when that is what is live — for sign-out housekeeping. */
export function syncedStoreIfActive(): SyncedStore | null {
  return syncedStore;
}

/**
 * The one import the rest of the app uses. Each call is routed to whichever
 * store is live, so components never ask which world they are in.
 */
export const store: Store = {
  getCurrentUser: () => activeStore().getCurrentUser(),
  listClassSummaries: (userId) => activeStore().listClassSummaries(userId),
  getClassDetail: (classId, userId, role) => activeStore().getClassDetail(classId, userId, role),
  createClassForTeacher: (teacherId, options) =>
    activeStore().createClassForTeacher(teacherId, options),
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
  deleteAccount: () => activeStore().deleteAccount(),
};
