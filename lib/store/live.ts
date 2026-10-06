"use client";

import { isDemoMode } from "../demo-seed";
import { supabase, supabaseConfigured } from "../supabase/client";

/**
 * A class is two people looking at the same thing from opposite sides. A
 * student marks a step and the teacher's grid should say so; the teacher moves
 * a due date and the student should see the new one without being told to
 * refresh.
 *
 * What arrives here is only ever a nudge to re-read — never the data itself.
 * Re-reading goes through the store, which means it comes back through the
 * cache, the roles and the row-level security exactly like any other read, and
 * a nudge that arrives twice costs nothing.
 */

type Unsubscribe = () => void;

/** Changes anywhere in one class: progress, grades, roster, the curriculum. */
export function watchClass(classId: string, onChange: () => void): Unsubscribe {
  if (isDemoMode() || !supabaseConfigured()) return () => {};

  const client = supabase();
  let channel: ReturnType<typeof client.channel> | null = null;
  let cancelled = false;

  void (async () => {
    // The socket starts out holding the anon key, and row-level security is
    // what decides which changes are even visible — so the signed-in token has
    // to be handed over *before* subscribing, or the stream comes back empty
    // and silent, which is the worst of both worlds.
    const { data } = await client.auth.getSession();
    if (cancelled) return;
    const token = data.session?.access_token;
    if (token) await client.realtime.setAuth(token);
    if (cancelled) return;

    channel = client.channel(`class:${classId}`);

    const tables: [string, string][] = [
      ["progress", `class_id=eq.${classId}`],
      ["checkpoint_grades", `class_id=eq.${classId}`],
      ["enrollments", `class_id=eq.${classId}`],
      ["classes", `id=eq.${classId}`],
    ];

    for (const [table, filter] of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => onChange()
      );
    }

    channel.subscribe((status) => {
      // Losing the live stream is survivable — coming back to the window still
      // re-reads — but it should never fail quietly.
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`Live updates unavailable for this class (${status})`);
      }
    });
  })();

  return () => {
    cancelled = true;
    if (channel) void client.removeChannel(channel);
  };
}

/**
 * The backstop. Realtime can be off, blocked, or simply asleep in a tab that
 * was in the background for an hour — so coming back to the window is also a
 * reason to re-read. This is what makes the offline case finish honestly: the
 * moment the machine is back, the screen catches up.
 */
export function watchForeground(onChange: () => void): Unsubscribe {
  if (typeof window === "undefined") return () => {};

  const wake = () => {
    if (document.visibilityState === "visible") onChange();
  };

  window.addEventListener("focus", wake);
  window.addEventListener("online", onChange);
  document.addEventListener("visibilitychange", wake);

  return () => {
    window.removeEventListener("focus", wake);
    window.removeEventListener("online", onChange);
    document.removeEventListener("visibilitychange", wake);
  };
}
