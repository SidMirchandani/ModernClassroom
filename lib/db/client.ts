import { v4 as uuidv4 } from "uuid";
import type {
  Database,
  DbClass,
  DbEnrollment,
  DbInvite,
  DbStudentProgress,
  DbUser,
  CurriculumUnit,
  ClassSummary,
} from "./types";
import type { Section } from "../types";
import { emptySection } from "../curriculum";
import { getUserInitials } from "../avatar";

export const DB_STORAGE_KEY = "modern-classroom-db";

const EMPTY_DB: Database = {
  users: [],
  classes: [],
  enrollments: [],
  invites: [],
  progress: [],
};

function readDb(): Database {
  if (typeof window === "undefined") return structuredClone(EMPTY_DB);
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_DB);
    return JSON.parse(raw) as Database;
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

function writeDb(db: Database): void {
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
}

function withWrite<T>(fn: (db: Database) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

export function getDb(): Database {
  return readDb();
}

export function generateClassCode(db: Database): string {
  const existing = new Set(db.classes.map((c) => c.code));
  for (let i = 0; i < 10000; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!existing.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}

export function generateUsername(
  db: Database,
  firstName: string,
  lastName: string
): string {
  const base =
    lastName.replace(/[^a-zA-Z]/g, "") + firstName.charAt(0).toUpperCase();
  if (!base) return `user${Date.now().toString(36)}`;

  const taken = new Set(db.users.map((u) => u.username.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;

  for (let n = 1; n <= 999; n++) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base}${uuidv4().slice(0, 4)}`;
}

export function createDefaultClass(teacherId: string): DbClass {
  const unitId = uuidv4();
  const subunitId = "1.1";
  return {
    id: uuidv4(),
    name: "New Class",
    code: "000000",
    teacherId,
    units: [
      {
        id: unitId,
        title: "Unit 1",
        subunits: [emptySection(subunitId, "Subunit 1.1")],
      },
    ],
    blockSectionId: null,
    createdAt: new Date().toISOString(),
  };
}

export function findUserByEmailOrUsername(identifier: string): DbUser | null {
  const db = readDb();
  const key = identifier.toLowerCase();
  return (
    db.users.find(
      (u) =>
        u.email.toLowerCase() === key || u.username.toLowerCase() === key
    ) ?? null
  );
}

export function findUserById(id: string): DbUser | null {
  const db = readDb();
  return db.users.find((u) => u.id === id) ?? null;
}

export function createUser(
  data: Omit<DbUser, "id" | "createdAt">
): DbUser {
  return withWrite((db) => {
    if (db.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error("Email already registered");
    }
    if (db.users.some((u) => u.username.toLowerCase() === data.username.toLowerCase())) {
      throw new Error("Username already taken");
    }
    const user: DbUser = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    return user;
  });
}

export function createClassForTeacher(teacherId: string): DbClass {
  return withWrite((db) => {
    const cls = createDefaultClass(teacherId);
    cls.code = generateClassCode(db);
    db.classes.push(cls);
    return cls;
  });
}

export function getClassById(classId: string): DbClass | null {
  const db = readDb();
  return db.classes.find((c) => c.id === classId) ?? null;
}

export function updateClass(
  classId: string,
  patch: Partial<Pick<DbClass, "name" | "units" | "blockSectionId">>
): DbClass | null {
  return withWrite((db) => {
    const cls = db.classes.find((c) => c.id === classId);
    if (!cls) return null;
    Object.assign(cls, patch);
    return cls;
  });
}

export function getClassesForUser(userId: string): DbClass[] {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return [];

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

export function getEnrollmentsForClass(classId: string): DbEnrollment[] {
  const db = readDb();
  return db.enrollments.filter((e) => e.classId === classId);
}

export function getStudentsForClass(classId: string): DbUser[] {
  const db = readDb();
  const studentIds = db.enrollments
    .filter((e) => e.classId === classId)
    .map((e) => e.studentId);
  return db.users.filter((u) => studentIds.includes(u.id));
}

export function getInvitesForClass(classId: string): DbInvite[] {
  const db = readDb();
  return db.invites.filter((i) => i.classId === classId);
}

export function addInvite(classId: string, emailOrUsername: string): DbInvite {
  return withWrite((db) => {
    const invite: DbInvite = {
      id: uuidv4(),
      classId,
      emailOrUsername: emailOrUsername.trim(),
      invitedAt: new Date().toISOString(),
    };
    db.invites.push(invite);
    return invite;
  });
}

export function enrollStudent(classId: string, studentId: string): boolean {
  return withWrite((db) => {
    const cls = db.classes.find((c) => c.id === classId);
    if (!cls) return false;
    const exists = db.enrollments.some(
      (e) => e.classId === classId && e.studentId === studentId
    );
    if (!exists) {
      db.enrollments.push({
        classId,
        studentId,
        joinedAt: new Date().toISOString(),
      });
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
    return true;
  });
}

export function joinClassByCode(studentId: string, code: string): DbClass | null {
  return withWrite((db) => {
    const cls = db.classes.find((c) => c.code === code.trim());
    if (!cls) return null;
    const exists = db.enrollments.some(
      (e) => e.classId === cls.id && e.studentId === studentId
    );
    if (!exists) {
      db.enrollments.push({
        classId: cls.id,
        studentId,
        joinedAt: new Date().toISOString(),
      });
    }
    const student = db.users.find((u) => u.id === studentId);
    if (student) {
      db.invites = db.invites.filter(
        (i) =>
          !(
            i.classId === cls.id &&
            (i.emailOrUsername.toLowerCase() === student.email.toLowerCase() ||
              i.emailOrUsername.toLowerCase() === student.username.toLowerCase())
          )
      );
    }
    return cls;
  });
}

export function acceptPendingInvites(studentId: string): void {
  withWrite((db) => {
    const student = db.users.find((u) => u.id === studentId);
    if (!student) return;

    const pending = db.invites.filter(
      (i) =>
        i.emailOrUsername.toLowerCase() === student.email.toLowerCase() ||
        i.emailOrUsername.toLowerCase() === student.username.toLowerCase()
    );

    for (const invite of pending) {
      const exists = db.enrollments.some(
        (e) => e.classId === invite.classId && e.studentId === studentId
      );
      if (!exists) {
        db.enrollments.push({
          classId: invite.classId,
          studentId,
          joinedAt: new Date().toISOString(),
        });
      }
    }

    db.invites = db.invites.filter((i) => !pending.includes(i));
  });
}

export function getClassProgress(classId: string): DbStudentProgress[] {
  const db = readDb();
  return db.progress.filter((p) => p.classId === classId);
}

export function saveStudentProgress(progress: DbStudentProgress): DbStudentProgress {
  return withWrite((db) => {
    const idx = db.progress.findIndex(
      (p) => p.classId === progress.classId && p.studentId === progress.studentId
    );
    if (idx >= 0) db.progress[idx] = progress;
    else db.progress.push(progress);
    return progress;
  });
}

export function saveAllClassProgress(
  classId: string,
  all: DbStudentProgress[]
): void {
  withWrite((db) => {
    db.progress = db.progress.filter((p) => p.classId !== classId);
    db.progress.push(...all);
  });
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

export function userCanAccessClass(
  db: Database,
  userId: string,
  classId: string
): "teacher" | "student" | null {
  const cls = db.classes.find((c) => c.id === classId);
  if (!cls) return null;
  if (cls.teacherId === userId) return "teacher";
  if (db.enrollments.some((e) => e.classId === classId && e.studentId === userId)) {
    return "student";
  }
  return null;
}

export function listClassSummaries(userId: string): ClassSummary[] {
  const classes = getClassesForUser(userId);
  return classes.map((cls) => {
    const enrollments = getEnrollmentsForClass(cls.id);
    const role = cls.teacherId === userId ? "teacher" : "student";
    return {
      id: cls.id,
      name: cls.name,
      code: cls.code,
      role,
      studentCount: enrollments.length,
      subunitCount: getAllSubunits(cls).length,
    };
  });
}

export interface ClassDetail {
  class: DbClass;
  role: "teacher" | "student";
  students: { id: string; name: string; username: string; avatar: string }[];
  invites: DbInvite[];
  progress: DbStudentProgress[];
  teacherName: string;
}

export function getClassDetail(classId: string, userId: string): ClassDetail | null {
  const db = readDb();
  const access = userCanAccessClass(db, userId, classId);
  if (!access) return null;

  const cls = getClassById(classId);
  if (!cls) return null;

  const students = getStudentsForClass(classId);
  const invites = access === "teacher" ? getInvitesForClass(classId) : [];
  const progress = getClassProgress(classId);
  const teacher = db.users.find((u) => u.id === cls.teacherId);

  return {
    class: cls,
    role: access,
    students: students.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      username: s.username,
      avatar: getUserInitials(s.firstName, s.lastName),
    })),
    invites,
    progress,
    teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : "",
  };
}

export function inviteToClass(
  classId: string,
  teacherId: string,
  emailOrUsername: string
): { students: ClassDetail["students"]; invites: DbInvite[] } {
  const db = readDb();
  const access = userCanAccessClass(db, teacherId, classId);
  if (access !== "teacher") throw new Error("Forbidden");

  const trimmed = emailOrUsername.trim();
  if (!trimmed) throw new Error("Email or username required");

  const cls = db.classes.find((c) => c.id === classId);
  const existingUser = findUserByEmailOrUsername(trimmed);
  if (existingUser) {
    if (existingUser.id === cls?.teacherId) {
      throw new Error("The class teacher cannot be added as a student");
    }
    enrollStudent(classId, existingUser.id);
  } else {
    addInvite(classId, trimmed);
  }

  const students = getStudentsForClass(classId);
  return {
    students: students.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      username: s.username,
      avatar: getUserInitials(s.firstName, s.lastName),
    })),
    invites: getInvitesForClass(classId),
  };
}

export function joinClassWithCode(
  userId: string,
  code: string
): { id: string; name: string; code: string } {
  const trimmed = code.trim();
  if (!trimmed) throw new Error("Class code required");

  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error("Unauthorized");

  const target = db.classes.find((c) => c.code === trimmed);
  if (!target) throw new Error("Invalid class code");
  if (target.teacherId === userId) {
    throw new Error("You already teach this class");
  }

  const cls = joinClassByCode(userId, trimmed);
  if (!cls) throw new Error("Invalid class code");

  return { id: cls.id, name: cls.name, code: cls.code };
}
