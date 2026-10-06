"use client";

import type { CurriculumUnit } from "./db/types";
import type { Checkpoint, Section } from "./types";

/**
 * What has changed since this student last looked.
 *
 * A teacher revising the curriculum — by hand or by importing their time line
 * — is a change to somebody's week: a date moved, a subunit added, a resource
 * swapped. The student should be told, in the place the change happened, and
 * only until they have seen it.
 *
 * Kept per person and per device in localStorage rather than on the server: it
 * is a reading mark, not a record, and nothing is lost if it is missing. The
 * first time a class is ever opened nothing is flagged — everything would be
 * "new", which tells the student nothing at all.
 */

const KEY = "modern-classroom-seen";

export type NewsKind = "new" | "updated";
export type CurriculumNews = Map<string, NewsKind>;

type Marks = Record<string, string>;
type Store = Record<string, Marks>;

function scope(classId: string, userId: string): string {
  return `${classId}::${userId}`;
}

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // A full or blocked store just means no badges. Never a broken screen.
  }
}

/**
 * Everything about a subunit a student would notice. Resource *contents* count
 * too — a teacher adding a worksheet to an existing track is exactly the kind
 * of change that otherwise goes unannounced.
 */
function sectionMark(section: Section): string {
  const tracks = (section.tracks ?? [])
    .map((track) => {
      const learn = (track.blocks ?? []).filter((b) => b.type === "learn").length;
      const practice = (track.blocks ?? []).filter((b) => b.type === "practice").length;
      return [track.kind, track.label, track.reference ?? "", learn, practice].join(":");
    })
    .join("|");
  const objectives = (section.objectives ?? []).map((o) => o.text).join("~");
  return [section.title, section.date ?? "", objectives, tracks].join("§");
}

function checkpointMark(checkpoint: Checkpoint): string {
  return [
    checkpoint.kind,
    checkpoint.title,
    checkpoint.date ?? "",
    checkpoint.afterSectionId ?? "",
    checkpoint.note ?? "",
  ].join("§");
}

function marksOf(units: CurriculumUnit[]): Marks {
  const marks: Marks = {};
  for (const unit of units) {
    for (const section of unit.subunits ?? []) marks[section.id] = sectionMark(section);
    for (const checkpoint of unit.checkpoints ?? []) {
      marks[checkpoint.id] = checkpointMark(checkpoint);
    }
  }
  return marks;
}

/**
 * What is new or changed for this student right now. The first read of a class
 * records the curriculum silently and flags nothing.
 */
export function readNews(
  classId: string,
  userId: string,
  units: CurriculumUnit[]
): CurriculumNews {
  const news: CurriculumNews = new Map();
  if (!userId || units.length === 0) return news;

  const store = read();
  const key = scope(classId, userId);
  const seen = store[key];
  const current = marksOf(units);

  if (!seen) {
    store[key] = current;
    write(store);
    return news;
  }

  for (const [id, mark] of Object.entries(current)) {
    if (!(id in seen)) news.set(id, "new");
    else if (seen[id] !== mark) news.set(id, "updated");
  }

  return news;
}

/** This one has been looked at. The rest stay flagged. */
export function markSeen(
  classId: string,
  userId: string,
  id: string,
  units: CurriculumUnit[]
): void {
  if (!userId) return;
  const store = read();
  const key = scope(classId, userId);
  const current = marksOf(units);
  if (!(id in current)) return;
  store[key] = { ...(store[key] ?? {}), [id]: current[id] };
  write(store);
}

/** Everything has been looked at — the "dismiss" behind the summary banner. */
export function markAllSeen(
  classId: string,
  userId: string,
  units: CurriculumUnit[]
): void {
  if (!userId) return;
  const store = read();
  store[scope(classId, userId)] = marksOf(units);
  write(store);
}

/** Drop a class's marks — used when a student leaves it. */
export function forgetNews(classId: string, userId: string): void {
  const store = read();
  delete store[scope(classId, userId)];
  write(store);
}
