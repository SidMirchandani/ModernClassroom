"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CachedSubmission, SubmissionState } from "./classroom/grid";
import { supabase } from "./supabase/client";
import { useClassroomLinks } from "./use-classroom-links";

/**
 * The grid's data. It draws at once from the cache, then asks Classroom for
 * what is new (ADR-008: on open, and on Refresh), and listens for changes so a
 * pull made on another of the teacher's screens shows up here too.
 */

export interface GridStudent {
  userId: string;
  name: string;
}

export function useClassroomGrid(classId: string, enabled: boolean, syncCount = 0) {
  const [students, setStudents] = useState<GridStudent[]>([]);
  const [submissions, setSubmissions] = useState<CachedSubmission[]>([]);
  const { links, reload: reloadLinks } = useClassroomLinks(classId, enabled, syncCount);
  const [loaded, setLoaded] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pulledAt, setPulledAt] = useState<Date | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [error, setError] = useState("");
  const pullingRef = useRef(false);

  const read = useCallback(async () => {
    const db = supabase();
    const [roster, work] = await Promise.all([
      db.from("classroom_roster").select("user_id, name").eq("class_id", classId).order("name"),
      db
        .from("classroom_submissions")
        .select("user_id, item_key, state, late, assigned_grade, draft_grade")
        .eq("class_id", classId),
    ]);
    if (roster.error || work.error) return;
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
      // The pull can bring in assignments the teacher posted by hand.
      await Promise.all([read(), reloadLinks()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Google Classroom");
    } finally {
      pullingRef.current = false;
      setPulling(false);
    }
  }, [classId, read, reloadLinks]);

  /** Marks and totals go straight to Classroom (ADR-011). Returns the answer, or null if it failed. */
  const sendGrades = useCallback(
    async (body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
      setError("");
      try {
        const res = await fetch("/api/classroom/grades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId, ...body }),
        });
        const answer = await res.json().catch(() => ({}));
        if (answer.needsReconnect) {
          setNeedsReconnect(true);
          return null;
        }
        if (!res.ok) throw new Error(answer.error ?? "Could not reach Google Classroom");
        return answer;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not reach Google Classroom");
        return null;
      }
    },
    [classId]
  );

  /** Shown at once; if Classroom refuses, the cache puts back what is really there. */
  const saveMark = useCallback(
    async (itemKey: string, userId: string, mark: number | null) => {
      setSubmissions((rows) =>
        rows.map((s) => (s.itemKey === itemKey && s.userId === userId ? { ...s, draftGrade: mark } : s))
      );
      if (!(await sendGrades({ action: "mark", itemKey, userId, mark: mark ?? "" }))) await read();
    },
    [read, sendGrades]
  );

  const savePoints = useCallback(
    async (itemKey: string, points: number) => {
      await sendGrades({ action: "points", itemKey, points });
      await reloadLinks();
    },
    [reloadLinks, sendGrades]
  );

  const returnColumn = useCallback(
    async (itemKey: string) => {
      const answer = await sendGrades({ action: "return", itemKey });
      await read();
      const failed = Number(answer?.failed ?? 0);
      if (failed > 0) {
        setError(`${failed} ${failed === 1 ? "mark" : "marks"} couldn't be returned. Try again, or return them in Google Classroom.`);
      }
    },
    [read, sendGrades]
  );

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

  return {
    students,
    submissions,
    links,
    loaded,
    pulling,
    pulledAt,
    needsReconnect,
    error,
    refresh,
    saveMark,
    savePoints,
    returnColumn,
  };
}
