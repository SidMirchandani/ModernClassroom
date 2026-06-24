import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type {
  Database,
  DbClass,
  DbEnrollment,
  DbInvite,
  DbStudentProgress,
  DbUser,
  CurriculumUnit,
} from "./types";
import type { Section } from "../types";
import { emptySection } from "../curriculum";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

const EMPTY_DB: Database = {
  users: [],
  classes: [],
  enrollments: [],
  invites: [],
  progress: [],
};

let writeQueue: Promise<void> = Promise.resolve();

async function readDb(): Promise<Database> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(raw) as Database;
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(EMPTY_DB, null, 2));
    return structuredClone(EMPTY_DB);
  }
}

function withWrite<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const db = await readDb();
    const result = await fn(db);
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
    return result;
  };
  const chained = writeQueue.then(run, run);
  writeQueue = chained.then(
    () => undefined,
    () => undefined
  );
  return chained;
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
    lastName.replace(/[^a-zA-Z]/g, "") +
    firstName.charAt(0).toUpperCase();
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

export async function getDb(): Promise<Database> {
  return readDb();
}

export async function findUserByEmailOrUsername(
  identifier: string
): Promise<DbUser | null> {
  const db = await readDb();
  const key = identifier.toLowerCase();
  return (
    db.users.find(
      (u) =>
        u.email.toLowerCase() === key || u.username.toLowerCase() === key
    ) ?? null
  );
}

export async function findUserById(id: string): Promise<DbUser | null> {
  const db = await readDb();
  return db.users.find((u) => u.id === id) ?? null;
}

export async function createUser(
  data: Omit<DbUser, "id" | "createdAt">
): Promise<DbUser> {
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

export async function createClassForTeacher(teacherId: string): Promise<DbClass> {
  return withWrite((db) => {
    const cls = createDefaultClass(teacherId);
    cls.code = generateClassCode(db);
    db.classes.push(cls);
    return cls;
  });
}

export async function getClassById(classId: string): Promise<DbClass | null> {
  const db = await readDb();
  return db.classes.find((c) => c.id === classId) ?? null;
}

export async function updateClass(
  classId: string,
  patch: Partial<Pick<DbClass, "name" | "units" | "blockSectionId">>
): Promise<DbClass | null> {
  return withWrite((db) => {
    const cls = db.classes.find((c) => c.id === classId);
    if (!cls) return null;
    Object.assign(cls, patch);
    return cls;
  });
}

export async function getClassesForUser(userId: string): Promise<DbClass[]> {
  const db = await readDb();
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

export async function getEnrollmentsForClass(
  classId: string
): Promise<DbEnrollment[]> {
  const db = await readDb();
  return db.enrollments.filter((e) => e.classId === classId);
}

export async function getStudentsForClass(classId: string): Promise<DbUser[]> {
  const db = await readDb();
  const studentIds = db.enrollments
    .filter((e) => e.classId === classId)
    .map((e) => e.studentId);
  return db.users.filter((u) => studentIds.includes(u.id));
}

export async function getInvitesForClass(classId: string): Promise<DbInvite[]> {
  const db = await readDb();
  return db.invites.filter((i) => i.classId === classId);
}

export async function addInvite(
  classId: string,
  emailOrUsername: string
): Promise<DbInvite> {
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

export async function enrollStudent(
  classId: string,
  studentId: string
): Promise<boolean> {
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

export async function joinClassByCode(
  studentId: string,
  code: string
): Promise<DbClass | null> {
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

export async function acceptPendingInvites(studentId: string): Promise<void> {
  return withWrite((db) => {
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

export async function getClassProgress(
  classId: string
): Promise<DbStudentProgress[]> {
  const db = await readDb();
  return db.progress.filter((p) => p.classId === classId);
}

export async function getStudentProgress(
  classId: string,
  studentId: string
): Promise<DbStudentProgress> {
  const db = await readDb();
  return (
    db.progress.find(
      (p) => p.classId === classId && p.studentId === studentId
    ) ?? { classId, studentId, sections: {} }
  );
}

export async function saveStudentProgress(
  progress: DbStudentProgress
): Promise<DbStudentProgress> {
  return withWrite((db) => {
    const idx = db.progress.findIndex(
      (p) => p.classId === progress.classId && p.studentId === progress.studentId
    );
    if (idx >= 0) db.progress[idx] = progress;
    else db.progress.push(progress);
    return progress;
  });
}

export async function saveAllClassProgress(
  classId: string,
  all: DbStudentProgress[]
): Promise<void> {
  return withWrite((db) => {
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
