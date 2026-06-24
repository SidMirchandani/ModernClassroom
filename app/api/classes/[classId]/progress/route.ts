import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  getDb,
  saveAllClassProgress,
  saveStudentProgress,
  userCanAccessClass,
} from "@/lib/db";
import type { DbStudentProgress } from "@/lib/db/types";

type RouteContext = { params: Promise<{ classId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { classId } = await context.params;
  const db = await getDb();
  if (!userCanAccessClass(db, userId, classId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const progress = db.progress.filter((p) => p.classId === classId);
  return NextResponse.json({ progress });
}

export async function PUT(request: Request, context: RouteContext) {
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

  const body = await request.json();

  if (access === "student") {
    const progress = body.progress as DbStudentProgress;
    if (!progress || progress.studentId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const saved = await saveStudentProgress({ ...progress, classId });
    return NextResponse.json({ progress: saved });
  }

  if (access === "teacher") {
    const all = body.progress as DbStudentProgress[];
    if (!Array.isArray(all)) {
      return NextResponse.json({ error: "Invalid progress data" }, { status: 400 });
    }
    await saveAllClassProgress(classId, all);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
