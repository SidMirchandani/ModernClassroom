import type { CurriculumUnit } from "./db/types";
import type { SectionRemap } from "./store/types";
import type { Section } from "./types";
import {
  applyChanges,
  buildChangeSet,
  conformToClass,
  type CurriculumProposal,
  type ProposedSection,
  type ProposedTrack,
} from "./curriculum-diff";
import { getTracks } from "./section-tracks";

/**
 * The curriculum edits a teacher makes by hand — add a subunit, move dates,
 * remove one — done in code, with no AI. They used to be things to ask the
 * chat for; most of what the chat did for them was this code anyway.
 *
 * Inserting goes through the import's own diff engine (`buildChangeSet` /
 * `applyChanges`), so a subunit that pushes the ones after it along is a
 * renumber with remaps, and every student's work moves with its section.
 */

// ── dates ───────────────────────────────────────────────────────────────────

/** The calendar year a school year starts in: August–December belong to it, January–July to the next. */
export function schoolYearStart(today: Date = new Date()): number {
  return today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
}

/** "10/12" as a real date in the school year — months before August are the spring. */
function dateIn(month: number, day: number, startYear: number): Date {
  return new Date(month >= 8 ? startYear : startYear + 1, month - 1, day);
}

/** Moves a date by school days, Monday to Friday, skipping weekends. */
function addSchoolDays(date: Date, days: number): Date {
  const out = new Date(date);
  const step = days < 0 ? -1 : 1;
  let left = Math.abs(days);
  while (left > 0) {
    out.setDate(out.getDate() + step);
    const weekday = out.getDay();
    if (weekday !== 0 && weekday !== 6) left--;
  }
  return out;
}

/**
 * Every date in a free-text date moved by school days: "10/12" → "10/13",
 * "Fri 10/16" → "Mon 10/19" (a weekday name is moved with it), "10/12 or
 * 10/13" and "10/12–10/14" move whole. Text that holds no date is returned as
 * it was.
 */
export function shiftDateText(text: string, days: number, today: Date = new Date()): string {
  if (!text || days === 0) return text;
  const start = schoolYearStart(today);
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return text.replace(
    /\b(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*\.?\s+)?(\d{1,2})\/(\d{1,2})\b/g,
    (whole, weekday: string | undefined, m: string, d: string) => {
      const month = Number(m);
      const day = Number(d);
      if (month < 1 || month > 12 || day < 1 || day > 31) return whole;
      const moved = addSchoolDays(dateIn(month, day, start), days);
      const date = `${moved.getMonth() + 1}/${moved.getDate()}`;
      return weekday ? `${names[moved.getDay()]} ${date}` : date;
    }
  );
}

/** Moves one subunit's date. */
export function shiftSubunit(units: CurriculumUnit[], sectionId: string, days: number): CurriculumUnit[] {
  return units.map((unit) => ({
    ...unit,
    subunits: unit.subunits.map((s) =>
      s.id === sectionId && s.date ? { ...s, date: shiftDateText(s.date, days) } : s
    ),
  }));
}

/** Moves every date in a unit — its subunits and its quizzes and tests — together. */
export function shiftUnit(units: CurriculumUnit[], unitId: string, days: number): CurriculumUnit[] {
  return units.map((unit) =>
    unit.id !== unitId
      ? unit
      : {
          ...unit,
          subunits: unit.subunits.map((s) => (s.date ? { ...s, date: shiftDateText(s.date, days) } : s)),
          checkpoints: (unit.checkpoints ?? []).map((c) =>
            c.date ? { ...c, date: shiftDateText(c.date, days) } : c
          ),
        }
  );
}

// ── references ──────────────────────────────────────────────────────────────

/**
 * The reference a resource gives the next subunit, when its references run
 * in step: "Ch 12.5", "Ch 12.6" → "Ch 12.7"; "Unit 12 Lesson 6" → "Unit 12
 * Lesson 7". A resource whose references are just the subunits' own titles
 * (an activity named after its lesson) gets the new title. Anything else —
 * a gap, a jump, no pattern — gets nothing: a guessed reference that is
 * wrong is worse than an empty one the teacher fills in.
 */
export function nextReference(refs: string[], titles: string[], newTitle: string): string | null {
  const known = refs.map((r) => r.trim());
  if (known.length === 0 || known.every((r) => r === "")) return null;
  if (known.every((r, i) => r === "" || r === titles[i]?.trim())) return newTitle;

  const tail = known.filter(Boolean).slice(-2);
  const parse = (r: string) => r.match(/^(.*?)(\d+)$/);
  const last = parse(tail[tail.length - 1]);
  if (!last) return null;
  if (tail.length === 2) {
    const before = parse(tail[0]);
    if (!before || before[1] !== last[1] || Number(before[2]) + 1 !== Number(last[2])) return null;
  }
  return `${last[1]}${Number(last[2]) + 1}`;
}

