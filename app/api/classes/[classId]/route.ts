import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  getClassById,
  getClassProgress,
  getDb,
  getInvitesForClass,
  getStudentsForClass,
  updateClass,
  userCanAccessClass,
} from "@/lib/db";

type RouteContext = { params: Promise<{ classId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { classId } = await context.params;
  const db = await getDb();
  const access = userCanAccessClass(db, userId, classId);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cls = await getClassById(classId);
  if (!cls) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const students = await getStudentsForClass(classId);
  const invites = access === "teacher" ? await getInvitesForClass(classId) : [];
  const progress = await getClassProgress(classId);
  const teacher = db.users.find((u) => u.id === cls.teacherId);

  return NextResponse.json({
    class: cls,
    role: access,
    students: students.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      username: s.username,
      avatar: s.firstName.charAt(0).toUpperCase(),
    })),
    invites,
    progress,
    teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : "",
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { classId } = await context.params;
  const db = await getDb();
  const access = userCanAccessClass(db, userId, classId);
  if (access !== "teacher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const patch: { name?: string; units?: typeof body.units; blockSectionId?: string | null } = {};

  if (typeof body.name === "string") patch.name = body.name;
  if (body.units) patch.units = body.units;
  if (body.blockSectionId !== undefined) patch.blockSectionId = body.blockSectionId;

  const updated = await updateClass(classId, patch);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ class: updated });
}
