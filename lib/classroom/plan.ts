import type { CurriculumUnit } from "../db/types";
import type { Checkpoint, ResourceTrack, Section, TrackStep } from "../types";

/**
 * What a curriculum should look like in Google Classroom, and the calls that
 * get it there. Pure: no network, no clock of its own — the sync route hands
 * in the time, the time zone and what Classroom already has.
 *
 *   Unit        → Topic
 *   Learn       → Material      (one per resource track)
 *   Practice    → Assignment    (one per resource track)
 *   Checkpoint  → Assignment    (graded)
 *
 * A lesson with no Learn or Practice written into it yet — how an imported
 * plan usually arrives: a title, a date, the resources — still posts: one
 * assignment per resource, or one for the lesson when it names none, due on
 * its date, so students have something to turn in and progress comes back.
 *
 * The posting rule decides *when* each item appears — on its lesson day, or
 * when its unit starts — and Classroom itself publishes a scheduled draft on
 * its date (proven in M1), so nothing of ours has to be running then. To
 * change when something appears, the teacher changes its date.
 */

export type PostingRule = "lesson_day" | "unit_start";

export const POSTING_RULES: PostingRule[] = ["lesson_day", "unit_start"];

export type ItemKind = "topic" | "material" | "assignment";

/** DRAFT = unpublished, no date. SCHEDULED = Classroom publishes it at `at`. */
export type Target =
  | { state: "PUBLISHED" }
  | { state: "SCHEDULED"; at: string }
  | { state: "DRAFT" };

export type LinkState = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "GONE";

export interface ClassroomLink {
  itemKey: string;
  kind: ItemKind;
  classroomId: string;
  state: LinkState;
  scheduledFor: string | null;
}

export interface ClassroomDue {
  date: { year: number; month: number; day: number };
  time: { hours: number; minutes: number };
}

export interface PlannedTopic {
  key: string;
  kind: "topic";
  name: string;
}

export interface PlannedWork {
  key: string;
  kind: "material" | "assignment";
  topicKey: string;
  title: string;
  description: string;
  links: string[];
  maxPoints?: number;
  due?: ClassroomDue;
  target: Target;
}

export type PlannedItem = PlannedTopic | PlannedWork;

export type SyncOp =
  | { type: "create"; item: PlannedItem }
  | { type: "update"; item: PlannedWork; link: ClassroomLink };

export interface PlanInput {
  units: CurriculumUnit[];
  rule: PostingRule;
  links: ClassroomLink[];
  now: Date;
  timeZone: string;
}

/** Lessons post at the start of the school day; work is due at its end. */
const POST_AT = { hours: 7, minutes: 0 };
const DUE_AT = { hours: 23, minutes: 59 };

export function topicKey(unit: CurriculumUnit): string {
  return `unit:${unit.id}`;
}

export function trackKey(step: TrackStep, track: ResourceTrack): string {
  return `${step}:${track.id}`;
}

/** A lesson with no resources at all. */
export function lessonKey(section: Section): string {
  return `lesson:${section.id}`;
}

