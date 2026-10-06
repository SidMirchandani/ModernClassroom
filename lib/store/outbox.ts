"use client";

import type { CurriculumUnit, DbClass } from "../db/types";
import type { CheckpointGrade } from "../types";
import type { AccentId } from "../class-appearance";
import * as remote from "./remote";
import { SYNC_EVENT, type ClassPatch, type SectionRemap, type SyncState } from "./types";

/**
 * Writes that have not reached the server yet. Each one is keyed by the row it
 * touches, so two offline edits to the same thing collapse into the latest —
 * this is a map of intentions, not a log of keystrokes — and the queue cannot
 * grow past the number of rows a person can actually touch.
 */

export type OutboxOp =
  | { kind: "class.create"; classId: string; cls: DbClass }
  | { kind: "class.update"; classId: string; patch: ClassPatch }
  | { kind: "class.units"; classId: string; units: CurriculumUnit[]; remaps: SectionRemap[] }
  | { kind: "class.delete"; classId: string }
  | { kind: "enroll.remove"; classId: string; studentId: string }
  | { kind: "progress"; classId: string; row: remote.TrackWrite }
  | {
      kind: "grade";
      classId: string;
      studentId: string;
      checkpointId: string;
      grade: CheckpointGrade | null;
    }
  | { kind: "accent"; userId: string; accent: AccentId };

interface Entry {
  key: string;
  op: OutboxOp;
}

const OUTBOX_KEY = "modern-classroom-outbox";
const LOCK_NAME = "modern-classroom-outbox";
/** Flip this in devtools to rehearse losing the connection. */
export const FORCE_OFFLINE_KEY = "mc-force-offline";
const RETRY_MS = 30_000;

function keyFor(op: OutboxOp): string {
  switch (op.kind) {
    case "class.create":
      return `class:${op.classId}:create`;
    case "class.update":
      return `class:${op.classId}:meta`;
    case "class.units":
      return `class:${op.classId}:units`;
    case "class.delete":
      return `class:${op.classId}:delete`;
    case "enroll.remove":
      return `enroll:${op.classId}:${op.studentId}`;
    case "progress":
      return `progress:${op.classId}:${op.row.studentId}:${op.row.sectionId}:${op.row.trackId}`;
    case "grade":
      return `grade:${op.classId}:${op.studentId}:${op.checkpointId}`;
    case "accent":
      return `accent:${op.userId}`;
  }
}

function readEntries(): Entry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: Entry[]): void {
  if (entries.length === 0) localStorage.removeItem(OUTBOX_KEY);
  else localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
}

/** The browser says offline, or we have been told to pretend. */
export function connectionDown(): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  try {
    return localStorage.getItem(FORCE_OFFLINE_KEY) === "1";
  } catch {
    return false;
  }
}

/** A failure that means "no server", as opposed to "the server said no". */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const message = err instanceof Error ? err.message : String(err);
  return /fetch|network|offline|ECONN|timeout|Load failed/i.test(message);
}

/** Serialise across tabs where the browser lets us; otherwise just run. */
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) return locks.request(LOCK_NAME, fn);
  return fn();
}

class Outbox {
  private state: SyncState = { status: "synced", pending: 0 };
  private timer: number | null = null;
  private listening = false;

  current(): SyncState {
    return this.state;
  }

  size(): number {
    return readEntries().length;
  }

  hasPendingFor(classId: string): boolean {
    return readEntries().some((e) => "classId" in e.op && e.op.classId === classId);
  }

  /** The synced store saw a read fail for want of a connection. */
  markOffline(): void {
    this.emit({ status: "offline" });
  }

