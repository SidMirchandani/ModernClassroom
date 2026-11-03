"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CachedSubmission, GridLink, SubmissionState } from "./classroom/grid";
import { supabase } from "./supabase/client";

/**
 * The grid's data. It draws at once from the cache, then asks Classroom for
 * what is new (ADR-008: on open, and on Refresh), and listens for changes so a
 * pull made on another of the teacher's screens shows up here too.
 */

export interface GridStudent {
  userId: string;
  name: string;
}

export function useClassroomGrid(classId: string, enabled: boolean) {
  const [students, setStudents] = useState<GridStudent[]>([]);
  const [submissions, setSubmissions] = useState<CachedSubmission[]>([]);
  const [links, setLinks] = useState<GridLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pulledAt, setPulledAt] = useState<Date | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [error, setError] = useState("");
  const pullingRef = useRef(false);

  const read = useCallback(async () => {
    const db = supabase();
    const [roster, work, posted] = await Promise.all([
      db.from("classroom_roster").select("user_id, name").eq("class_id", classId).order("name"),
      db
        .from("classroom_submissions")
        .select("user_id, item_key, state, late, assigned_grade, draft_grade")
        .eq("class_id", classId),
      db.from("classroom_links").select("item_key, state, scheduled_for").eq("class_id", classId),
    ]);
    if (roster.error || work.error || posted.error) return;
    setStudents((roster.data ?? []).map((r) => ({ userId: r.user_id, name: r.name })));
    setSubmissions(
      (work.data ?? []).map((r) => ({
        userId: r.user_id,
        itemKey: r.item_key,
        state: r.state as SubmissionState,
        late: r.late,
        assignedGrade: r.assigned_grade,
        draftGrade: r.draft_grade,
      }))
    );
    setLinks(
      (posted.data ?? []).map((r) => ({ itemKey: r.item_key, state: r.state, scheduledFor: r.scheduled_for }))
    );
    setLoaded(true);
  }, [classId]);

  const refresh = useCallback(async () => {
    if (pullingRef.current) return;
    pullingRef.current = true;
    setPulling(true);
    setError("");
    try {
      const res = await fetch("/api/classroom/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.needsReconnect) {
        setNeedsReconnect(true);
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Could not reach Google Classroom");
      setNeedsReconnect(false);
      setPulledAt(new Date());
      await read();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Google Classroom");
    } finally {
      pullingRef.current = false;
      setPulling(false);
    }
  }, [classId, read]);

  useEffect(() => {
    if (!enabled) return;
    void read().then(refresh);
  }, [enabled, read, refresh]);

  // Another screen's pull lands in these tables. Several rows arrive at once,
  // so they collapse into one read.
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const nudge = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void read(), 300);
    };
    const filter = `class_id=eq.${classId}`;
    const db = supabase();
    const channel = db
      .channel(`classroom-grid-${classId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "classroom_submissions", filter }, nudge)
      .on("postgres_changes", { event: "*", schema: "public", table: "classroom_roster", filter }, nudge)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void db.removeChannel(channel);
    };
  }, [classId, enabled, read]);

  return { students, submissions, links, loaded, pulling, pulledAt, needsReconnect, error, refresh };
}
