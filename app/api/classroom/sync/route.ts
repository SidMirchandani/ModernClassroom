import { NextResponse } from "next/server";
import type { CurriculumUnit } from "@/lib/db/types";
import { runSync } from "@/lib/classroom/sync";
import { bad, ownsCourse, teacherClass, teacherToken } from "@/lib/classroom/server";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Stop starting new calls this close to `maxDuration`; the next run carries on. */
const DEADLINE_MS = (maxDuration - 20) * 1000;

/**
 * Post the class's curriculum to its Google Classroom course: create what is
 * missing, and move drafts forward when the gate or the rule says so. Safe to
 * call again at any time — it only does what is still to do, and a long first
 * run that runs out of time reports `remaining` for the caller to continue.
 *
 * Body: {classId, timeZone} — the time zone is the teacher's browser's, so
 * "7am on the lesson day" means 7am where she teaches.
 */
export async function POST(request: Request) {
  const started = Date.now();
  const body = await request.json().catch(() => ({}));
  const found = await teacherClass(body.classId);
  if (found instanceof NextResponse) return found;
  const { db, user, cls } = found;

  if (!cls.classroom_course_id) return bad("Choose a Google Classroom class first", 400);

  // Linked before sharing a course was refused: only the first class posts,
  // because the other would take its items for stray copies.
  if (!(await ownsCourse(cls.id, cls.classroom_course_id))) {
    return NextResponse.json(
      { conflict: true, error: "That Google Classroom class is linked to another class too. Unlink this one and choose a different class." },
      { status: 409 }
    );
  }

  let timeZone = "UTC";
  try {
    if (typeof body.timeZone === "string") {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timeZone });
      timeZone = body.timeZone;
    }
  } catch {}

  const token = await teacherToken(user.id);
  if (!token) return bad("Connect Google Classroom again", 401);

  // One run per class. Two at once both plan from the same links and both
  // create everything; a claim older than this route can live is a dead run.
  const stale = new Date(started - maxDuration * 1000).toISOString();
  const { data: claimed, error: claimError } = await db
    .from("classes")
    .update({ classroom_sync_started_at: new Date(started).toISOString() })
    .eq("id", cls.id)
    .or(`classroom_sync_started_at.is.null,classroom_sync_started_at.lt.${stale}`)
    .select("id");
  if (claimError) return bad("Could not start posting", 500);
  if (!claimed?.length) return NextResponse.json({ busy: true }, { status: 409 });
  const release = () =>
    db.from("classes").update({ classroom_sync_started_at: null }).eq("id", cls.id).then(() => undefined);

  try {
    const result = await runSync({
      db,
      token,
      classId: cls.id,
      courseId: cls.classroom_course_id,
      units: (cls.units ?? []) as CurriculumUnit[],
      rule: cls.posting_rule,
      timeZone,
      now: new Date(),
      deadline: started + DEADLINE_MS,
    });
    if (result.errors.length) console.error("[classroom] sync errors:", result.errors);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[classroom] sync failed:", err instanceof Error ? err.message : err);
    return bad("Could not reach Google Classroom", 502);
  } finally {
    await release();
  }
}