// ── adding and removing ─────────────────────────────────────────────────────

function sectionNumberParts(id: string): { unit: string; n: number } | null {
  const match = id.match(/^(\d+)\.(\d+)$/);
  return match ? { unit: match[1], n: Number(match[2]) } : null;
}

/** The school day after a subunit's date, as a default for the one after it. */
function dayAfter(date: string | undefined): string {
  const first = date?.match(/\d{1,2}\/\d{1,2}/)?.[0];
  return first ? shiftDateText(first, 1) : "";
}

/**
 * A new subunit after `afterId` — or at the start of the unit, with null —
 * numbered in sequence, with the subunits after it renumbered along (and the
 * work under them moved with them). It gets every resource its neighbours
 * have, the next reference where they run in step, and Learn and Practice
 * where the unit writes them to a pattern.
 */
export function insertSubunit(
  units: CurriculumUnit[],
  unitId: string,
  afterId: string | null,
  fields: { title: string; date?: string }
): { units: CurriculumUnit[]; remaps: SectionRemap[]; id: string } | null {
  const unit = units.find((u) => u.id === unitId);
  if (!unit) return null;
  const at = afterId === null ? -1 : unit.subunits.findIndex((s) => s.id === afterId);
  if (afterId !== null && at < 0) return null;

  const parts = unit.subunits.map((s) => sectionNumberParts(s.id));
  const unitNumber =
    parts.find(Boolean)?.unit ?? String(units.findIndex((u) => u.id === unitId) + 1);
  // Numbered in sequence only when the unit is: 10.1, 10.2, … with no gaps.
  // Otherwise (after a removal, say) it takes the next number after the
  // highest, never one already in use.
  const sequential = parts.every((p, i) => p !== null && p.unit === unitNumber && p.n === i + 1);
  const highest = Math.max(0, ...parts.map((p) => (p && p.unit === unitNumber ? p.n : 0)));
  const newNumber = sequential ? `${unitNumber}.${at + 2}` : `${unitNumber}.${highest + 1}`;

  const before = unit.subunits.slice(0, at + 1);
  const title = fields.title.trim() || "New subunit";

  // Every resource the unit's subunits carry, in the order they first appear.
  const tracks: ProposedTrack[] = [];
  for (const section of unit.subunits) {
    for (const track of getTracks(section)) {
      if (tracks.some((t) => t.kind === track.kind && (t.label ?? "") === track.label)) continue;
      const refOf = (s: Section) =>
        getTracks(s).find((t) => t.kind === track.kind && t.label === track.label)?.reference ?? "";
      const next = nextReference(before.map(refOf), before.map((s) => s.title), title);
      // In the middle of a sequence, "the next one" already belongs to the
      // lesson being pushed along — the resource has no number for this one.
      const taken = next !== null && unit.subunits.slice(at + 1).some((s) => refOf(s).trim() === next);
      tracks.push({ kind: track.kind, label: track.label, reference: taken ? null : next });
    }
  }

  const fresh: ProposedSection = {
    number: newNumber,
    title,
    date: fields.date?.trim() || dayAfter(before[before.length - 1]?.date) || null,
    tracks,
  };
  const sections: ProposedSection[] = unit.subunits.map((s: Section, i) => ({
    existingId: s.id,
    number: sequential && i > at ? `${unitNumber}.${i + 2}` : s.id,
    title: s.title,
  }));
  sections.splice(at + 1, 0, fresh);

  // Checkpoints are left out on purpose: a unit with none in the proposal
  // keeps its own, anchored to wherever their sections end up.
  const proposal: CurriculumProposal = {
    units: [{ existingId: unit.id, number: unitNumber, title: unit.title, sections, checkpoints: [] }],
  };
  const shaped = conformToClass(proposal, units, (section) => section === fresh);
  const set = buildChangeSet(units, shaped);
  const result = applyChanges(units, set, new Set(set.changes.map((c) => c.id)));
  return { ...result, id: newNumber };
}

/**
 * Takes a subunit out. Its quizzes and tests are not taken with it: they
 * move to the subunit before it (or the start of the unit). A unit left with
 * no subunits goes too. The work students did under it stays filed.
 */
export function removeSubunit(units: CurriculumUnit[], sectionId: string): CurriculumUnit[] {
  return units
    .map((unit) => {
      const at = unit.subunits.findIndex((s) => s.id === sectionId);
      if (at < 0) return unit;
      const previous = unit.subunits[at - 1]?.id ?? null;
      return {
        ...unit,
        subunits: unit.subunits.filter((s) => s.id !== sectionId),
        checkpoints: (unit.checkpoints ?? []).map((c) =>
          c.afterSectionId === sectionId ? { ...c, afterSectionId: previous } : c
        ),
      };
    })
    .filter((unit) => unit.subunits.length > 0);
}
