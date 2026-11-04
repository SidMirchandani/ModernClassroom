import { NextResponse } from "next/server";
import {
  ClassroomError,
  listColumnSubmissions,
  releaseGrade,
  setDraftGrade,
  setPoints,
  wireDue,
} from "@/lib/classroom/api";
import { isUnreturned, parseMark, parsePoints } from "@/lib/classroom/grades";
import { bad, teacherClass, teacherToken } from "@/lib/classroom/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Marks and totals, written to Google Classroom (ADR-011). There is no grade
 * table of ours: the cached row is only updated so the grid agrees straight away.
 *
 * Body: {classId, itemKey, action} and then
 *   "mark"    {userId, mark}    a draft grade, only the teacher sees it
 *   "points"  {points}          the column's total
 *   "return"                    every unreturned mark in the column, to students
 *
 * Only assignments this app made: Classroom refuses the rest.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const found = await teacherClass(body.classId);
  if (found instanceof NextResponse) return found;
  const { db, user, cls } = found;

  const courseId = cls.classroom_course_id;
  if (!courseId) return bad("Choose a Google Classroom class first", 400);
  if (typeof body.itemKey !== "string") return bad("Which assignment?", 400);

  const { data: link } = await db
    .from("classroom_links")
    .select("classroom_id, kind, classroom")
    .eq("class_id", cls.id)
    .eq("item_key", body.itemKey)
    .maybeSingle();
  if (!link || link.kind !== "assignment") return bad("That can't be graded here", 400);

  const token = await teacherToken(user.id);
  if (!token) return NextResponse.json({ needsReconnect: true }, { status: 403 });

  try {
    if (body.action === "points") {
      const points = parsePoints(String(body.points ?? ""));
      if (points === null) return bad("A total has to be a whole number above zero", 400);
      const updated = await setPoints(token, courseId, link.classroom_id, points);
      const { error } = await db
        .from("classroom_links")
        .update({ classroom: { ...(link.classroom ?? {}), title: updated.title, due: wireDue(updated), maxPoints: updated.maxPoints } })
        .eq("class_id", cls.id)
        .eq("item_key", body.itemKey);
      if (error) throw new Error(error.message);
      return NextResponse.json({ points: updated.maxPoints });
    }

    const column = await listColumnSubmissions(token, courseId, link.classroom_id);

    if (body.action === "mark") {
      const parsed = parseMark(String(body.mark ?? ""));
      if (!parsed.ok) return bad("A mark has to be a number, zero or more", 400);
      const submission = column.find((s) => s.userId === body.userId);
      if (!submission) return bad("That student has nothing to mark on this assignment yet", 400);
      await setDraftGrade(token, courseId, link.classroom_id, submission.id, parsed.mark);
      const { error } = await db
        .from("classroom_submissions")
        .update({ draft_grade: parsed.mark })
        .eq("class_id", cls.id)
        .eq("item_key", body.itemKey)
        .eq("user_id", submission.userId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ mark: parsed.mark });
    }

    if (body.action === "return") {
      let returned = 0;
      let failed = 0;
      for (const s of column) {
        const cached = {
          userId: s.userId,
          itemKey: body.itemKey as string,
          state: s.state as "NEW",
          late: s.late,
          assignedGrade: s.assignedGrade,
          draftGrade: s.draftGrade,
        };
        if (!isUnreturned(cached)) continue;
        try {
          await releaseGrade(token, courseId, link.classroom_id, s.id, s.draftGrade!);
          await db
            .from("classroom_submissions")
            .update({ state: "RETURNED", assigned_grade: s.draftGrade, draft_grade: s.draftGrade })
            .eq("class_id", cls.id)
            .eq("item_key", body.itemKey)
            .eq("user_id", s.userId);
          returned++;
        } catch (err) {
          failed++;
          console.error("[classroom] return failed:", err instanceof Error ? err.message : err);
        }
      }
      return NextResponse.json({ returned, failed });
    }

    return bad("Unknown action", 400);
  } catch (err) {
    if (err instanceof ClassroomError && err.status === 403) {
      // Reconnecting can't help with an assignment Classroom won't let us change.
      return bad("Google Classroom wouldn't allow that. Try again from Google Classroom.", 403);
    }
    console.error("[classroom] grades failed:", err instanceof Error ? err.message : err);
    return bad("Could not reach Google Classroom", 502);
  }
}
