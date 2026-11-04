"use client";

import { useCallback, useEffect, useId, useState } from "react";
import type { GridLink } from "./classroom/grid";
import { supabase } from "./supabase/client";

/**
 * What the class's items look like in Google Classroom, kept current: a sync or
 * pull on any of the teacher's screens writes these rows, and this hears about
 * it. `version` re-reads when this screen's own sync finishes, so seeing the
 * result doesn't depend on the live connection.
 */
export function useClassroomLinks(classId: string, enabled: boolean, version = 0) {
  const [links, setLinks] = useState<GridLink[]>([]);
  const instance = useId();

  const read = useCallback(async () => {
    const { data, error } = await supabase()
      .from("classroom_links")
      .select("item_key, kind, state, scheduled_for, sent, classroom")
      .eq("class_id", classId);
    if (error) return;
    setLinks(
      (data ?? []).map((r) => ({
        itemKey: r.item_key,
        kind: r.kind,
        state: r.state,
        scheduledFor: r.scheduled_for,
        sent: r.sent,
        classroom: r.classroom,
      }))
    );
  }, [classId]);

  useEffect(() => {
    if (enabled) void read();
  }, [enabled, read, version]);

  useEffect(() => {
    if (!enabled) return;
    // Many rows arrive at once during a sync, so they collapse into one read.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const db = supabase();
    const channel = db
      // Named per use: the class page and its grid each listen, and Supabase
      // hands back the same channel for the same name, which throws.
      .channel(`classroom-links-${classId}-${instance}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "classroom_links", filter: `class_id=eq.${classId}` },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void read(), 400);
        }
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void db.removeChannel(channel);
    };
  }, [classId, enabled, read, instance]);

  return { links, reload: read };
}
