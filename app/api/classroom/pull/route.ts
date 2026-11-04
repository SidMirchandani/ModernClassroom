import { NextResponse } from "next/server";
import { ClassroomError, listStudents, listSubmissions, listWork } from "@/lib/classroom/api";
import { diffRows } from "@/lib/classroom/grid";
import { bad, teacherClass, teacherToken } from "@/lib/classroom/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Bring the class's roster and turn-ins over from Google Classroom into the
 * cache the grid reads, along with assignments the teacher posted there by hand.
 * Called when the grid opens and from its Refresh button (ADR-008); only what
 * changed is written. Edits to what this app posted are the sync's to find.
 *
 * Body: {classId}. A connection made before the app asked for the roster gets
 * `needsReconnect`, so the teacher is asked once rather than shown an error.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const found = await teacherClass(body.classId);
  if (found instanceof NextResponse) return found;
  const { db, user, cls } = found;

  if (!cls.classroom_course_id) return bad("Choose a Google Classroom class first", 400);
  const token = await teacherToken(user.id);
  if (!token) return NextResponse.json({ needsReconnect: true }, { status: 403 });

  try {
    const [students, submissions, work_, links, oldRoster, oldSubmissions] = await Promise.all([
      listStudents(token, cls.classroom_course_id),
      listSubmissions(token, cls.classroom_course_id),
      listWork(token, cls.classroom_course_id),
      db.from("classroom_links").select("item_key, classroom_id, kind, classroom").eq("class_id", cls.id),
      db.from("classroom_roster").select("user_id, name").eq("class_id", cls.id),
      db
        .from("classroom_submissions")
        .select("user_id, item_key, state, late, assigned_grade, draft_grade")
        .eq("class_id", cls.id),
    ]);
    if (links.error || oldRoster.error || oldSubmissions.error) throw new Error("Could not read the cache");

    const roster = diffRows(
      (oldRoster.data ?? []).map((r) => ({ user_id: r.user_id as string, name: r.name as string })),
      students.map((s) => ({ user_id: s.userId, name: s.name })),
      (r) => r.user_id
    );

    // Assignments the teacher posted by hand, once students can see them. A
    // link to one is only ever read: Classroom won't let this app change it.
    const byHand = diffRows(
      (links.data ?? [])
        .filter((l) => l.kind === "external")
        .map((l) => ({
          item_key: l.item_key as string,
          classroom_id: l.classroom_id as string,
          // Rebuilt in this order: Postgres hands JSON back with its keys reordered.
          classroom: {
            title: (l.classroom as { title: string }).title,
            due: (l.classroom as { due: string | null }).due,
          },
        })),
      work_
        .filter((w) => !w.own && w.kind === "assignment" && w.state === "PUBLISHED")
        .map((w) => ({
          item_key: `external:${w.id}`,
          classroom_id: w.id,
          classroom: { title: w.title, due: w.due ?? null },
        })),
      (r) => r.item_key
    );
    if (byHand.upsert.length) {
      const { error } = await db.from("classroom_links").upsert(
        byHand.upsert.map((r) => ({
          class_id: cls.id,
          course_id: cls.classroom_course_id,
          kind: "external",
          state: "PUBLISHED",
          ...r,
        })),
        { onConflict: "class_id,item_key" }
      );
      if (error) throw new Error(error.message);
    }
    if (byHand.remove.length) {
      const { error } = await db
        .from("classroom_links")
        .delete()
        .eq("class_id", cls.id)
        .in("item_key", byHand.remove.map((r) => r.item_key));
      if (error) throw new Error(error.message);
    }

    const itemKeys = new Map((links.data ?? []).map((l) => [l.classroom_id as string, l.item_key as string]));
    for (const r of byHand.upsert) itemKeys.set(r.classroom_id, r.item_key);
    for (const r of byHand.remove) itemKeys.delete(r.classroom_id);
    const work = diffRows(
      (oldSubmissions.data ?? []).map((r) => ({
        user_id: r.user_id as string,
        item_key: r.item_key as string,
        state: r.state as string,
        late: r.late as boolean,
        assigned_grade: r.assigned_grade as number | null,
        draft_grade: r.draft_grade as number | null,
      })),
      submissions.flatMap((s) => {
        const item_key = itemKeys.get(s.courseWorkId);
        return item_key
          ? [
              {
                user_id: s.userId,
                item_key,
                state: s.state,
                late: s.late,
                assigned_grade: s.assignedGrade,
                draft_grade: s.draftGrade,
              },
            ]
          : [];
      }),
      (r) => `${r.user_id} ${r.item_key}`
    );

    if (roster.upsert.length) {
      const { error } = await db
        .from("classroom_roster")
        .upsert(roster.upsert.map((r) => ({ class_id: cls.id, ...r })));
      if (error) throw new Error(error.message);
    }
    if (roster.remove.length) {
      const { error } = await db
        .from("classroom_roster")
        .delete()
        .eq("class_id", cls.id)
        .in("user_id", roster.remove.map((r) => r.user_id));
      if (error) throw new Error(error.message);
    }
    if (work.upsert.length) {
      const { error } = await db
        .from("classroom_submissions")
        .upsert(work.upsert.map((r) => ({ class_id: cls.id, ...r })));
      if (error) throw new Error(error.message);
    }
    for (const r of work.remove) {
      const { error } = await db
        .from("classroom_submissions")
        .delete()
        .eq("class_id", cls.id)
        .eq("user_id", r.user_id)
        .eq("item_key", r.item_key);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ students: students.length, changed: roster.upsert.length + work.upsert.length });
  } catch (err) {
    if (err instanceof ClassroomError && err.status === 403) {
      return NextResponse.json({ needsReconnect: true }, { status: 403 });
    }
    console.error("[classroom] pull failed:", err instanceof Error ? err.message : err);
    return bad("Could not reach Google Classroom", 502);
  }
}
