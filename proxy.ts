import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Nobody signed out sees any part of the dashboard, at any address: they go to
 * the landing page before a line of it renders. Anyone signed in skips the landing
 * page and goes straight to their dashboard. The browser's Supabase client keeps
 * its session in `sb-…-auth-token` cookies (one, or `.0`, `.1` when long).
 *
 * The dashboard only asks whether a session cookie exists: an expired one still
 * gets through to the pages, whose own check sends it to the landing page. So the
 * landing page cannot trust the cookie alone, or the two would pass an expired
 * session back and forth forever. It asks Supabase, and if Supabase says no or
 * can't be reached, the visitor simply sees the landing page.
 */
export async function proxy(request: NextRequest) {
  const hasSession = request.cookies.getAll().some((c) => /^sb-.+-auth-token/.test(c.name));

  if (request.nextUrl.pathname !== "/") {
    return hasSession ? NextResponse.next() : NextResponse.redirect(new URL("/", request.url));
  }

  // `out` is a page saying it found no user (`SIGNED_OUT_HOME`): stay here.
  if (!hasSession || request.nextUrl.searchParams.has("out")) return NextResponse.next();
  return (await dashboardIfSignedIn(request)) ?? NextResponse.next();
}

async function dashboardIfSignedIn(request: NextRequest): Promise<NextResponse | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  // Checking an expired session renews it, and the new cookies must reach the browser.
  const renewed: { name: string; value: string; options: object }[] = [];
  const auth = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        renewed.push(...list);
      },
    },
  }).auth;

  try {
    const { data, error } = await auth.getUser();
    if (error || !data.user) return null;
  } catch {
    return null;
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  renewed.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

export const config = { matcher: ["/", "/dashboard/:path*"] };
