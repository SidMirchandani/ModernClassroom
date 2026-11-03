import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The signed-in caller, as themselves. Row-level security applies, so this
 * client can only see and change what that person could from the browser.
 */
export async function userClient(): Promise<SupabaseClient> {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        // A route handler cannot set cookies on this response; the browser
        // client owns the session and refreshes it there.
        setAll: () => {},
      },
    }
  );
}

/**
 * A client that can start a session: the cookies it sets go on `response`, so
 * the browser leaves signed in. Only for the one route that signs people in;
 * everywhere else the browser client owns the session.
 */
export async function sessionClient(response: NextResponse): Promise<SupabaseClient> {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  );
}

/**
 * The service role: bypasses row-level security. Used for one table only —
 * `google_connections`, which no signed-in caller may read — and only after
 * the route has checked who is asking with `userClient`.
 */
export function adminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
