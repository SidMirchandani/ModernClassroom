"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * One browser client for the whole app. It comes from `@supabase/ssr` rather
 * than plain `supabase-js` so the session is kept in cookies, where a route
 * handler can read it — the curriculum import has to know who is asking.
 */
export function supabase(): SupabaseClient {
  if (!client) {
    if (!supabaseConfigured()) {
      throw new Error(
        "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
