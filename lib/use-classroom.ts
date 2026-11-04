"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Course } from "./classroom/api";
import type { PostingRule } from "./classroom/plan";
import type { SyncResult } from "./classroom/sync";

/**
 * The teacher view's side of the Google Classroom connection: where the class
 * stands, the choices that go with it, and posting.
 *
 * Posting has no button, because a teacher would miss it. It runs by itself when
 * the class opens, when a Classroom class or posting rule is chosen, and after a
 * curriculum is approved. A failure is retried quietly a few times (ADR-008) and
 * only then shown, with "Try again".
 */

export type ClassroomStatus =
  | { state: "loading" }
  | { state: "unavailable" }
  | { state: "disconnected" }
  | {
      state: "connected";
      email: string | null;
      courses: (Course & { linked?: boolean })[];
      courseId: string | null;
      postingRule: PostingRule;
      counts: { posted: number; scheduled: number; drafts: number; kept?: number };
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

/** Won't get better by trying again: says why, and stops. */
class SyncRefused extends Error {}

export function useClassroom(classId: string, enabled: boolean) {
  const [status, setStatus] = useState<ClassroomStatus>({ state: enabled ? "loading" : "unavailable" });
  const [syncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  // Counts finished syncs, for anything showing what a sync may have changed.
  const [syncCount, setSyncCount] = useState(0);
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
      if (body.conflict) throw new SyncRefused(body.error);
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

  /** One sync, retried quietly; the teacher hears about it only if every try fails. */
  const sync = useCallback(
    (attempt = 0) => {
      if (retry.current) clearTimeout(retry.current);
      setSyncing(true);
      setSyncFailed(false);
      setError("");
      const again = () => {
        if (attempt + 1 < MAX_QUIET_RETRIES) {
          retry.current = setTimeout(() => sync(attempt + 1), RETRY_MS);
        } else {
          setSyncing(inFlight.current !== null);
          setSyncFailed(true);
        }
      };
      void runAll()
        .then(async (summary) => {
          if (summary.failed > 0) return again();
          setSyncing(inFlight.current !== null);
          setSyncCount((n) => n + 1);
          await refresh();
        })
        .catch((err) => {
          if (err instanceof SyncRefused) {
            setSyncing(false);
            setError(err.message);
          } else {
            again();
          }
        });
    },
    [runAll, refresh]
  );

  /** After an approved curriculum: only for a class that has a Classroom class. */
  const postQuietly = useCallback(() => {
    const current = statusRef.current;
    if (current.state === "connected" && current.courseId) sync();
  }, [sync]);

  // Opening the class catches up on anything an earlier run left unfinished.
  // Once per class: the status re-reads after every sync.
  const caughtUp = useRef<string | null>(null);
  useEffect(() => {
    if (status.state !== "connected" || !status.courseId || caughtUp.current === classId) return;
    caughtUp.current = classId;
    sync();
  }, [status, classId, sync]);

  const save = useCallback(
    async (patch: { courseId?: string; postingRule?: PostingRule }) => {
      setError("");
      const res = await fetch("/api/classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, ...patch }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Could not save that");
        await refresh();
        return;
      }
      // Set first: the refresh below would otherwise start a second sync.
      caughtUp.current = classId;
      await refresh();
      sync();
    },
    [classId, refresh, sync]
  );

  const retrySync = useCallback(() => sync(), [sync]);

  /** Stops posting to its Classroom class. What is already there stays. Returns whether it worked. */
  const unlink = useCallback(async () => {
    setError("");
    const res = await fetch("/api/classroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, unlink: true }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not unlink");
      return;
    }
    if (retry.current) clearTimeout(retry.current);
    setSyncing(false);
    setSyncFailed(false);
    caughtUp.current = null;
    await refresh();
  }, [classId, refresh]);

  const disconnect = useCallback(async () => {
    await fetch("/api/google/disconnect", { method: "POST" });
    if (retry.current) clearTimeout(retry.current);
    setSyncing(false);
    setSyncFailed(false);
    caughtUp.current = null;
    await refresh();
  }, [refresh]);

  const connectHref = useCallback(() => {
    const here = `${window.location.pathname}${window.location.search}`;
    return `/api/google/connect?returnTo=${encodeURIComponent(here)}`;
  }, []);

  return { status, syncing, syncFailed, syncCount, error, refresh, save, retrySync, unlink, postQuietly, disconnect, connectHref };
}

export type ClassroomConnection = ReturnType<typeof useClassroom>;
