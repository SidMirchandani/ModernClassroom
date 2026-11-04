import { NextResponse } from "next/server";
import { listTeacherCourses } from "@/lib/classroom/api";
import { ACCENTS, type AccentId } from "@/lib/class-appearance";
import { POSTING_RULES, type PostingRule } from "@/lib/classroom/plan";
import { bad, coursesTaken, loadConnection, teacherClass, teacherToken } from "@/lib/classroom/server";

export const runtime = "nodejs";

/**
 * GET  ?classId=…  where this class stands with Google Classroom: connected or
 *                  not, the teacher's Classroom courses to choose from, the
 *                  chosen course and rule, and how much is already posted.
 * POST {classId, courseId?, postingRule?, classroomColor?}  save those choices.
 * POST {classId, unlink: true}              stop posting to its Classroom class.
 *
 * Unlinking leaves everything already posted in Classroom, students' work
 * included, and keeps the links: choosing the same class again carries on where
 * it stopped rather than posting it all twice. Choosing a different one clears
 * them, since they point at the old class. The cached roster and turn-ins go, as
 * they do on disconnecting (ADR-009).
 */

export async function GET(request: Request) {
  const classId = new URL(request.url).searchParams.get("classId");
  const found = await teacherClass(classId);
  if (found instanceof NextResponse) return found;
  const { db, user, cls } = found;

  const connection = await loadConnection(user.id);
  if (!connection) return NextResponse.json({ connected: false });

  const token = await teacherToken(user.id);
  if (!token) return NextResponse.json({ connected: false });

  const [courses, links] = await Promise.all([
    listTeacherCourses(token),
    db.from("classroom_links").select("state").eq("class_id", cls.id).neq("kind", "external"),
  ]);
  const taken = await coursesTaken(courses.map((c) => c.id), cls.id);
  const counts = { posted: 0, scheduled: 0, drafts: 0, kept: 0 };
  for (const row of links.data ?? []) {
    if (row.state === "PUBLISHED") counts.posted++;
    else if (row.state === "SCHEDULED") counts.scheduled++;
    else if (row.state === "DRAFT") counts.drafts++;
    else if (row.state === "KEPT") counts.kept++;
  }

  return NextResponse.json({
    connected: true,
    email: connection.email,
    courses: courses.map((c) => ({ ...c, linked: taken.has(c.id) })),
    courseId: cls.classroom_course_id,
    postingRule: cls.posting_rule,
    counts,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const found = await teacherClass(body.classId);
  if (found instanceof NextResponse) return found;
  const { db, cls } = found;

  if (body.unlink === true) {
    const { error } = await db.from("classes").update({ classroom_course_id: null }).eq("id", cls.id);
    if (error) return bad("Could not unlink", 500);
    await db.from("classroom_submissions").delete().eq("class_id", cls.id);
    await db.from("classroom_roster").delete().eq("class_id", cls.id);
    await db.from("classroom_links").delete().eq("class_id", cls.id).eq("kind", "external");
    return NextResponse.json({ ok: true });
  }

  const patch: { classroom_course_id?: string; posting_rule?: PostingRule; classroom_color?: AccentId } = {};
  if (typeof body.classroomColor === "string") {
    if (!Object.hasOwn(ACCENTS, body.classroomColor)) return bad("That isn't one of the colors", 400);
    patch.classroom_color = body.classroomColor as AccentId;
  }
  if (typeof body.courseId === "string" && body.courseId) {
    // Its links point there, so moving means unlinking first.
    if (cls.classroom_course_id && cls.classroom_course_id !== body.courseId) {
      return bad("This class is already posting to another Google Classroom class", 409);
    }
    if ((await coursesTaken([body.courseId], cls.id)).has(body.courseId)) {
      return bad("That Google Classroom class is already linked to another class", 409);
    }
    // Left from a class it was linked to before: they'd point at the wrong place.
    const { error: staleError } = await db
      .from("classroom_links")
      .delete()
      .eq("class_id", cls.id)
      .neq("course_id", body.courseId);
    if (staleError) return bad("Could not save", 500);
    patch.classroom_course_id = body.courseId;
  }
  if (POSTING_RULES.includes(body.postingRule)) patch.posting_rule = body.postingRule;

  const { error } = await db.from("classes").update(patch).eq("id", cls.id);
  if (error) return bad("Could not save", 500);
  return NextResponse.json({ ok: true });
}
