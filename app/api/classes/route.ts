import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  createClassForTeacher,
  findUserById,
  getAllSubunits,
  getClassesForUser,
  getEnrollmentsForClass,
  getStudentsForClass,
} from "@/lib/db";
import type { ClassSummary } from "@/lib/db/types";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const classes = await getClassesForUser(userId);
  const summaries: ClassSummary[] = await Promise.all(
    classes.map(async (cls) => {
      const enrollments = await getEnrollmentsForClass(cls.id);
      const role = cls.teacherId === userId ? "teacher" : "student";
      return {
        id: cls.id,
        name: cls.name,
        code: cls.code,
        role,
        studentCount: enrollments.length,
        subunitCount: getAllSubunits(cls).length,
      };
    })
  );

  return NextResponse.json({ classes: summaries });
}

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cls = await createClassForTeacher(userId);
  const students = await getStudentsForClass(cls.id);

  return NextResponse.json({
    class: {
      id: cls.id,
      name: cls.name,
      code: cls.code,
      role: "teacher" as const,
      studentCount: students.length,
      subunitCount: getAllSubunits(cls).length,
    },
  });
}