  private emit(next: Partial<SyncState>): void {
    this.state = { ...this.state, ...next, pending: this.size() };
    if (this.state.pending === 0 && this.state.status !== "offline") this.state.status = "synced";
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: this.state }));
    }
  }

  /** Called once by the synced store; safe to call again. */
  listen(): void {
    if (this.listening || typeof window === "undefined") return;
    this.listening = true;
    window.addEventListener("online", () => void this.flush());
    window.addEventListener("offline", () => this.emit({ status: "offline" }));
    // Another tab drained or filled the queue.
    window.addEventListener("storage", (e) => {
      if (e.key === OUTBOX_KEY || e.key === FORCE_OFFLINE_KEY) this.emit({});
    });
    this.timer = window.setInterval(() => {
      if (this.size() > 0) void this.flush();
    }, RETRY_MS);
    this.emit({});
  }

  enqueue(op: OutboxOp): void {
    const key = keyFor(op);
    let entries = readEntries();

    if (op.kind === "class.delete") {
      // Nothing queued for a class matters once it is gone — and a class the
      // server never heard of needs no deleting at all.
      const neverSynced = entries.some(
        (e) => e.op.kind === "class.create" && e.op.classId === op.classId
      );
      entries = entries.filter((e) => !("classId" in e.op && e.op.classId === op.classId));
      if (!neverSynced) entries.push({ key, op });
      writeEntries(entries);
      this.emit({ status: "pending" });
      return;
    }

    const idx = entries.findIndex((e) => e.key === key);
    if (idx >= 0) {
      const existing = entries[idx].op;
      entries[idx] = {
        key,
        op:
          op.kind === "class.update" && existing.kind === "class.update"
            ? { ...op, patch: { ...existing.patch, ...op.patch } }
            : op,
      };
    } else {
      entries.push({ key, op });
    }
    writeEntries(entries);
    this.emit({ status: "pending" });
  }

  /**
   * Push everything, in order, stopping at the first sign the server is out of
   * reach. A write the server *refuses* is dropped rather than retried forever
   * — it would never succeed, and one bad row must not hold up the rest.
   */
  async flush(): Promise<boolean> {
    if (connectionDown()) {
      this.emit({ status: "offline" });
      return false;
    }
    return withLock(async () => {
      let entries = readEntries();
      if (entries.length === 0) {
        this.emit({ status: "synced" });
        return true;
      }
      this.emit({ status: "pending" });

      // One free retry before calling it a night. The first write after a
      // sign-in can fail while the session token is still being attached, and
      // a banner saying "offline" on a perfectly good connection is a lie.
      let retried = false;
      // A write the server refuses outright is dropped — it will never succeed,
      // and retrying it forever would block everything behind it. But dropping
      // it silently is worse: the person made a change that is now gone. This
      // survives to the end of the flush so the status pill still says so.
      let refused = 0;

      while (entries.length > 0) {
        const head = entries[0];
        try {
          if (head.op.kind === "progress") {
            // Every queued row for this class goes up in one call.
            const classId = head.op.classId;
            const batch = entries.filter(
              (e) => e.op.kind === "progress" && e.op.classId === classId
            );
            await remote.upsertTracks(
              classId,
              batch.map((e) => (e.op as Extract<OutboxOp, { kind: "progress" }>).row)
            );
            const done = new Set(batch.map((e) => e.key));
            entries = entries.filter((e) => !done.has(e.key));
          } else {
            await this.push(head.op);
            entries = entries.slice(1);
          }
          writeEntries(entries);
        } catch (err) {
          if (isNetworkError(err)) {
            if (!retried) {
              retried = true;
              await new Promise((r) => setTimeout(r, 800));
              continue;
            }
            this.emit({ status: "offline" });
            return false;
          }
          console.error("[sync] write refused and dropped", head.op.kind, err);
          entries = entries.slice(1);
          writeEntries(entries);
          refused += 1;
        }
      }
      this.emit(refused > 0 ? { status: "error" } : { status: "synced" });
      return refused === 0;
    });
  }

  private async push(op: OutboxOp): Promise<void> {
    switch (op.kind) {
      case "class.create":
        await remote.createClass(op.cls);
        return;
      case "class.update":
        await remote.updateClass(op.classId, op.patch);
        return;
      case "class.units":
        await remote.applyCurriculum(op.classId, op.units, op.remaps, null);
        return;
      case "class.delete":
        await remote.deleteClass(op.classId);
        return;
      case "enroll.remove":
        await remote.unenroll(op.classId, op.studentId);
        return;
      case "grade":
        await remote.setGrade(op.classId, op.studentId, op.checkpointId, op.grade);
        return;
      case "accent":
        await remote.setAccent(op.userId, op.accent);
        return;
      case "progress":
        await remote.upsertTracks(op.classId, [op.row]);
        return;
    }
  }

  clear(): void {
    writeEntries([]);
    this.emit({ status: "synced" });
  }
}

export const outbox = new Outbox();
