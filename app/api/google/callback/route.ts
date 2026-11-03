import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminClient, userClient } from "@/lib/supabase/server";
import { exchangeCode, STATE_COOKIE } from "@/lib/google/oauth";

export const runtime = "nodejs";

/**
 * Where Google sends the teacher back. The refresh token goes straight into
 * `google_connections` with the service role, and never reaches the browser.
 * Every outcome lands back on the page they started from, with `?google=`
 * saying how it went.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  let saved: { state?: string; returnTo?: string } = {};
  try {
    saved = JSON.parse(jar.get(STATE_COOKIE)?.value ?? "{}");
  } catch {}
  const returnTo = saved.returnTo ?? "/dashboard";

  const finish = (outcome: string) => {
    const back = new URL(returnTo, url.origin);
    back.searchParams.set("google", outcome);
    const response = NextResponse.redirect(back);
    response.cookies.delete({ name: STATE_COOKIE, path: "/api/google" });
    return response;
  };

  if (url.searchParams.get("error")) return finish("declined");
  const code = url.searchParams.get("code");
  if (!code || !saved.state || url.searchParams.get("state") !== saved.state) return finish("failed");

  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return finish("failed");

  try {
    const grant = await exchangeCode(code, url.origin);
    const { error } = await adminClient().from("google_connections").upsert({
      user_id: user.id,
      google_email: grant.email,
      refresh_token: grant.refreshToken,
      scopes: grant.scopes,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[google] connect failed:", err instanceof Error ? err.message : err);
    return finish("failed");
  }
  return finish("connected");
}
