import type { CurriculumUnit } from "../db/types";
import { gridColumns, type GridColumn, type GridLink } from "./grid";
import { checkpointKey, topicKey } from "./plan";

/**
 * Showing what was changed in Google Classroom (ADR-012). These are views: the
 * curriculum itself is left as the teacher's file made it, so uploading the same
 * file again finds nothing new and can't undo an edit made in Classroom.
 *
 * One lesson can be several Classroom items, so an edit to one item can't speak
 * for the lesson. A lesson only takes a new date when all its items agree, and
 * the grid, which has a column per item, shows each item's own.
 */

/** A due instant as the teacher's own calendar writes it, like a curriculum date. */
export function dayLabel(instant: string): string {
  const date = new Date(instant);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** GONE also means "read from Classroom, never posted" (`adoptionLinks`), which is not a deletion. */
function deletedInClassroom(link: GridLink): boolean {
  return link.state === "GONE" && !link.sent?.fromClassroom;
}

function changed(link: GridLink, field: "title" | "due"): boolean {
  if (!link.sent || !link.classroom || link.sent.fromClassroom) return false;
  return (link.classroom[field] ?? null) !== (link.sent[field] ?? null);
}

function dueInClassroom(link: GridLink): string | undefined {
  return link.classroom?.due ? dayLabel(link.classroom.due) : undefined;
}

/** A unit's columns as Classroom has them: its edits in, its deletions out. */
export function visibleColumns(columns: GridColumn[], links: GridLink[]): GridColumn[] {
  const byKey = new Map(links.map((l) => [l.itemKey, l]));
  const out: GridColumn[] = [];
  for (const column of columns) {
    const link = byKey.get(column.key);
    if (link?.state === "GONE") continue;
    if (!link) {
      out.push(column);
      continue;
    }
    const next = { ...column };
    if (changed(link, "title")) {
      if (column.kind === "checkpoint") next.head = link.classroom!.title;
      else next.detail = link.classroom!.title;
    }
    if (changed(link, "due")) next.date = dueInClassroom(link);
    out.push(next);
  }
  return out;
}

/** Assignments the teacher posted by hand. Not in any unit: only Classroom knows them. */
export function externalColumns(links: GridLink[]): GridColumn[] {
  return links
    .filter((l) => l.kind === "external")
    .map((l) => ({
      key: l.itemKey,
      head: l.classroom?.title ?? "Untitled",
      date: l.classroom?.due ? dayLabel(l.classroom.due) : undefined,
      kind: "checkpoint" as const,
    }));
}

export interface CurriculumView {
  units: CurriculumUnit[];
  /** Section and checkpoint ids deleted in Classroom. */
  gone: Set<string>;
  /** How many things read differently because of an edit in Classroom. */
  edits: number;
}

export function curriculumView(units: CurriculumUnit[], links: GridLink[]): CurriculumView {
  const byKey = new Map(links.map((l) => [l.itemKey, l]));
  const gone = new Set<string>();
  let edits = 0;

  const view = units.map((unit) => {
    const lessonLinks = new Map<string, GridLink[]>();
    for (const column of gridColumns(unit)) {
      const link = byKey.get(column.key);
      if (column.kind !== "lesson" || !link) continue;
      lessonLinks.set(column.head, [...(lessonLinks.get(column.head) ?? []), link]);
    }

    const subunits = unit.subunits.map((section) => {
      const items = lessonLinks.get(section.id) ?? [];
      if (items.length && items.every((l) => l.state === "GONE")) {
        if (items.every(deletedInClassroom)) gone.add(section.id);
        return section;
      }
      const live = items.filter((l) => l.state !== "GONE");
      const dates = new Set(live.map(dueInClassroom));
      const date = dates.size === 1 ? [...dates][0] : undefined;
      if (date && live.every((l) => changed(l, "due"))) {
        edits++;
        return { ...section, date };
      }
      return section;
    });

    const checkpoints = (unit.checkpoints ?? []).map((checkpoint) => {
      const link = byKey.get(checkpointKey(checkpoint));
      if (!link) return checkpoint;
      if (link.state === "GONE") {
        if (deletedInClassroom(link)) gone.add(checkpoint.id);
        return checkpoint;
      }
      const title = changed(link, "title") ? link.classroom!.title : checkpoint.title;
      const date = changed(link, "due") ? dueInClassroom(link) : checkpoint.date;
      if (title === checkpoint.title && date === checkpoint.date) return checkpoint;
      edits++;
      return { ...checkpoint, title, date };
    });

    const topic = byKey.get(topicKey(unit));
    let title = unit.title;
    if (topic && topic.state !== "GONE" && changed(topic, "title")) {
      title = topic.classroom!.title;
      edits++;
    }
    return { ...unit, title, subunits, checkpoints };
  });

  return { units: view, gone, edits };
}
