import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { adminClient, userClient } from "../supabase/server";
import { accessToken, GoogleAuthError } from "../google/oauth";
import type { PostingRule } from "./plan";

/** Shared by the Classroom routes: who is asking, and may they touch this class. */

export function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export interface TeacherClass {
  db: SupabaseClient;
  user: User;
  cls: {
    id: string;
    units: unknown;
    block_section_id: string | null;
    classroom_course_id: string | null;
    posting_rule: PostingRule;
  };
}

/** The caller, and the class if they teach it — or the response to send instead. */
export async function teacherClass(classId: unknown): Promise<TeacherClass | NextResponse> {
  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return bad("Sign in first", 401);
  if (typeof classId !== "string" || !classId) return bad("Which class?", 400);

  const { data: cls, error } = await db
    .from("classes")
    .select("id, teacher_id, units, block_section_id, classroom_course_id, posting_rule")
    .eq("id", classId)
    .maybeSingle();
  if (error) return bad("Could not read the class", 500);
  if (!cls || cls.teacher_id !== user.id) return bad("Only this class's teacher can do that", 403);
  return { db, user, cls };
}

export interface Connection {
  email: string | null;
  refreshToken: string;
}

export async function loadConnection(userId: string): Promise<Connection | null> {
  const { data, error } = await adminClient()
    .from("google_connections")
    .select("google_email, refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not read the Google connection: ${error.message}`);
  return data ? { email: data.google_email, refreshToken: data.refresh_token } : null;
}

/**
 * A fresh access token for the teacher, or null when Google no longer honours
 * the grant (revoked from their Google account) — the connection is dropped
 * then, so the app asks them to connect again instead of failing forever.
 */
export async function teacherToken(userId: string): Promise<string | null> {
  const connection = await loadConnection(userId);
  if (!connection) return null;
  try {
    return await accessToken(connection.refreshToken);
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      await adminClient().from("google_connections").delete().eq("user_id", userId);
      return null;
    }
    throw err;
  }
}
