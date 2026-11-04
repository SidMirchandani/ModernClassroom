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
 *
 * Sync runs both ways (ADR-012). A link remembers what the curriculum said when
 * it last reached Classroom (`sent`) and what Classroom last said (`classroom`).
 * The curriculum differing from `sent` is an edit here, and is sent. Classroom
 * differing is an edit there, and is left alone, so a teacher's change in
 * Classroom survives until the curriculum changes that same thing.
 */

export type PostingRule = "lesson_day" | "unit_start";

export const POSTING_RULES: PostingRule[] = ["lesson_day", "unit_start"];

export type ItemKind = "topic" | "material" | "assignment";

/** DRAFT = unpublished, no date. SCHEDULED = Classroom publishes it at `at`. */
export type Target =
  | { state: "PUBLISHED" }
  | { state: "SCHEDULED"; at: string }
  | { state: "DRAFT" };

/** KEPT: dropped from the curriculum, but students have work on it, so it stays. */
export type LinkState = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "GONE" | "KEPT";

/** The parts of an item either side can change. Times are ISO instants. */
export interface ItemFields {
  title: string;
  description?: string;
  due?: string | null;
  postAt?: string | null;
  maxPoints?: number;
}

export interface ClassroomLink {
  itemKey: string;
  /** "external" is work the teacher posted by hand: read, never touched. */
  kind: ItemKind | "external";
  classroomId: string;
  state: LinkState;
  scheduledFor: string | null;
  sent?: ItemFields | null;
  classroom?: ItemFields | null;
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
  /** When it is meant to appear, whether or not that has passed. */
  postAt: string | null;
}

export type PlannedItem = PlannedTopic | PlannedWork;

export type WorkField = "title" | "description" | "due" | "state" | "points";

export type SyncOp =
  | { type: "create"; item: PlannedItem }
  | { type: "update"; item: PlannedWork; link: ClassroomLink; fields: WorkField[] }
  | { type: "rename"; item: PlannedTopic; link: ClassroomLink };

export interface PlanInput {
  units: CurriculumUnit[];
  rule: PostingRule;
  links: ClassroomLink[];
  now: Date;
  timeZone: string;
}

/** Every assignment is graded (ADR-011). A teacher's own total comes from Classroom. */
const DEFAULT_POINTS = 100;

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

