import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { SIGNIN_COOKIE, signInUrl } from "@/lib/google/oauth";

export const runtime = "nodejs";

/**
 * "Continue with Google" starts here: off to Google's account chooser, with a
 * state to tie the answer to this browser and a nonce to tie the id token to
 * this request. Both wait in a short-lived cookie for the callback.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const hashed = createHash("sha256").update(nonce).digest("hex");

  const response = NextResponse.redirect(signInUrl(url.origin, state, hashed));
  response.cookies.set(SIGNIN_COOKIE, JSON.stringify({ state, nonce }), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/api/google/signin",
    maxAge: 600,
  });
  return response;
}
