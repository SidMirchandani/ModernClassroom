"use client";

import type {
  ClassSummary,
  CurriculumUnit,
  DbClass,
  DbEnrollment,
  DbInvite,
  DbStudentProgress,
  DbUser,
} from "../db/types";
import type { TrackProgress, CheckpointGrade } from "../types";
import type { AccentId } from "../class-appearance";
import { supabase } from "../supabase/client";
import type { ClassPatch, SectionRemap } from "./types";

/**
 * Everything that actually talks to Supabase. Rows come back in the shapes
 * the rest of the app has always used, so nothing above this file knows a
 * column name.
 */

// ── row shapes ────────────────────────────────────────────────────────────

interface ClassRow {
  id: string;
  name: string;
  code: string;
  teacher_id: string;
  units: CurriculumUnit[];
  block_section_id: string | null;
  color: string | null;
  icon: string | null;
  import_instructions: string | null;
  version: number;
  created_at: string;
}

interface ProfileRow {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  accent: string | null;
}

interface ProgressRow {
  student_id: string;
  section_id: string;
  track_id: string;
  state: TrackProgress;
}

interface GradeRow {
  student_id: string;
  checkpoint_id: string;
  score: number;
  out_of: number;
}

const PROFILE_COLUMNS = "id, username, first_name, last_name, accent";

function toClass(row: ClassRow): DbClass {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    teacherId: row.teacher_id,
    units: row.units ?? [],
    blockSectionId: row.block_section_id,
    color: (row.color as DbClass["color"]) ?? undefined,
    icon: (row.icon as DbClass["icon"]) ?? undefined,
    importInstructions: row.import_instructions ?? undefined,
    version: row.version,
    createdAt: row.created_at,
  };
}

/** Other people's emails are never sent to the browser; only your own is known. */
export function toUser(row: ProfileRow, email = ""): DbUser {
  return {
    id: row.id,
    email,
    username: row.username,
    passwordHash: "",
    role: "member",
    firstName: row.first_name,
    lastName: row.last_name,
    accent: (row.accent as AccentId) ?? undefined,
    createdAt: "",
  };
}

/** Per-track rows back into the one-row-per-student shape the grid reads. */
export function groupProgress(
  classId: string,
  rows: ProgressRow[],
  grades: GradeRow[]
): DbStudentProgress[] {
  const byStudent = new Map<string, DbStudentProgress>();
  const rowFor = (studentId: string) => {
    let p = byStudent.get(studentId);
    if (!p) {
      p = { classId, studentId, sections: {} };
      byStudent.set(studentId, p);
    }
    return p;
  };

  for (const r of rows) {
    const p = rowFor(r.student_id);
    const section = (p.sections[r.section_id] ??= { tracks: {} });
    section.tracks[r.track_id] = r.state;
  }
  for (const g of grades) {
    const p = rowFor(g.student_id);
    (p.checkpoints ??= {})[g.checkpoint_id] = { score: g.score, outOf: g.out_of };
  }
  return [...byStudent.values()];
}

function fail(error: { message: string } | null, what: string): never {
  throw new Error(error?.message ? `${what}: ${error.message}` : what);
}

// ── reads ─────────────────────────────────────────────────────────────────

export interface SummaryPull {
  summaries: ClassSummary[];
  classes: DbClass[];
  enrollments: DbEnrollment[];
}

export async function pullSummaries(): Promise<SummaryPull> {
  const sb = supabase();
  const [rpc, classes, enrollments] = await Promise.all([
    sb.rpc("class_summaries"),
    sb.from("classes").select("*"),
    sb.from("enrollments").select("class_id, student_id, joined_at"),
  ]);
  if (rpc.error) fail(rpc.error, "Could not load your classes");
  if (classes.error) fail(classes.error, "Could not load your classes");
  if (enrollments.error) fail(enrollments.error, "Could not load your classes");

  return {
    summaries: (rpc.data as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      code: r.code as string,
      role: r.role as ClassSummary["role"],
      studentCount: Number(r.student_count),
      subunitCount: Number(r.subunit_count),
      color: (r.color as ClassSummary["color"]) ?? undefined,
      icon: (r.icon as ClassSummary["icon"]) ?? undefined,
    })),
    classes: (classes.data as ClassRow[]).map(toClass),
    enrollments: (enrollments.data as Array<Record<string, string>>).map((e) => ({
      classId: e.class_id,
      studentId: e.student_id,
      joinedAt: e.joined_at,
    })),
  };
}

export interface ClassPull {
  class: DbClass;
  users: DbUser[];
  enrollments: DbEnrollment[];
  invites: DbInvite[];
  progress: DbStudentProgress[];
}

