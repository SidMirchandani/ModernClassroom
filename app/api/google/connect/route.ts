import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/server";
import { consentUrl, STATE_COOKIE } from "@/lib/google/oauth";

export const runtime = "nodejs";

/**
 * "Connect Google Classroom": sends the signed-in teacher to Google's consent
 * page. The state cookie ties the answer back to this browser, and carries the
 * page to return to.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", url.origin));

  // Only a path on this site: never an address someone else put in the link.
  const back = url.searchParams.get("returnTo") ?? "/dashboard";
  const returnTo = back.startsWith("/") && !back.startsWith("//") ? back : "/dashboard";

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(consentUrl(url.origin, state));
  response.cookies.set(STATE_COOKIE, JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return response;
}
