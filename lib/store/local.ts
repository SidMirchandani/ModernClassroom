import { v4 as uuidv4 } from "uuid";
import type {
  ClassSummary,
  CurriculumUnit,
  Database,
  DbClass,
  DbInvite,
  DbStudentProgress,
  DbUser,
  PublicUser,
} from "../db/types";
import type { Section } from "../types";
import { emptySection } from "../curriculum";
import { getCourseTemplate, instantiateTemplate } from "../course-templates";
import { getUserInitials } from "../avatar";
import { randomAccent, type AccentId } from "../class-appearance";
import {
  STORE_CHANGED_EVENT,
  type ClassDetail,
  type ClassPatch,
  type ClassRole,
  type RosterStudent,
  type SectionRemap,
  type Store,
} from "./types";

/** The demo's whole world lives under this key. */
export const DEMO_DB_KEY = "modern-classroom-db";
/** Who the demo is signed in as. */
export const DEMO_SESSION_KEY = "modern-classroom-session";

/** A signed-in user's offline copy of everything they have looked at. */
export const CACHE_DB_KEY = "modern-classroom-cache";

const EMPTY_DB: Database = {
  users: [],
  classes: [],
  enrollments: [],
  invites: [],
  progress: [],
};

export function toPublicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    accent: user.accent,
  };
}

