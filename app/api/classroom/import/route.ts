import { NextResponse } from "next/server";
import { ClassroomError, listTopics, listWork } from "@/lib/classroom/api";
import { classroomCurriculum } from "@/lib/classroom/curriculum";
import { adoptionLinks } from "@/lib/classroom/plan";
import { bad, teacherClass, teacherToken } from "@/lib/classroom/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * A new class's curriculum, built from everything in its Google Classroom class.
 * The links that stop the sync posting it all back are written here, before the
 * page saves the curriculum: the other order could post a copy to students. Safe
 * to repeat, since the same class gives the same ids.
 *
 * Body: {classId, timeZone}. A connection Google no longer honours gets
 * `needsReconnect`, so the teacher is asked to connect again.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const found = await teacherClass(body.classId);
  if (found instanceof NextResponse) return found;
  const { db, user, cls } = found;

  if (!cls.classroom_course_id) return bad("Choose a Google Classroom class first", 400);
  const token = await teacherToken(user.id);
  if (!token) return NextResponse.json({ needsReconnect: true }, { status: 403 });

  const timeZone = typeof body.timeZone === "string" && body.timeZone ? body.timeZone : "UTC";
  try {
    const [work, topics, existing] = await Promise.all([
      listWork(token, cls.classroom_course_id),
      listTopics(token, cls.classroom_course_id),
      db.from("classroom_links").select("item_key").eq("class_id", cls.id),
    ]);
    if (existing.error) throw new Error(existing.error.message);

    const built = classroomCurriculum(work, topics, timeZone);
    const links = adoptionLinks(
      built.units,
      new Set((existing.data ?? []).map((l) => l.item_key as string)),
      new Date()
    );
    if (links.length) {
      const { error } = await db.from("classroom_links").upsert(
        links.map((l) => ({
          class_id: cls.id,
          course_id: cls.classroom_course_id,
          item_key: l.itemKey,
          kind: l.kind,
          classroom_id: l.classroomId,
          state: l.state,
          scheduled_for: l.scheduledFor,
          sent: l.sent,
          classroom: l.classroom,
        })),
        { onConflict: "class_id,item_key" }
      );
      if (error) throw new Error(error.message);
    }
    return NextResponse.json(built);
  } catch (err) {
    if (err instanceof ClassroomError && err.status === 403) {
      return NextResponse.json({ needsReconnect: true }, { status: 403 });
    }
    console.error("[classroom] import failed:", err instanceof Error ? err.message : err);
    return bad("Could not reach Google Classroom", 502);
  }
}