export async function pullClass(classId: string): Promise<ClassPull | null> {
  const sb = supabase();
  const cls = await sb.from("classes").select("*").eq("id", classId).maybeSingle();
  if (cls.error) fail(cls.error, "Could not load the class");
  if (!cls.data) return null;
  const row = toClass(cls.data as ClassRow);

  const [enrollments, invites, progress, grades] = await Promise.all([
    sb.from("enrollments").select("class_id, student_id, joined_at").eq("class_id", classId),
    sb.from("invites").select("id, class_id, handle, invited_at").eq("class_id", classId),
    sb.from("progress").select("student_id, section_id, track_id, state").eq("class_id", classId),
    sb
      .from("checkpoint_grades")
      .select("student_id, checkpoint_id, score, out_of")
      .eq("class_id", classId),
  ]);
  if (enrollments.error) fail(enrollments.error, "Could not load the roster");
  if (progress.error) fail(progress.error, "Could not load progress");
  if (grades.error) fail(grades.error, "Could not load grades");
  // Invites are teacher-only; a student's query simply comes back empty.

  const seats = (enrollments.data as Array<Record<string, string>>).map((e) => ({
    classId: e.class_id,
    studentId: e.student_id,
    joinedAt: e.joined_at,
  }));

  const peopleIds = [...new Set([row.teacherId, ...seats.map((s) => s.studentId)])];
  const profiles = await sb.from("profiles").select(PROFILE_COLUMNS).in("id", peopleIds);
  if (profiles.error) fail(profiles.error, "Could not load the roster");

  return {
    class: row,
    users: (profiles.data as ProfileRow[]).map((p) => toUser(p)),
    enrollments: seats,
    invites: ((invites.data ?? []) as Array<Record<string, string>>).map((i) => ({
      id: i.id,
      classId: i.class_id,
      emailOrUsername: i.handle,
      invitedAt: i.invited_at,
    })),
    progress: groupProgress(classId, progress.data as ProgressRow[], grades.data as GradeRow[]),
  };
}

export async function pullProfile(userId: string): Promise<DbUser | null> {
  const { data, error } = await supabase()
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error) fail(error, "Could not load your profile");
  return data ? toUser(data as ProfileRow) : null;
}

// ── writes ────────────────────────────────────────────────────────────────

export async function createClass(cls: DbClass): Promise<DbClass> {
  const { data, error } = await supabase().rpc("create_class", {
    p_id: cls.id,
    p_name: cls.name,
    p_units: cls.units,
    p_block_section_id: cls.blockSectionId,
    p_color: cls.color ?? null,
    p_icon: cls.icon ?? null,
  });
  if (error) fail(error, "Could not create the class");
  return toClass(data as ClassRow);
}

export async function updateClass(classId: string, patch: ClassPatch): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.icon !== undefined) row.icon = patch.icon;
  if (patch.blockSectionId !== undefined) row.block_section_id = patch.blockSectionId;
  if (patch.importInstructions !== undefined) row.import_instructions = patch.importInstructions;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase().from("classes").update(row).eq("id", classId);
  if (error) fail(error, "Could not save the class");
}

/** Returns the new version. Throws `stale` if `expectedVersion` no longer holds. */
export async function applyCurriculum(
  classId: string,
  units: CurriculumUnit[],
  remaps: SectionRemap[],
  expectedVersion: number | null
): Promise<number> {
  const { data, error } = await supabase().rpc("apply_curriculum", {
    p_class_id: classId,
    p_expected_version: expectedVersion,
    p_units: units,
    p_remaps: remaps,
  });
  if (error) {
    if (error.code === "P0002" || /stale/.test(error.message)) throw new Error("stale");
    fail(error, "Could not save the curriculum");
  }
  return data as number;
}

export async function deleteClass(classId: string): Promise<void> {
  const { error } = await supabase().from("classes").delete().eq("id", classId);
  if (error) fail(error, "Could not delete the class");
}

export async function unenroll(classId: string, studentId: string): Promise<void> {
  const { error } = await supabase()
    .from("enrollments")
    .delete()
    .match({ class_id: classId, student_id: studentId });
  if (error) fail(error, "Could not update the roster");
}

export async function joinClass(code: string): Promise<string> {
  const { data, error } = await supabase().rpc("join_class", { p_code: code });
  if (error) fail(error, error.message.includes("No class") ? "Invalid class code" : "Could not join");
  return data as string;
}

export async function invite(classId: string, handle: string): Promise<"enrolled" | "invited"> {
  const { data, error } = await supabase().rpc("invite_to_class", {
    p_class_id: classId,
    p_handle: handle,
  });
  if (error) fail(error, "Could not invite");
  return data as "enrolled" | "invited";
}

export async function acceptInvites(): Promise<void> {
  await supabase().rpc("accept_invites");
}

export interface TrackWrite {
  studentId: string;
  sectionId: string;
  trackId: string;
  state: TrackProgress;
}

export async function upsertTracks(classId: string, rows: TrackWrite[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase().rpc("upsert_track_progress", {
    p_class_id: classId,
    p_rows: rows.map((r) => ({
      student_id: r.studentId,
      section_id: r.sectionId,
      track_id: r.trackId,
      state: r.state,
    })),
  });
  if (error) fail(error, "Could not save progress");
}

export async function setGrade(
  classId: string,
  studentId: string,
  checkpointId: string,
  grade: CheckpointGrade | null
): Promise<void> {
  const { error } = await supabase().rpc("set_checkpoint_grade", {
    p_class_id: classId,
    p_student_id: studentId,
    p_checkpoint_id: checkpointId,
    p_score: grade?.score ?? null,
    p_out_of: grade?.outOf ?? null,
  });
  if (error) fail(error, "Could not save the grade");
}

export async function setAccent(userId: string, accent: AccentId): Promise<void> {
  const { error } = await supabase().from("profiles").update({ accent }).eq("id", userId);
  if (error) fail(error, "Could not save your colour");
}
