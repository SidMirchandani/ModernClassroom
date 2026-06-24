import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  enrollStudent,
  findUserByEmailOrUsername,
  getDb,
  getInvitesForClass,
  getStudentsForClass,
  userCanAccessClass,
} from "@/lib/db";

type RouteContext = { params: Promise<{ classId: string }> };

export async function POST(request: Request, context: RouteContext) {
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
  const { emailOrUsername } = body as { emailOrUsername?: string };
  if (!emailOrUsername?.trim()) {
    return NextResponse.json({ error: "Email or username required" }, { status: 400 });
  }

  const cls = db.classes.find((c) => c.id === classId);
  const existingUser = await findUserByEmailOrUsername(emailOrUsername.trim());
  if (existingUser) {
    if (existingUser.id === cls?.teacherId) {
      return NextResponse.json(
        { error: "The class teacher cannot be added as a student" },
        { status: 400 }
      );
    }
    await enrollStudent(classId, existingUser.id);
  } else {
    const { addInvite } = await import("@/lib/db");
    await addInvite(classId, emailOrUsername.trim());
  }

  const students = await getStudentsForClass(classId);
  const invites = await getInvitesForClass(classId);

  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      username: s.username,
      avatar: s.firstName.charAt(0).toUpperCase(),
    })),
    invites,
  });
}
