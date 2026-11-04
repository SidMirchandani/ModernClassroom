import { NextResponse, type NextRequest } from "next/server";

/**
 * Nobody signed out sees any part of the dashboard, at any address: they go to
 * the landing page before a line of it renders. The browser's Supabase client
 * keeps its session in `sb-…-auth-token` cookies (one, or `.0`, `.1` when long).
 *
 * This only asks whether a session cookie exists. An expired one still gets
 * through to the pages, whose own check sends it to the same place.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.getAll().some((c) => /^sb-.+-auth-token/.test(c.name));
  if (hasSession) return NextResponse.next();
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = { matcher: "/dashboard/:path*" };