export function checkpointKey(checkpoint: Checkpoint): string {
  return `checkpoint:${checkpoint.id}`;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

/**
 * A curriculum date is free text — "10/14", "Tue 10/12", "10/12 or 10/13" —
 * with no year. The first month/day in it is the one that counts, placed in
 * the school year `now` falls in: August through July, so a "9/3" read in
 * March is last September and a "3/14" read in October is next March.
 */
export function parseCurriculumDate(text: string | undefined, now: Date): CalendarDay | null {
  const match = (text ?? "").match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const startYear = now.getUTCMonth() + 1 >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return { year: month >= 8 ? startYear : startYear + 1, month, day };
}

function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant a wall-clock time on a day happens in a time zone. */
export function zonedInstant(
  day: CalendarDay,
  time: { hours: number; minutes: number },
  timeZone: string
): Date {
  const wall = Date.UTC(day.year, day.month - 1, day.day, time.hours, time.minutes);
  const first = wall - offsetMs(wall, timeZone);
  // Across a daylight-saving change the offset at the guess can differ from
  // the offset at the answer; one correction settles it.
  const second = wall - offsetMs(first, timeZone);
  return new Date(second);
}

/** Classroom takes a due date and time as separate UTC fields. */
export function toClassroomDue(instant: Date): ClassroomDue {
  return {
    date: {
      year: instant.getUTCFullYear(),
      month: instant.getUTCMonth() + 1,
      day: instant.getUTCDate(),
    },
    time: { hours: instant.getUTCHours(), minutes: instant.getUTCMinutes() },
  };
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

function describe(track: ResourceTrack, step: TrackStep): { description: string; links: string[] } {
  const blocks = track.blocks.filter((b) => b.type === step);
  const lines: string[] = [];
  const links: string[] = [];
  if (track.reference) lines.push(track.reference);
  for (const block of blocks) {
    lines.push(block.description ? `${block.title}: ${block.description}` : block.title);
    for (const a of block.attachments) {
      if (/^https?:\/\//i.test(a.url) && !links.includes(a.url)) links.push(a.url);
    }
  }
  // Classroom allows 20 materials on one item.
  return { description: lines.join("\n"), links: links.slice(0, 20) };
}

/**
 * Where every item should end up. Within each unit items are listed last
 * lesson first, and units last unit first: Classroom puts what was created
 * most recently at the top, so creating in this order leaves the course
 * reading from the first lesson down.
 */
export function plannedItems(input: Omit<PlanInput, "links">): PlannedItem[] {
  const { units, rule, now, timeZone } = input;

  // Undated, or its day has come: posted now. Otherwise scheduled for it.
  const target = (postDay: CalendarDay | null): Target => {
    if (!postDay) return { state: "PUBLISHED" };
    const at = zonedInstant(postDay, POST_AT, timeZone);
    return at.getTime() <= now.getTime() ? { state: "PUBLISHED" } : { state: "SCHEDULED", at: at.toISOString() };
  };

  // Only a due date still ahead: Classroom has no use for one already past.
  const due = (day: CalendarDay | null): ClassroomDue | undefined => {
    if (!day) return undefined;
    const at = zonedInstant(day, DUE_AT, timeZone);
    return at.getTime() > now.getTime() ? toClassroomDue(at) : undefined;
  };

  const items: PlannedItem[] = [];

  for (const unit of [...units].reverse()) {
    const unitStart =
      unit.subunits
        .map((s) => parseCurriculumDate(s.date, now))
        .filter((d): d is CalendarDay => d !== null)
        .sort((a, b) => a.year - b.year || a.month - b.month || a.day - b.day)[0] ?? null;

    const work: PlannedWork[] = [];

    const sectionItems = (section: Section) => {
      const day = parseCurriculumDate(section.date, now);
      const postDay = rule === "unit_start" ? unitStart : day;
      const tracks = section.tracks ?? [];
      const lesson = (key: string, title: string, description: string) =>
        work.push({
          key,
          kind: "assignment",
          topicKey: topicKey(unit),
          title,
          description,
          links: [],
          due: due(day),
          target: target(postDay),
        });

      if (tracks.length === 0) {
        lesson(lessonKey(section), `${section.id} ${section.title}`, "");
        return;
      }
      for (const track of tracks) {
        // Nothing written into this resource yet: the lesson itself, under the
        // Practice key, so filling in Practice later updates it, not a twin.
        if (!track.blocks?.length) {
          lesson(trackKey("practice", track), `${section.id} ${section.title} · ${track.label}`, track.reference ?? "");
          continue;
        }
        for (const step of ["learn", "practice"] as const) {
          if (!track.blocks.some((b) => b.type === step)) continue;
          const { description, links } = describe(track, step);
          work.push({
            key: trackKey(step, track),
            kind: step === "learn" ? "material" : "assignment",
            topicKey: topicKey(unit),
            title: `${section.id} ${section.title} · ${track.label} (${step === "learn" ? "Learn" : "Practice"})`,
            description,
            links,
            due: step === "practice" ? due(day) : undefined,
            target: target(postDay),
          });
        }
      }
    };

    const checkpointItem = (checkpoint: Checkpoint) => {
      const day = parseCurriculumDate(checkpoint.date, now);
      work.push({
        key: checkpointKey(checkpoint),
        kind: "assignment",
        topicKey: topicKey(unit),
        title: checkpoint.title,
        description: checkpoint.note ?? "",
        links: [],
        maxPoints: checkpoint.maxPoints ?? 100,
        due: due(day),
        target: target(rule === "unit_start" ? unitStart : day),
      });
    };

    // Course order: checkpoints pinned to the top, then each section followed
    // by the checkpoints that sit after it.
    unit.checkpoints.filter((c) => c.afterSectionId === null).forEach(checkpointItem);
    for (const section of unit.subunits) {
      sectionItems(section);
      unit.checkpoints.filter((c) => c.afterSectionId === section.id).forEach(checkpointItem);
    }

    if (work.length === 0) continue;
    items.push({ key: topicKey(unit), kind: "topic", name: unit.title });
    items.push(...work.reverse());
  }

  // Topics first (newest-created on top: reversed above), then their work.
  return [...items.filter((i) => i.kind === "topic"), ...items.filter((i) => i.kind !== "topic")];
}

function sameTarget(link: ClassroomLink, target: Target): boolean {
  if (target.state === "SCHEDULED") {
    return link.state === "SCHEDULED" && link.scheduledFor !== null &&
      new Date(link.scheduledFor).getTime() === new Date(target.at).getTime();
  }
  return link.state === target.state;
}

/**
 * The calls to make. New items are created. An item already in Classroom is
 * only ever moved forward: a draft or scheduled post gets its new state or
 * date (the rule changed, or its time has come). A published item is left alone —
 * Classroom cannot un-publish — and one the teacher deleted in Classroom
 * (GONE) is never recreated, because Classroom wins (ADR-008).
 */
export function planSync(input: PlanInput): SyncOp[] {
  const links = new Map(input.links.map((l) => [l.itemKey, l]));
  const ops: SyncOp[] = [];
  for (const item of plannedItems(input)) {
    const link = links.get(item.key);
    if (!link) {
      ops.push({ type: "create", item });
      continue;
    }
    if (item.kind === "topic") continue;
    if (link.state === "PUBLISHED" || link.state === "GONE") continue;
    if (!sameTarget(link, item.target)) ops.push({ type: "update", item, link });
  }
  return ops;
}

// ---------------------------------------------------------------------------
// Tidying: what Classroom has that the links do not know about
// ---------------------------------------------------------------------------

/** An item in the course that this app made, as Classroom lists it. */
export interface OwnWork {
  id: string;
  kind: "material" | "assignment";
  title: string;
  topicId?: string;
  state: "PUBLISHED" | "SCHEDULED" | "DRAFT";
  scheduledFor: string | null;
}

export interface Tidy {
  /** Made by us, never recorded (a save that failed): record it, don't post it again. */
  adopt: { item: PlannedWork; own: OwnWork }[];
  /** A second copy of something already recorded — two posts that ran at once. */
  remove: OwnWork[];
}

/**
 * Squares Classroom with the links before anything is planned. Only items this
 * app made are ever considered, and an untracked one is only removed when it
 * is an exact twin (same title, same topic) of one that is tracked; anything
 * else unrecognised is left exactly where it is.
 */
export function tidy(
  own: OwnWork[],
  links: ClassroomLink[],
  planned: PlannedItem[],
  topicIds: Map<string, string>
): Tidy {
  const linked = new Set(links.map((l) => l.classroomId));
  const twin = (title: string, topicId: string | undefined) => JSON.stringify([title, topicId ?? ""]);

  const tracked = new Set(own.filter((o) => linked.has(o.id)).map((o) => twin(o.title, o.topicId)));
  const linkedKeys = new Set(links.map((l) => l.itemKey));
  const waiting = new Map<string, PlannedWork>();
  for (const item of planned) {
    if (item.kind === "topic" || linkedKeys.has(item.key)) continue;
    waiting.set(twin(item.title, topicIds.get(item.topicKey)), item);
  }

  const result: Tidy = { adopt: [], remove: [] };
  for (const o of own) {
    if (linked.has(o.id)) continue;
    const key = twin(o.title, o.topicId);
    if (tracked.has(key)) {
      result.remove.push(o);
      continue;
    }
    const item = waiting.get(key);
    if (item && item.kind === o.kind) {
      result.adopt.push({ item, own: o });
      waiting.delete(key);
      tracked.add(key);
    }
  }
  return result;
}
