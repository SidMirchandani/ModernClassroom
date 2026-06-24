import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  getDb,
  joinClassByCode,
} from "@/lib/db";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { code } = body as { code?: string };
  if (!code?.trim()) {
    return NextResponse.json({ error: "Class code required" }, { status: 400 });
  }

  const db = await getDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = db.classes.find((c) => c.code === code.trim());
  if (!target) {
    return NextResponse.json({ error: "Invalid class code" }, { status: 404 });
  }
  if (target.teacherId === userId) {
    return NextResponse.json(
      { error: "You already teach this class" },
      { status: 400 }
    );
  }

  const cls = await joinClassByCode(userId, code.trim());
  if (!cls) {
    return NextResponse.json({ error: "Invalid class code" }, { status: 404 });
  }

  return NextResponse.json({
    class: {
      id: cls.id,
      name: cls.name,
      code: cls.code,
    },
  });
}
