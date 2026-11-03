"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Course } from "./classroom/api";
import type { PostingRule } from "./classroom/plan";
import type { SyncResult } from "./classroom/sync";

/**
 * The teacher view's side of the Google Classroom connection: where the class
 * stands, the choices that go with it, and posting.
 *
 * Posting happens two ways. The teacher presses "Post to Google Classroom" and
 * sees how it went. Or it happens on its own, after an approved curriculum, and
 * then it is quiet: a failure is retried a little later rather than shown
 * (ADR-008).
 */

export type ClassroomStatus =
  | { state: "loading" }
  | { state: "unavailable" }
  | { state: "disconnected" }
  | {
      state: "connected";
      email: string | null;
      courses: Course[];
      courseId: string | null;
      postingRule: PostingRule;
      counts: { posted: number; scheduled: number; drafts: number };
    };

export interface PostSummary {
  created: number;
  updated: number;
  removed: number;
  failed: number;
}

const RETRY_MS = 30_000;
/** Another post for this class is running: wait this long and ask again. */
const BUSY_WAIT_MS = 4_000;
const MAX_QUIET_RETRIES = 3;
/** A year's curriculum can take a few runs; past this something is wrong. */
const MAX_RUNS = 12;

export function useClassroom(classId: string, enabled: boolean) {
  const [status, setStatus] = useState<ClassroomStatus>({ state: enabled ? "loading" : "unavailable" });
  const [posting, setPosting] = useState(false);
  const [lastPost, setLastPost] = useState<PostSummary | null>(null);
  const [error, setError] = useState("");
  const statusRef = useRef(status);
  statusRef.current = status;
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The run in progress from this tab, so a second request waits for it
  // instead of racing it (the server refuses a second run anyway).
  const inFlight = useRef<Promise<PostSummary> | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch(`/api/classroom?classId=${encodeURIComponent(classId)}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      setStatus(body.connected ? { state: "connected", ...body } : { state: "disconnected" });
    } catch {
      setStatus({ state: "unavailable" });
    }
  }, [classId, enabled]);

  useEffect(() => {
    if (enabled) setStatus((s) => (s.state === "unavailable" ? { state: "loading" } : s));
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => () => {
    if (retry.current) clearTimeout(retry.current);
  }, []);

  const save = useCallback(
    async (patch: { courseId?: string; postingRule?: PostingRule }) => {
      setError("");
      const res = await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, ...patch }),
      });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Could not save that");
      await refresh();
    },
    [classId, refresh]
  );

  /** Runs the sync until nothing is left. Throws when it cannot finish. */
  const runOnce = useCallback(async (): Promise<PostSummary> => {
    const total: PostSummary = { created: 0, updated: 0, removed: 0, failed: 0 };
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    for (let run = 0; run < MAX_RUNS; run++) {
      const res = await fetch("/api/classroom/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, timeZone }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.busy) {
        await new Promise((resolve) => setTimeout(resolve, BUSY_WAIT_MS));
        continue;
      }
      if (!res.ok) throw new Error(body.error ?? "Could not reach Google Classroom");
      const result = body as SyncResult;
      total.created += result.created;
      total.updated += result.updated;
      total.removed += result.removed;
      total.failed += result.failed;
      if (result.remaining === 0) return total;
    }
    throw new Error("Posting is taking longer than it should. Try again in a minute.");
  }, [classId]);

  /** One run at a time from this tab: a request made mid-run goes after it. */
  const runAll = useCallback((): Promise<PostSummary> => {
    const previous = inFlight.current ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => runOnce());
    inFlight.current = next;
    void next.finally(() => {
      if (inFlight.current === next) inFlight.current = null;
    }).catch(() => undefined);
    return next;
  }, [runOnce]);

  const post = useCallback(async () => {
    setPosting(true);
    setError("");
    try {
      setLastPost(await runAll());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Google Classroom");
    } finally {
      setPosting(false);
      await refresh();
    }
  }, [runAll, refresh]);

  /** The quiet kind: only for a class already posting, and never an error on screen. */
  const postQuietly = useCallback(
    (attempt = 0) => {
      const current = statusRef.current;
      if (current.state !== "connected" || !current.courseId) return;
      if (retry.current) clearTimeout(retry.current);
      void runAll()
        .then(() => refresh())
        .catch(() => {
          if (attempt + 1 < MAX_QUIET_RETRIES) {
            retry.current = setTimeout(() => postQuietly(attempt + 1), RETRY_MS);
          }
        });
    },
    [runAll, refresh]
  );

  const disconnect = useCallback(async () => {
    await fetch("/api/google/disconnect", { method: "POST" });
    setLastPost(null);
    await refresh();
  }, [refresh]);

  const connectHref = useCallback(() => {
    const here = `${window.location.pathname}${window.location.search}`;
    return `/api/google/connect?returnTo=${encodeURIComponent(here)}`;
  }, []);

  return { status, posting, lastPost, error, refresh, save, post, postQuietly, disconnect, connectHref };
}

export type ClassroomConnection = ReturnType<typeof useClassroom>;
