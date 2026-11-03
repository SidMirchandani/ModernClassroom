import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/server";
import { listTeacherCourses } from "@/lib/classroom/api";
import { bad, loadConnection, teacherToken } from "@/lib/classroom/server";

export const runtime = "nodejs";

/**
 * The signed-in teacher's Google connection, before any class exists: is
 * Google connected, and which Classroom classes could a new class use. Each
 * course says whether one of their classes already posts into it — a course
 * takes one class, because its links point there.
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
    db.from("classes").select("classroom_course_id").eq("teacher_id", user.id).not("classroom_course_id", "is", null),
  ]);
  const taken = new Set((linked.data ?? []).map((r) => r.classroom_course_id as string));

  return NextResponse.json({
    connected: true,
    email: connection.email,
    courses: courses.map((c) => ({ ...c, linked: taken.has(c.id) })),
  });
}
