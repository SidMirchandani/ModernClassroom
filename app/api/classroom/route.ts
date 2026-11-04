import { NextResponse } from "next/server";
import { listTeacherCourses } from "@/lib/classroom/api";
import { POSTING_RULES, type PostingRule } from "@/lib/classroom/plan";
import { bad, loadConnection, teacherClass, teacherToken } from "@/lib/classroom/server";

export const runtime = "nodejs";

/**
 * GET  ?classId=…  where this class stands with Google Classroom: connected or
 *                  not, the teacher's Classroom courses to choose from, the
 *                  chosen course and rule, and how much is already posted.
 * POST {classId, courseId?, postingRule?}  save those choices.
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
    courses,
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

  const patch: { classroom_course_id?: string; posting_rule?: PostingRule } = {};
  if (typeof body.courseId === "string" && body.courseId) {
    // A class posts into one course for good: its links point there.
    if (cls.classroom_course_id && cls.classroom_course_id !== body.courseId) {
      return bad("This class is already posting to another Google Classroom class", 409);
    }
    patch.classroom_course_id = body.courseId;
  }
  if (POSTING_RULES.includes(body.postingRule)) patch.posting_rule = body.postingRule;

  const { error } = await db.from("classes").update(patch).eq("id", cls.id);
  if (error) return bad("Could not save", 500);
  return NextResponse.json({ ok: true });
}