/** A Classroom due date as one instant, the form both sides are compared in. */
export function dueInstant(due: ClassroomDue | undefined): string | null {
  if (!due) return null;
  const { date, time } = due;
  return new Date(Date.UTC(date.year, date.month - 1, date.day, time.hours, time.minutes)).toISOString();
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
  const postAt = (postDay: CalendarDay | null): string | null =>
    postDay ? zonedInstant(postDay, POST_AT, timeZone).toISOString() : null;

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
          maxPoints: DEFAULT_POINTS,
          due: due(day),
          target: target(postDay),
          postAt: postAt(postDay),
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
            maxPoints: step === "practice" ? DEFAULT_POINTS : undefined,
            due: step === "practice" ? due(day) : undefined,
            target: target(postDay),
            postAt: postAt(postDay),
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
        maxPoints: checkpoint.maxPoints ?? DEFAULT_POINTS,
        due: due(day),
        target: target(rule === "unit_start" ? unitStart : day),
        postAt: postAt(rule === "unit_start" ? unitStart : day),
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

/** What the curriculum currently says about an item. */
export function plannedFields(item: PlannedItem): ItemFields {
  if (item.kind === "topic") return { title: item.name };
  return {
    title: item.title,
    description: item.description.trim(),
    due: dueInstant(item.due),
    postAt: item.postAt,
    maxPoints: item.maxPoints,
  };
}

/** What an existing work item needs sent, judged against what was last sent. */
function workChanges(item: PlannedWork, link: ClassroomLink, now: Date): WorkField[] {
  const sent = link.sent;
  // Made before links remembered this: only its state and schedule can be judged.
  if (!sent) return !sameTarget(link, item.target) && link.state !== "PUBLISHED" ? ["state"] : [];

  const fields: WorkField[] = [];
  const wanted = plannedFields(item);
  if (wanted.title !== sent.title) fields.push("title");
  if (wanted.description !== (sent.description ?? "")) fields.push("description");
  // Also how items posted before everything was graded get a total, once.
  if (wanted.maxPoints !== undefined && wanted.maxPoints !== sent.maxPoints) fields.push("points");

  // A due date already past is simply not sent, which isn't a change. It only
  // needs clearing if the one Classroom has is still ahead.
  const sentDue = sent.due ?? null;
  if (wanted.due ? wanted.due !== sentDue : sentDue !== null && new Date(sentDue).getTime() > now.getTime()) {
    fields.push("due");
  }

  // Classroom cannot un-publish. Otherwise only a changed date moves it, so a
  // teacher's own reschedule in Classroom stays where they put it.
  if (link.state !== "PUBLISHED" && (wanted.postAt ?? null) !== (sent.postAt ?? null)) fields.push("state");
  return fields;
}

/**
 * The calls to make. New items are created, and an edit to the curriculum is
 * sent to the item it changed. One the teacher deleted in Classroom (GONE) is
 * never recreated, and one left over from the curriculum is `removals`' to
 * deal with, because Classroom wins (ADR-008).
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
    if (link.state === "GONE") continue;
    if (item.kind === "topic") {
      if (link.sent && link.sent.title !== item.name) ops.push({ type: "rename", item, link });
      continue;
    }
    const fields = workChanges(item, link, input.now);
    if (fields.length) ops.push({ type: "update", item, link, fields });
  }
  return ops;
}

/**
 * What to remember as sent after an update. A due date that wasn't part of it
 * stays as it was: the plan stops mentioning one once it has passed, and a
 * teacher may have moved it in Classroom, and neither should look like a change.
 */
export function sentAfter(item: PlannedItem, link: ClassroomLink, fields: WorkField[]): ItemFields {
  const wanted = plannedFields(item);
  return fields.includes("due") || !link.sent ? wanted : { ...wanted, due: link.sent.due ?? null };
}

/**
 * Links from before `sent` existed, and what to record so edits count from here
 * on. A due date the plan no longer mentions has passed, so what Classroom has
 * is the same date rather than an edit.
 */
export function baselines(planned: PlannedItem[], links: ClassroomLink[]): ClassroomLink[] {
  const byKey = new Map(links.map((l) => [l.itemKey, l]));
  const out: ClassroomLink[] = [];
  for (const item of planned) {
    const link = byKey.get(item.key);
    if (!link || link.sent) continue;
    const sent = plannedFields(item);
    if (item.kind !== "topic" && !sent.due && link.classroom?.due) sent.due = link.classroom.due;
    out.push({ ...link, sent });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Coming back: what Classroom says now
// ---------------------------------------------------------------------------

/** The same moment, however it was written: Postgres and Google spell them differently. */
function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return (a ?? null) === (b ?? null);
  return new Date(a).getTime() === new Date(b).getTime();
}

function sameFields(a: ItemFields | null | undefined, b: ItemFields | null | undefined): boolean {
  if (!a || !b) return (a ?? null) === (b ?? null);
  return (
    a.title === b.title &&
    (a.description ?? "") === (b.description ?? "") &&
    (a.maxPoints ?? null) === (b.maxPoints ?? null) &&
    sameInstant(a.due, b.due) &&
    sameInstant(a.postAt, b.postAt)
  );
}

function sameLink(a: ClassroomLink, b: ClassroomLink): boolean {
  return a.state === b.state && sameInstant(a.scheduledFor, b.scheduledFor) && sameFields(a.classroom, b.classroom);
}

/**
 * Squares the links with Classroom: a teacher's edit is recorded, what was
 * published or moved takes its new state, and what is no longer there is GONE.
 * Returns only the links that changed.
 *
 * An empty answer for a class with items is not believed. A whole class being
 * deleted is far less likely than a wrong answer, and believing it would stop
 * the class syncing.
 */
export function absorb(
  links: ClassroomLink[],
  own: OwnWork[],
  topics: { id: string; name: string }[],
  plannedKeys: Set<string>
): ClassroomLink[] {
  const work = new Map(own.map((o) => [o.id, o]));
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const believeWork = own.length > 0;
  const believeTopics = topics.length > 0;

  const changed: ClassroomLink[] = [];
  for (const link of links) {
    if (link.kind === "external") continue;
    let next: ClassroomLink = link;
    if (link.kind === "topic") {
      const topic = topicById.get(link.classroomId);
      if (topic) next = { ...link, state: "PUBLISHED", classroom: { title: topic.name } };
      else if (believeTopics) next = { ...link, state: "GONE" };
    } else {
      const found = work.get(link.classroomId);
      if (found) {
        next = {
          ...link,
          state: link.state === "KEPT" && !plannedKeys.has(link.itemKey) ? "KEPT" : found.state,
          scheduledFor: found.scheduledFor,
          classroom: {
            title: found.title,
            description: (found.description ?? "").trim(),
            due: found.due ?? null,
            postAt: found.scheduledFor,
            maxPoints: found.maxPoints,
          },
        };
      } else if (believeWork) {
        next = { ...link, state: "GONE", scheduledFor: null };
      }
    }
    if (!sameLink(next, link)) changed.push(next);
  }
  return changed;
}

/** "3.2 Slope · Textbook (Learn)" and "3.3 Slope · Textbook (Learn)" are one lesson renumbered. */
function withoutNumber(title: string): string {
  return title.replace(/^\d+(\.\d+)*\s+/, "").trim();
}

/**
 * Lessons renumbered in an upload get new keys. Without this they would look
 * removed and re-added, and a student's work would stay on the old copy. Only
 * an unambiguous match moves: one left-over link, one new item, same words.
 */
export function rekeys(links: ClassroomLink[], planned: PlannedItem[]): { from: string; to: string }[] {
  const plannedKeys = new Set(planned.map((p) => p.key));
  const linkKeys = new Set(links.map((l) => l.itemKey));
  const group = <T,>(items: T[], keyOf: (item: T) => string) => {
    const map = new Map<string, T[]>();
    for (const item of items) map.set(keyOf(item), [...(map.get(keyOf(item)) ?? []), item]);
    return map;
  };
  const leftOver = group(
    links.filter(
      (l) =>
        !plannedKeys.has(l.itemKey) &&
        (l.kind === "assignment" || l.kind === "material") &&
        l.state !== "GONE" &&
        l.sent
    ),
    (l) => `${l.kind} ${withoutNumber(l.sent!.title)}`
  );
  const incoming = group(
    planned.filter((p): p is PlannedWork => p.kind !== "topic" && !linkKeys.has(p.key)),
    (p) => `${p.kind} ${withoutNumber(p.title)}`
  );
  const moves: { from: string; to: string }[] = [];
  for (const [key, from] of leftOver) {
    const to = incoming.get(key);
    if (from.length === 1 && to?.length === 1) moves.push({ from: from[0].itemKey, to: to[0].key });
  }
  return moves;
}

export interface Removals {
  /** In Classroom but dropped from the curriculum. */
  work: ClassroomLink[];
  topics: ClassroomLink[];
  /** Records of things already gone. */
  forget: ClassroomLink[];
}

/**
 * What the curriculum no longer has. An empty plan removes nothing: a class
 * with no units at all is more likely a mistake than a decision.
 */
export function removals(links: ClassroomLink[], planned: PlannedItem[]): Removals {
  const result: Removals = { work: [], topics: [], forget: [] };
  if (planned.length === 0) return result;
  const keys = new Set(planned.map((p) => p.key));
  for (const link of links) {
    if (keys.has(link.itemKey) || link.kind === "external") continue;
    if (link.state === "GONE") result.forget.push(link);
    else if (link.kind === "topic") result.topics.push(link);
    else if (link.state !== "KEPT") result.work.push(link);
  }
  return result;
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
  description?: string;
  due?: string | null;
  maxPoints?: number;
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
