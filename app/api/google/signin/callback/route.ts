import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionClient } from "@/lib/supabase/server";
import { exchangeForIdToken, SIGNIN_COOKIE } from "@/lib/google/oauth";

export const runtime = "nodejs";

/**
 * Back from Google: trade the code for an id token, and the id token for a
 * Supabase session (signInWithIdToken). Supabase makes the account on a first
 * visit; the profile trigger names it. The session cookies go on the redirect
 * to `/auth/callback`, which picks up invites and moves on to the dashboard.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  let saved: { state?: string; nonce?: string } = {};
  try {
    saved = JSON.parse(jar.get(SIGNIN_COOKIE)?.value ?? "{}");
  } catch {}

  const to = (path: string) => {
    const response = NextResponse.redirect(new URL(path, url.origin));
    response.cookies.delete({ name: SIGNIN_COOKIE, path: "/api/google/signin" });
    return response;
  };

  if (url.searchParams.get("error")) return to("/auth/callback?error=cancelled");
  const code = url.searchParams.get("code");
  if (!code || !saved.state || !saved.nonce || url.searchParams.get("state") !== saved.state) {
    return to("/auth/callback?error=failed");
  }

  const response = to("/auth/callback");
  try {
    const token = await exchangeForIdToken(code, url.origin);
    const supabase = await sessionClient(response);
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token, nonce: saved.nonce });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[google] sign-in failed:", err instanceof Error ? err.message : err);
    return to("/auth/callback?error=failed");
  }
  return response;
}
