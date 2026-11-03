import { NextResponse } from "next/server";
import { adminClient, userClient } from "@/lib/supabase/server";
import { revoke } from "@/lib/google/oauth";
import { bad, loadConnection } from "@/lib/classroom/server";

export const runtime = "nodejs";

/**
 * Disconnect Google: the grant is revoked at Google and deleted here. What was
 * already posted stays in Classroom — it is the teacher's course — and so do
 * the links, so reconnecting later carries on rather than posting it all twice.
 * The cached students and turn-ins are wiped; a reconnect pulls them again.
 */
export async function POST() {
  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return bad("Sign in first", 401);

  // The cached roster and turn-ins go with the connection (ADR-009).
  const { data: classes } = await db.from("classes").select("id").eq("teacher_id", user.id);
  const classIds = (classes ?? []).map((c) => c.id as string);
  if (classIds.length) {
    await db.from("classroom_submissions").delete().in("class_id", classIds);
    await db.from("classroom_roster").delete().in("class_id", classIds);
  }

  const connection = await loadConnection(user.id);
  if (connection) await revoke(connection.refreshToken);
  const { error } = await adminClient().from("google_connections").delete().eq("user_id", user.id);
  if (error) return bad("Could not disconnect", 500);
  return NextResponse.json({ ok: true });
}
