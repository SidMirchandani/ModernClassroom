import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/server";
import { listTeacherCourses } from "@/lib/classroom/api";
import { bad, coursesTaken, loadConnection, teacherToken } from "@/lib/classroom/server";

export const runtime = "nodejs";

/**
 * The signed-in teacher's Google connection, before any class exists: is
 * Google connected, and which Classroom classes could a new class use. Each
 * course says whether a class already posts into it — a course takes one class,
 * because its links point there.
 */
export async function GET() {
  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return bad("Sign in first", 401);

  const connection = await loadConnection(user.id);
  const token = connection ? await teacherToken(user.id) : null;
  if (!connection || !token) return NextResponse.json({ connected: false });

  const [courses, linked] = await Promise.all([
    listTeacherCourses(token),
    db.from("classes").select("id, classroom_course_id, classroom_color").eq("teacher_id", user.id).not("classroom_course_id", "is", null),
  ]);
  const taken = await coursesTaken(courses.map((c) => c.id));

  // For the dashboard: which Classroom class each of theirs is, and how many
  // students it had when last looked at. A roster that hasn't loaded has none.
  const classIds = (linked.data ?? []).map((r) => r.id as string);
  const { data: roster } = classIds.length
    ? await db.from("classroom_roster").select("class_id").in("class_id", classIds)
    : { data: [] };
  const counts = new Map<string, number>();
  for (const row of roster ?? []) counts.set(row.class_id, (counts.get(row.class_id) ?? 0) + 1);

  return NextResponse.json({
    connected: true,
    email: connection.email,
    courses: courses.map((c) => ({ ...c, linked: taken.has(c.id) })),
    classLinks: (linked.data ?? []).map((r) => ({
      classId: r.id,
      courseId: r.classroom_course_id,
      color: r.classroom_color,
      students: counts.get(r.id as string) ?? 0,
    })),
  });
}
