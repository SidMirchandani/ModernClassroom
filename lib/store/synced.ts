"use client";

import type {
  ClassSummary,
  CurriculumUnit,
  DbClass,
  DbInvite,
  DbStudentProgress,
  PublicUser,
} from "../db/types";
import type { AccentId } from "../class-appearance";
import type { TrackProgress } from "../types";
import { supabase } from "../supabase/client";
import * as remote from "./remote";
import { connectionDown, isNetworkError, outbox } from "./outbox";
import { CACHE_DB_KEY, LocalStore, createDefaultClass, toPublicUser } from "./local";
import {
  STORE_CHANGED_EVENT,
  type ClassDetail,
  type ClassPatch,
  type ClassRole,
  type RosterStudent,
  type SectionRemap,
  type Store,
} from "./types";

/**
 * The store a signed-in person uses. Every read is answered from the local
 * cache, which is refreshed from Supabase first whenever the server can be
 * reached; every write lands in the cache at once and is queued for the
 * server. So the app renders the same way with or without a connection, and
 * the only visible difference is the sync pill in the navbar.
 */
export class SyncedStore implements Store {
  private readonly cache = new LocalStore(CACHE_DB_KEY);

  constructor() {
    outbox.listen();
  }

  /** Run a read against the server, or admit we cannot and say why. */
  private async pull<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (connectionDown()) {
      outbox.markOffline();
      return undefined;
    }
    try {
      return await fn();
    } catch (err) {
      if (isNetworkError(err)) {
        outbox.markOffline();
        return undefined;
      }
      throw err;
    }
  }

  /** Cache first, then the server — and the server is told right away. */
  private async commit(local: () => void, ops: Parameters<typeof outbox.enqueue>[0][]) {
    local();
    for (const op of ops) outbox.enqueue(op);
    await outbox.flush();
  }

  private announce(): void {
    window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
  }

  // ── who ──────────────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<PublicUser | null> {
    const {
      data: { session },
    } = await supabase().auth.getSession();
    if (!session) return null;

    const id = session.user.id;
    const email = session.user.email ?? "";

    let user = this.cache.findUser(id);
    if (!user) {
      const pulled = await this.pull(() => remote.pullProfile(id));
      if (!pulled) return null;
      user = { ...pulled, email };
      this.cache.upsertUser(user);
    }
    return toPublicUser({ ...user, email });
  }

  /** Refresh the signed-in person's own profile row. */
  async refreshProfile(): Promise<void> {
    const {
      data: { session },
    } = await supabase().auth.getSession();
    if (!session) return;
    const pulled = await this.pull(() => remote.pullProfile(session.user.id));
    if (pulled) this.cache.upsertUser({ ...pulled, email: session.user.email ?? "" });
  }

  async setUserAccent(userId: string, accent: AccentId): Promise<void> {
    await this.commit(
      () => void this.cache.setUserAccent(userId, accent),
      [{ kind: "accent", userId, accent }]
    );
  }

  // ── classes ──────────────────────────────────────────────────────────────

  async listClassSummaries(userId: string): Promise<ClassSummary[]> {
    await outbox.flush();
    const pulled = await this.pull(remote.pullSummaries);
    if (!pulled) return this.cache.listClassSummaries(userId);

    // Everything the server knows about my classes replaces what the cache
    // had — safe, because a class made offline has already been flushed by now.
    this.cache.mutate((db) => {
      db.classes = pulled.classes;
      db.enrollments = pulled.enrollments;
    }, false);
    return pulled.summaries;
  }

  private mergeClass(pulled: remote.ClassPull): void {
    this.cache.mutate((db) => {
      const idx = db.classes.findIndex((c) => c.id === pulled.class.id);
      if (idx >= 0) db.classes[idx] = pulled.class;
      else db.classes.push(pulled.class);

      for (const user of pulled.users) {
        const existing = db.users.find((u) => u.id === user.id);
        // Keep my own email, which the profile row does not carry.
        if (existing) Object.assign(existing, { ...user, email: existing.email });
        else db.users.push(user);
      }

      const id = pulled.class.id;
      db.enrollments = [
        ...db.enrollments.filter((e) => e.classId !== id),
        ...pulled.enrollments,
      ];
      db.invites = [...db.invites.filter((i) => i.classId !== id), ...pulled.invites];
      db.progress = [...db.progress.filter((p) => p.classId !== id), ...pulled.progress];
    }, false);
  }

  /** Bring one class up to date, unless writes for it are still waiting. */
  private async refreshClass(classId: string): Promise<void> {
    await outbox.flush();
    if (outbox.hasPendingFor(classId)) return;
    const pulled = await this.pull(() => remote.pullClass(classId));
    if (pulled) this.mergeClass(pulled);
  }

  async getClassDetail(
    classId: string,
    userId: string,
    preferredRole?: ClassRole
  ): Promise<ClassDetail | null> {
    await this.refreshClass(classId);
    return this.cache.getClassDetail(classId, userId, preferredRole);
  }

  async createClassForTeacher(teacherId: string, templateId?: string): Promise<DbClass> {
    const cls = createDefaultClass(teacherId, templateId);
    // The server mints the join code; until it has, this one is a placeholder
    // — the sync pill says so, and the next refresh replaces it.
    cls.code = "······";
    await this.commit(
      () => this.cache.insertClass(cls),
      [{ kind: "class.create", classId: cls.id, cls }]
    );
    await this.refreshClass(cls.id);
    return this.cache.read().classes.find((c) => c.id === cls.id) ?? cls;
  }

  async duplicateClass(classId: string, teacherId: string): Promise<DbClass | null> {
    const source = this.cache.read().classes.find((c) => c.id === classId);
    if (!source || source.teacherId !== teacherId) return null;

    const copy: DbClass = {
      ...createDefaultClass(teacherId),
      name: `${source.name} (copy)`,
      code: "······",
      units: structuredClone(source.units),
      blockSectionId: null,
      color: source.color,
      icon: source.icon,
    };
    await this.commit(
      () => this.cache.insertClass(copy),
      [{ kind: "class.create", classId: copy.id, cls: copy }]
    );
    await this.refreshClass(copy.id);
    return this.cache.read().classes.find((c) => c.id === copy.id) ?? copy;
  }

  async deleteClass(classId: string, teacherId: string): Promise<boolean> {
    const owns = this.cache
      .read()
      .classes.some((c) => c.id === classId && c.teacherId === teacherId);
    if (!owns) return false;
    await this.commit(
      () => void this.cache.deleteClass(classId, teacherId),
      [{ kind: "class.delete", classId }]
    );
    return true;
  }

  async updateClass(classId: string, patch: ClassPatch): Promise<DbClass | null> {
    const { units, ...meta } = patch;
    const ops: Parameters<typeof outbox.enqueue>[0][] = [];
    if (Object.keys(meta).length > 0) ops.push({ kind: "class.update", classId, patch: meta });
    if (units) ops.push({ kind: "class.units", classId, units, remaps: [] });

    // The local store's writes complete synchronously; the promise is just
    // its interface. Reading back after is the reliable way to get the row.
    await this.commit(() => void this.cache.updateClass(classId, patch), ops);
    return this.cache.read().classes.find((c) => c.id === classId) ?? null;
  }

  async applyCurriculum(
    classId: string,
    units: CurriculumUnit[],
    remaps: SectionRemap[],
    expectedVersion?: number | null
  ): Promise<DbClass | null> {
    if (expectedVersion != null) {
      // A checked write has to reach the server to mean anything.
      if (connectionDown()) throw new Error("You need to be online to apply an import.");
      const version = await remote.applyCurriculum(classId, units, remaps, expectedVersion);
      const cls = await this.cache.applyCurriculum(classId, units, remaps);
      if (cls) {
        this.cache.mutate((db) => {
          const c = db.classes.find((x) => x.id === classId);
          if (c) c.version = version;
        }, false);
      }
      await this.refreshClass(classId);
      return this.cache.read().classes.find((c) => c.id === classId) ?? cls;
    }

    await this.commit(
      () => void this.cache.applyCurriculum(classId, units, remaps),
      [{ kind: "class.units", classId, units, remaps }]
    );
    return this.cache.read().classes.find((c) => c.id === classId) ?? null;
  }

  // ── roster ───────────────────────────────────────────────────────────────

  async unenrollStudent(classId: string, studentId: string): Promise<boolean> {
    const seated = this.cache
      .read()
      .enrollments.some((e) => e.classId === classId && e.studentId === studentId);
    await this.commit(
      () => void this.cache.unenrollStudent(classId, studentId),
      [{ kind: "enroll.remove", classId, studentId }]
    );
    return seated;
  }

  async joinClassWithCode(
    _userId: string,
    code: string
  ): Promise<{ id: string; name: string; code: string }> {
    const trimmed = code.trim();
    if (!trimmed) throw new Error("Class code required");
    if (connectionDown()) throw new Error("You need to be online to join a class.");

    const classId = await remote.joinClass(trimmed);
    const pulled = await remote.pullClass(classId);
    if (!pulled) throw new Error("Invalid class code");
    this.mergeClass(pulled);
    this.announce();
    return { id: pulled.class.id, name: pulled.class.name, code: pulled.class.code };
  }

  async inviteToClass(
    classId: string,
    teacherId: string,
    handle: string
  ): Promise<{ students: RosterStudent[]; invites: DbInvite[] }> {
    if (connectionDown()) throw new Error("You need to be online to invite someone.");
    await remote.invite(classId, handle);
    const pulled = await remote.pullClass(classId);
    if (pulled) this.mergeClass(pulled);
    const detail = await this.cache.getClassDetail(classId, teacherId, "teacher");
    this.announce();
    return { students: detail?.students ?? [], invites: detail?.invites ?? [] };
  }

  // ── progress ─────────────────────────────────────────────────────────────

  /** Only what changed goes to the server — one row per touched track or grade. */
  private progressOps(next: DbStudentProgress): Parameters<typeof outbox.enqueue>[0][] {
    // Locked/available is worked out from the gate and the sections before on
    // every load, so a track that has never been touched carries nothing worth
    // a row. Without this, a student's first click wrote every track of every
    // section — two hundred rows of "locked".
    const informative = (state: TrackProgress | undefined) =>
      !!state &&
      (state.learn === "done" ||
        state.learn === "help" ||
        state.practice === "done" ||
        state.practice === "help" ||
        state.practiceProofUrl !== undefined ||
        state.practiceApproved !== undefined ||
        state.sentBackForReview !== undefined ||
        state.gradeNumerator !== undefined);

    const prev = this.cache
      .read()
      .progress.find((p) => p.classId === next.classId && p.studentId === next.studentId);
    const ops: Parameters<typeof outbox.enqueue>[0][] = [];

    for (const [sectionId, section] of Object.entries(next.sections)) {
      for (const [trackId, state] of Object.entries(section.tracks ?? {})) {
        const before = prev?.sections[sectionId]?.tracks?.[trackId];
        if (JSON.stringify(before) === JSON.stringify(state)) continue;
        if (!informative(state) && !informative(before)) continue;
        ops.push({
          kind: "progress",
          classId: next.classId,
          row: { studentId: next.studentId, sectionId, trackId, state },
        });
      }
    }

    const grades = next.checkpoints ?? {};
    const previousGrades = prev?.checkpoints ?? {};
    for (const checkpointId of new Set([...Object.keys(grades), ...Object.keys(previousGrades)])) {
      const before = previousGrades[checkpointId];
      const after = grades[checkpointId];
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      ops.push({
        kind: "grade",
        classId: next.classId,
        studentId: next.studentId,
        checkpointId,
        grade: after ?? null,
      });
    }
    return ops;
  }

  async saveStudentProgress(progress: DbStudentProgress): Promise<void> {
    const ops = this.progressOps(progress);
    await this.commit(() => void this.cache.saveStudentProgress(progress), ops);
  }

  async saveAllClassProgress(classId: string, all: DbStudentProgress[]): Promise<void> {
    const ops = all.flatMap((p) => this.progressOps(p));
    await this.commit(() => void this.cache.saveAllClassProgress(classId, all), ops);
  }

  // ── session ──────────────────────────────────────────────────────────────

  /**
   * Erase the account. This is the one write that never goes near the outbox:
   * queueing an irreversible deletion would mean telling someone their account
   * was gone while it still existed, so it needs a live connection and a real
   * answer from the server. Only once that comes back is the local copy wiped.
   */
  async deleteAccount(): Promise<void> {
    if (connectionDown()) {
      throw new Error("You need a connection to delete your account");
    }
    await remote.deleteAccount();
    outbox.clear();
    this.cache.clear();
    this.announce();
  }

  /** Signing out. Whatever is still queued is pushed first if it can be. */
  async forget(): Promise<void> {
    await outbox.flush();
    if (outbox.size() > 0) {
      console.warn("[sync] signed out with unsynced changes; they were discarded");
    }
    outbox.clear();
    this.cache.clear();
  }
}