function toRoster(users: DbUser[]): RosterStudent[] {
  return users.map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`,
    username: s.username,
    avatar: getUserInitials(s.firstName, s.lastName),
  }));
}

export function getAllSubunits(cls: DbClass): Section[] {
  return cls.units.flatMap((u) => u.subunits);
}

export function findSubunit(
  cls: DbClass,
  subunitId: string
): { unit: CurriculumUnit; subunit: Section } | null {
  for (const unit of cls.units) {
    const subunit = unit.subunits.find((s) => s.id === subunitId);
    if (subunit) return { unit, subunit };
  }
  return null;
}

export function createDefaultClass(teacherId: string, templateId?: string): DbClass {
  const template = templateId ? getCourseTemplate(templateId) : undefined;

  const units: CurriculumUnit[] = template
    ? instantiateTemplate(template)
    : [
        {
          id: uuidv4(),
          title: "Unit 1",
          subunits: [emptySection("1.1", "Subunit 1.1")],
          checkpoints: [],
        },
      ];

  // A whole year of units arrives at once from a template, so the gate starts
  // at the end of the first unit — the class opens as the teacher moves it.
  const blockSectionId = template ? units[0]?.subunits.at(-1)?.id ?? null : null;

  return {
    id: uuidv4(),
    name: template?.name ?? "New Class",
    code: "000000",
    teacherId,
    units,
    blockSectionId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Renumbering a section is moving its key everywhere that key appears: each
 * student's progress, the gate, and every checkpoint anchored after it. The
 * same rewrite the server does in `apply_curriculum`, for the demo and the
 * cache. Progress rows are moved, never dropped.
 */
export function remapSections(
  db: Database,
  classId: string,
  remaps: SectionRemap[]
): void {
  const cls = db.classes.find((c) => c.id === classId);
  for (const { from, to } of remaps) {
    if (!from || !to || from === to) continue;
    for (const p of db.progress) {
      if (p.classId !== classId || !p.sections[from]) continue;
      if (!p.sections[to]) p.sections[to] = p.sections[from];
      delete p.sections[from];
    }
    if (cls?.blockSectionId === from) cls.blockSectionId = to;
  }
}

/**
 * The store as it has always been: one JSON document in localStorage. It is
 * the demo, complete and offline; and for a signed-in user it is the cache the
 * synced store reads from, so every screen renders the same way with or
 * without a connection.
 */
export class LocalStore implements Store {
  constructor(
    private readonly key: string,
    private readonly sessionKey: string | null = null
  ) {}

  // ── the document ─────────────────────────────────────────────────────────

  read(): Database {
    if (typeof window === "undefined") return structuredClone(EMPTY_DB);
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return structuredClone(EMPTY_DB);
      return JSON.parse(raw) as Database;
    } catch {
      return structuredClone(EMPTY_DB);
    }
  }

  write(db: Database, announce = true): void {
    localStorage.setItem(this.key, JSON.stringify(db));
    if (announce && typeof window !== "undefined") {
      window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
    }
  }

  /** Read, change, write — every mutation below goes through here. */
  mutate<T>(fn: (db: Database) => T, announce = true): T {
    const db = this.read();
    const result = fn(db);
    this.write(db, announce);
    return result;
  }

  clear(): void {
    localStorage.removeItem(this.key);
  }

  // ── who ──────────────────────────────────────────────────────────────────

  sessionUserId(): string | null {
    if (!this.sessionKey || typeof window === "undefined") return null;
    return localStorage.getItem(this.sessionKey);
  }

  async getCurrentUser(): Promise<PublicUser | null> {
    const id = this.sessionUserId();
    if (!id) return null;
    const user = this.read().users.find((u) => u.id === id);
    return user ? toPublicUser(user) : null;
  }

  findUser(id: string): DbUser | null {
    return this.read().users.find((u) => u.id === id) ?? null;
  }

  /** Put a user in the document (the cache learns of people as it meets them). */
  upsertUser(user: DbUser): void {
    this.mutate((db) => {
      const idx = db.users.findIndex((u) => u.id === user.id);
      if (idx >= 0) db.users[idx] = { ...db.users[idx], ...user };
      else db.users.push(user);
    }, false);
  }

  createUser(data: Omit<DbUser, "id" | "createdAt">): DbUser {
    return this.mutate((db) => {
      if (db.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
        throw new Error("Email already registered");
      }
      if (db.users.some((u) => u.username.toLowerCase() === data.username.toLowerCase())) {
        throw new Error("Username already taken");
      }
      const user: DbUser = {
        // Assigned, not asked for — a new account arrives already wearing a
        // colour, and the profile menu is where it gets changed.
        accent: randomAccent(),
        ...data,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      return user;
    });
  }

  async setUserAccent(userId: string, accent: AccentId): Promise<void> {
    this.mutate((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (user) user.accent = accent;
    });
  }

  // ── roles ────────────────────────────────────────────────────────────────

  /**
   * Roles are per-class, and a user can hold both — the demo account teaches
   * its classes and is enrolled in them so the student side is reachable.
   * Teaching wins unless the caller explicitly asks for the student view.
   */
  static rolesFor(db: Database, userId: string, classId: string): ClassRole[] {
    const cls = db.classes.find((c) => c.id === classId);
    if (!cls) return [];
    const roles: ClassRole[] = [];
    if (cls.teacherId === userId) roles.push("teacher");
    if (db.enrollments.some((e) => e.classId === classId && e.studentId === userId)) {
      roles.push("student");
    }
    return roles;
  }

  static accessFor(
    db: Database,
    userId: string,
    classId: string,
    preferred?: ClassRole
  ): ClassRole | null {
    const roles = LocalStore.rolesFor(db, userId, classId);
    if (roles.length === 0) return null;
    if (preferred && roles.includes(preferred)) return preferred;
    return roles[0];
  }

  // ── classes ──────────────────────────────────────────────────────────────

  private classesFor(db: Database, userId: string): DbClass[] {
    const taught = db.classes.filter((c) => c.teacherId === userId);
    const enrolledIds = new Set(
      db.enrollments.filter((e) => e.studentId === userId).map((e) => e.classId)
    );
    const enrolled = db.classes.filter((c) => enrolledIds.has(c.id));
    const seen = new Set<string>();
    return [...taught, ...enrolled].filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }

  /** One row per (class, role) — a class you both teach and sit in appears twice. */
  async listClassSummaries(userId: string): Promise<ClassSummary[]> {
    const db = this.read();
    return this.classesFor(db, userId).flatMap((cls) => {
      const base = {
        id: cls.id,
        name: cls.name,
        code: cls.code,
        studentCount: db.enrollments.filter(
          (e) => e.classId === cls.id && e.studentId !== cls.teacherId
        ).length,
        subunitCount: getAllSubunits(cls).length,
        color: cls.color,
        icon: cls.icon,
      };
      return LocalStore.rolesFor(db, userId, cls.id).map((role) => ({ ...base, role }));
    });
  }

  private studentsOf(db: Database, classId: string): DbUser[] {
    const cls = db.classes.find((c) => c.id === classId);
    const ids = db.enrollments
      .filter((e) => e.classId === classId && e.studentId !== cls?.teacherId)
      .map((e) => e.studentId);
    return db.users.filter((u) => ids.includes(u.id));
  }

  async getClassDetail(
    classId: string,
    userId: string,
    preferredRole?: ClassRole
  ): Promise<ClassDetail | null> {
    const db = this.read();
    const access = LocalStore.accessFor(db, userId, classId, preferredRole);
    if (!access) return null;
    const cls = db.classes.find((c) => c.id === classId);
    if (!cls) return null;

    const students = this.studentsOf(db, classId);
    const invites = access === "teacher" ? db.invites.filter((i) => i.classId === classId) : [];

    // A teacher enrolled in their own class (the demo account) has a progress
    // row but no roster seat. The teacher grid iterates progress rows against
    // the roster, so that row has to be dropped here or it dereferences undefined.
    const rosterIds = new Set(students.map((s) => s.id));
    const all = db.progress.filter((p) => p.classId === classId);
    const progress =
      access === "teacher" ? all.filter((p) => rosterIds.has(p.studentId)) : all;
    const teacher = db.users.find((u) => u.id === cls.teacherId);

    return {
      class: cls,
      role: access,
      students: toRoster(students),
      invites,
      progress,
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : "",
    };
  }

  private mintCode(db: Database): string {
    const taken = new Set(db.classes.map((c) => c.code));
    for (let i = 0; i < 10000; i++) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      if (!taken.has(code)) return code;
    }
    return String(Date.now()).slice(-6);
  }

  async createClassForTeacher(teacherId: string, templateId?: string): Promise<DbClass> {
    return this.mutate((db) => {
      const cls = createDefaultClass(teacherId, templateId);
      cls.code = this.mintCode(db);
      db.classes.push(cls);
      return cls;
    });
  }

  /** Insert a class that already has its id and code (the synced store's path). */
  insertClass(cls: DbClass): void {
    this.mutate((db) => {
      if (!db.classes.some((c) => c.id === cls.id)) db.classes.push(cls);
    });
  }

  /**
   * Copy a class's curriculum into a fresh class. Students, progress and the
   * progress gate are deliberately left behind — this is for running the same
   * course with another period, not for cloning a class in flight.
   */
  async duplicateClass(classId: string, teacherId: string): Promise<DbClass | null> {
    return this.mutate((db) => {
      const source = db.classes.find((c) => c.id === classId);
      if (!source || source.teacherId !== teacherId) return null;
      const copy: DbClass = {
        id: uuidv4(),
        name: `${source.name} (copy)`,
        code: this.mintCode(db),
        teacherId,
        units: structuredClone(source.units),
        blockSectionId: null,
        color: source.color,
        icon: source.icon,
        createdAt: new Date().toISOString(),
      };
      db.classes.push(copy);
      return copy;
    });
  }

  /**
   * Delete a class and everything hanging off it — roster, invites and every
   * student's work. Only its own teacher can, and there is no undo, so the
   * caller is expected to have asked twice.
   */
  async deleteClass(classId: string, teacherId: string): Promise<boolean> {
    return this.mutate((db) => {
      const cls = db.classes.find((c) => c.id === classId);
      if (!cls || cls.teacherId !== teacherId) return false;
      db.classes = db.classes.filter((c) => c.id !== classId);
      db.enrollments = db.enrollments.filter((e) => e.classId !== classId);
      db.invites = db.invites.filter((i) => i.classId !== classId);
      db.progress = db.progress.filter((p) => p.classId !== classId);
      return true;
    });
  }

  async updateClass(classId: string, patch: ClassPatch): Promise<DbClass | null> {
    return this.mutate((db) => {
      const cls = db.classes.find((c) => c.id === classId);
      if (!cls) return null;
      Object.assign(cls, patch);
      return cls;
    });
  }

  async applyCurriculum(
    classId: string,
    units: CurriculumUnit[],
    remaps: SectionRemap[]
  ): Promise<DbClass | null> {
    return this.mutate((db) => {
      const cls = db.classes.find((c) => c.id === classId);
      if (!cls) return null;
      remapSections(db, classId, remaps);
      cls.units = units;
      cls.version = (cls.version ?? 1) + 1;
      return cls;
    });
  }

  /** The demo has no account. Nothing here outlives closing the tab. */
  async deleteAccount(): Promise<void> {
    throw new Error("The demo has no account to delete");
  }

  // ── roster ───────────────────────────────────────────────────────────────

  /**
   * Take someone off a class roster — the same operation whether a teacher
   * removes a student or a student leaves of their own accord. Their progress
   * is deliberately left behind: invisible while they are off the roster, and
   * back the moment they rejoin with the code.
   */
  async unenrollStudent(classId: string, studentId: string): Promise<boolean> {
    return this.mutate((db) => {
      const before = db.enrollments.length;
      db.enrollments = db.enrollments.filter(
        (e) => !(e.classId === classId && e.studentId === studentId)
      );
      return db.enrollments.length < before;
    });
  }

  enroll(classId: string, studentId: string): void {
    this.mutate((db) => {
      if (!db.enrollments.some((e) => e.classId === classId && e.studentId === studentId)) {
        db.enrollments.push({ classId, studentId, joinedAt: new Date().toISOString() });
      }
      const student = db.users.find((u) => u.id === studentId);
      if (student) {
        db.invites = db.invites.filter(
          (i) =>
            !(
              i.classId === classId &&
              (i.emailOrUsername.toLowerCase() === student.email.toLowerCase() ||
                i.emailOrUsername.toLowerCase() === student.username.toLowerCase())
            )
        );
      }
    });
  }

  async joinClassWithCode(
    userId: string,
    code: string
  ): Promise<{ id: string; name: string; code: string }> {
    const trimmed = code.trim();
    if (!trimmed) throw new Error("Class code required");
    const db = this.read();
    if (!db.users.some((u) => u.id === userId)) throw new Error("Unauthorized");
    const target = db.classes.find((c) => c.code === trimmed);
    if (!target) throw new Error("Invalid class code");
    if (target.teacherId === userId) throw new Error("You already teach this class");
    this.enroll(target.id, userId);
    return { id: target.id, name: target.name, code: target.code };
  }

  async inviteToClass(
    classId: string,
    teacherId: string,
    handle: string
  ): Promise<{ students: RosterStudent[]; invites: DbInvite[] }> {
    const db = this.read();
    if (LocalStore.accessFor(db, teacherId, classId) !== "teacher") {
      throw new Error("Forbidden");
    }
    const trimmed = handle.trim();
    if (!trimmed) throw new Error("Email or username required");

    const key = trimmed.toLowerCase();
    const existing = db.users.find(
      (u) => u.email.toLowerCase() === key || u.username.toLowerCase() === key
    );
    if (existing) {
      if (existing.id === teacherId) {
        throw new Error("The class teacher cannot be added as a student");
      }
      this.enroll(classId, existing.id);
    } else {
      this.mutate((d) => {
        d.invites.push({
          id: uuidv4(),
          classId,
          emailOrUsername: trimmed,
          invitedAt: new Date().toISOString(),
        });
      });
    }

    const after = this.read();
    return {
      students: toRoster(this.studentsOf(after, classId)),
      invites: after.invites.filter((i) => i.classId === classId),
    };
  }

  // ── progress ─────────────────────────────────────────────────────────────

  async saveStudentProgress(progress: DbStudentProgress): Promise<void> {
    this.mutate((db) => {
      const idx = db.progress.findIndex(
        (p) => p.classId === progress.classId && p.studentId === progress.studentId
      );
      if (idx >= 0) db.progress[idx] = progress;
      else db.progress.push(progress);
    });
  }

  /**
   * Replaces the rows it is given and leaves the rest of the class alone. It
   * used to drop every row for the class first, which quietly deleted the
   * progress of anyone missing from the caller's list.
   */
  async saveAllClassProgress(classId: string, all: DbStudentProgress[]): Promise<void> {
    this.mutate((db) => {
      const incoming = new Set(all.map((p) => p.studentId));
      db.progress = db.progress.filter(
        (p) => p.classId !== classId || !incoming.has(p.studentId)
      );
      db.progress.push(...all);
    });
  }
}
