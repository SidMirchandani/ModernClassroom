import { v4 as uuidv4 } from "uuid";
import type { CurriculumUnit } from "./db/types";
import type { SectionRemap } from "./store/types";
import type {
  Checkpoint,
  CheckpointKind,
  ResourceTrack,
  Section,
  TrackKind,
} from "./types";
import {
  TRACK_KIND_LABELS,
  getTracks,
  normalizeSection,
  stableTrackId,
} from "./section-tracks";

/**
 * Turning a teacher's spreadsheet into a curriculum, without losing the one
 * thing the app is for.
 *
 * Every piece of student work is filed under a section id — and a section id
 * is its number, "3.4". So a proposal that renumbers a section is asking to
 * move a filing cabinet, and a proposal that fails to recognise a section it
 * already has is asking to throw one away. That is why matching happens here,
 * deliberately and in the open, rather than falling out of whatever order the
 * model happened to answer in.
 *
 * Two rules the rest of the file exists to keep:
 *
 *   1. A matched section keeps its own `tracks[]` objects, ids and all. Track
 *      ids are opaque keys into progress; re-deriving one from a new number
 *      would orphan every mark filed under it.
 *   2. Silence is not a change. If the proposal has no date for a section, the
 *      existing date stands. Only substance the teacher can see gets offered.
 */

// ── what the model is asked for ────────────────────────────────────────────

export interface ProposedTrack {
  kind: TrackKind;
  label?: string | null;
  reference?: string | null;
}

export interface ProposedSection {
  /** The id of the section this replaces, when the model recognised one. */
  existingId?: string | null;
  /** The section's number, which becomes its id: "3.4". */
  number: string;
  title: string;
  date?: string | null;
  objectives?: string[] | null;
  tracks?: ProposedTrack[] | null;
}

export interface ProposedCheckpoint {
  existingId?: string | null;
  kind: CheckpointKind;
  title: string;
  date?: string | null;
  /** The number of the section it sits after; null pins it to the top. */
  afterSectionNumber?: string | null;
  note?: string | null;
}

export interface ProposedUnit {
  existingId?: string | null;
  title: string;
  sections: ProposedSection[];
  checkpoints?: ProposedCheckpoint[] | null;
}

export interface CurriculumProposal {
  units: ProposedUnit[];
  /** Anything the model wants the teacher to know, shown above the diff. */
  notes?: string[] | null;
}

// ── what comes back ────────────────────────────────────────────────────────

export type ChangeKind =
  | "unit-add"
  | "unit-remove"
  | "unit-title"
  | "section-add"
  | "section-remove"
  | "section-renumber"
  | "section-title"
  | "section-date"
  | "section-objectives"
  | "track-reference"
  | "track-add"
  | "checkpoint-add"
  | "checkpoint-remove"
  | "checkpoint-field";

export interface Change {
  /** Deterministic, so approving is a set of ids and applying can re-derive them. */
  id: string;
  kind: ChangeKind;
  unitKey: string;
  sectionKey?: string;
  checkpointKey?: string;
  /** The cell's name — "Date", "Textbook reference". */
  field: string;
  /** Where it sits, for a one-line summary: "Unit 3 · 3.4". */
  where: string;
  before: string | null;
  after: string | null;
  /** True where approving loses something a student may have worked under. */
  destructive?: boolean;
}

export interface PlannedTrack {
  kind: TrackKind;
  label: string;
  existing: ResourceTrack | null;
  proposed: ProposedTrack | null;
}

export interface PlannedSection {
  key: string;
  existing: Section | null;
  proposed: ProposedSection | null;
  tracks: PlannedTrack[];
}

export interface PlannedCheckpoint {
  key: string;
  existing: Checkpoint | null;
  proposed: ProposedCheckpoint | null;
}

export interface PlannedUnit {
  key: string;
  existing: CurriculumUnit | null;
  proposed: ProposedUnit | null;
  sections: PlannedSection[];
  checkpoints: PlannedCheckpoint[];
}

export interface MergePlan {
  units: PlannedUnit[];
}

export interface ChangeSet {
  changes: Change[];
  plan: MergePlan;
}

// ── normalising ────────────────────────────────────────────────────────────

/** Whitespace is never the substance of a change. */
function norm(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function key(value: string | null | undefined): string {
  return norm(value).toLowerCase();
}

/** "10 / 12" and "10/12" are the same date written twice. */
function normDate(value: string | null | undefined): string {
  return norm(value).replace(/\s*([/\-–])\s*/g, "$1");
}

function objectivesText(list: { text: string }[] | null | undefined): string {
  return (list ?? [])
    .map((o) => norm(o.text))
    .filter(Boolean)
    .join("\n");
}

function proposedObjectivesText(list: string[] | null | undefined): string {
  return (list ?? [])
    .map(norm)
    .filter(Boolean)
    .join("\n");
}

/** A custom resource is identified by its name; the fixed kinds by kind alone. */
function trackKey(kind: TrackKind, label?: string | null): string {
  return kind === "custom" ? `custom:${key(label)}` : kind;
}

function changeId(
  kind: ChangeKind,
  unitKey: string,
  childKey: string,
  field: string
): string {
  return `${kind}|${unitKey}|${childKey}|${field}`;
}

// ── matching ───────────────────────────────────────────────────────────────

/**
 * Put back everything the proposal did not mention, roughly where it was.
 * A section the model failed to see is a removal the teacher has to approve,
 * not one that quietly happens, so it has to stay visible in the table.
 */
function weave<E, P extends { existing: E | null }>(
  planned: P[],
  existing: E[],
  leftover: (item: E) => P
): P[] {
  const out = [...planned];
  existing.forEach((item, index) => {
    if (out.some((p) => p.existing === item)) return;
    let at = 0;
    for (let j = index - 1; j >= 0; j--) {
      const found = out.findIndex((p) => p.existing === existing[j]);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    out.splice(at, 0, leftover(item));
  });
  return out;
}

function planTracks(
  existing: Section | null,
  proposed: ProposedSection | null
): PlannedTrack[] {
  const out: PlannedTrack[] = (existing ? getTracks(existing) : []).map((track) => ({
    kind: track.kind,
    label: track.label,
    existing: track,
    proposed: null,
  }));

  for (const track of proposed?.tracks ?? []) {
    const wanted = trackKey(track.kind, track.label);
    const slot = out.findIndex(
      (o) =>
        o.existing !== null &&
        o.proposed === null &&
        trackKey(o.existing.kind, o.existing.label) === wanted
    );
    if (slot >= 0) {
      out[slot] = { ...out[slot], proposed: track };
    } else {
      out.push({
        kind: track.kind,
        label: norm(track.label) || TRACK_KIND_LABELS[track.kind],
        existing: null,
        proposed: track,
      });
    }
  }

  return out;
}

/**
 * Which proposed item is which existing one, decided by strength of evidence
 * rather than by reading order. Every explicit id is honoured first, across
 * the whole list, then every exact title, then numbers — otherwise a new "3.3"
 * appearing above the old one would claim it before its own id was ever read,
 * and the section that really moved would look like a deletion.
 */
function matchAll<P, E>(
  proposed: P[],
  existing: E[],
  idOf: (item: E) => string,
  rules: ((item: P, pool: Map<string, E>) => E | undefined)[]
): Map<number, E> {
  const pool = new Map(existing.map((item) => [idOf(item), item]));
  const matched = new Map<number, E>();

  for (const rule of rules) {
    proposed.forEach((item, index) => {
      if (matched.has(index)) return;
      const hit = rule(item, pool);
      if (!hit) return;
      pool.delete(idOf(hit));
      matched.set(index, hit);
    });
  }

  return matched;
}

function byTitle<E extends { title: string }>(title: string) {
  return (pool: Map<string, E>): E | undefined => {
    if (!key(title)) return undefined;
    return [...pool.values()].find((item) => key(item.title) === key(title));
  };
}

function planSections(
  unit: CurriculumUnit | null,
  proposed: ProposedUnit | null,
  unitKey: string
): PlannedSection[] {
  const existing = unit?.subunits ?? [];

  if (!proposed) {
    return existing.map((section) => ({
      key: section.id,
      existing: section,
      proposed: null,
      tracks: planTracks(section, null),
    }));
  }

  const matched = matchAll<ProposedSection, Section>(
    proposed.sections,
    existing,
    (s) => s.id,
    [
      // The id the model was handed back, when it is real and still free.
      (ps, pool) => (ps.existingId ? pool.get(ps.existingId) : undefined),
      // A title that reads the same is the same section, whatever its number —
      // this is what survives an insertion that shifts everything below it.
      (ps, pool) => byTitle<Section>(ps.title)(pool),
      // Failing that, the number. A retitled section keeps its place.
      (ps, pool) => (norm(ps.number) ? pool.get(norm(ps.number)) : undefined),
    ]
  );

  const planned: PlannedSection[] = proposed.sections.map((ps, index) => {
    const match = matched.get(index) ?? null;
    return {
      key: match ? match.id : `new:${unitKey}:${index}`,
      existing: match,
      proposed: ps,
      tracks: planTracks(match, ps),
    };
  });

  return weave(planned, existing, (section) => ({
    key: section.id,
    existing: section,
    proposed: null,
    tracks: planTracks(section, null),
  }));
}

function planCheckpoints(
  unit: CurriculumUnit | null,
  proposed: ProposedUnit | null,
  unitKey: string
): PlannedCheckpoint[] {
  const existing = unit?.checkpoints ?? [];

  if (!proposed) {
    return existing.map((c) => ({ key: c.id, existing: c, proposed: null }));
  }

  const wanted = proposed.checkpoints ?? [];
  const matched = matchAll<ProposedCheckpoint, Checkpoint>(
    wanted,
    existing,
    (c) => c.id,
    [
      (pc, pool) => (pc.existingId ? pool.get(pc.existingId) : undefined),
      (pc, pool) => byTitle<Checkpoint>(pc.title)(pool),
    ]
  );

  const planned: PlannedCheckpoint[] = wanted.map((pc, index) => {
    const match = matched.get(index) ?? null;
    return {
      key: match ? match.id : `new:${unitKey}:cp:${index}`,
      existing: match,
      proposed: pc,
    };
  });

  return weave(planned, existing, (c) => ({ key: c.id, existing: c, proposed: null }));
}

function planUnits(current: CurriculumUnit[], proposal: CurriculumProposal): MergePlan {
  const matched = matchAll<ProposedUnit, CurriculumUnit>(
    proposal.units,
    current,
    (u) => u.id,
    [
      (pu, pool) => (pu.existingId ? pool.get(pu.existingId) : undefined),
      (pu, pool) => byTitle<CurriculumUnit>(pu.title)(pool),
    ]
  );

  const planned: PlannedUnit[] = proposal.units.map((pu, index) => {
    const match = matched.get(index) ?? null;
    const unitKey = match ? match.id : `new:${index}`;
    return {
      key: unitKey,
      existing: match,
      proposed: pu,
      sections: planSections(match, pu, unitKey),
      checkpoints: planCheckpoints(match, pu, unitKey),
    };
  });

  const units = weave(planned, current, (unit) => ({
    key: unit.id,
    existing: unit,
    proposed: null,
    sections: planSections(unit, null, unit.id),
    checkpoints: planCheckpoints(unit, null, unit.id),
  }));

  return { units };
}

// ── the change set ─────────────────────────────────────────────────────────

/**
 * What the proposal would actually do, one approvable cell at a time. A field
 * the proposal left blank produces nothing: the teacher's existing wording
 * stands unless the model has something to put in its place.
 */
export function buildChangeSet(
  current: CurriculumUnit[],
  proposal: CurriculumProposal
): ChangeSet {
  const plan = planUnits(current, proposal);
  const changes: Change[] = [];

  const push = (change: Change) => {
    if (change.before === change.after) return;
    changes.push(change);
  };

  for (const unit of plan.units) {
    const unitName = unit.existing?.title ?? unit.proposed?.title ?? "Unit";

    if (!unit.existing && unit.proposed) {
      changes.push({
        id: changeId("unit-add", unit.key, "", "unit"),
        kind: "unit-add",
        unitKey: unit.key,
        field: "Unit",
        where: unit.proposed.title,
        before: null,
        after: `${unit.proposed.title} — ${unit.proposed.sections.length} subunits`,
      });
      continue;
    }

    // A unit the files never mention is simply not under discussion. It is
    // carried through untouched and offers nothing to approve — a teacher
    // importing one term's sheet is not proposing to delete the rest of the
    // year, and a model that overlooked a unit must not be able to either.
    if (unit.existing && !unit.proposed) continue;

    if (!unit.existing || !unit.proposed) continue;

    if (norm(unit.proposed.title)) {
      push({
        id: changeId("unit-title", unit.key, "", "title"),
        kind: "unit-title",
        unitKey: unit.key,
        field: "Unit title",
        where: unitName,
        before: norm(unit.existing.title),
        after: norm(unit.proposed.title),
      });
    }

    for (const section of unit.sections) {
      const { existing, proposed } = section;

      if (!existing && proposed) {
        changes.push({
          id: changeId("section-add", unit.key, section.key, "section"),
          kind: "section-add",
          unitKey: unit.key,
          sectionKey: section.key,
          field: "New subunit",
          where: `${unitName} · ${norm(proposed.number)}`,
          before: null,
          after: `${norm(proposed.number)} ${norm(proposed.title)}`,
        });
        continue;
      }

      if (existing && !proposed) {
        changes.push({
          id: changeId("section-remove", unit.key, section.key, "section"),
          kind: "section-remove",
          unitKey: unit.key,
          sectionKey: section.key,
          field: "Subunit",
          where: `${unitName} · ${existing.id}`,
          before: `${existing.id} ${existing.title}`,
          after: null,
          destructive: true,
        });
        continue;
      }

      if (!existing || !proposed) continue;
      const where = `${unitName} · ${existing.id}`;

      if (norm(proposed.number)) {
        push({
          id: changeId("section-renumber", unit.key, section.key, "number"),
          kind: "section-renumber",
          unitKey: unit.key,
          sectionKey: section.key,
          field: "Number",
          where,
          before: existing.id,
          after: norm(proposed.number),
        });
      }

      if (norm(proposed.title)) {
        push({
          id: changeId("section-title", unit.key, section.key, "title"),
          kind: "section-title",
          unitKey: unit.key,
          sectionKey: section.key,
          field: "Title",
          where,
          before: norm(existing.title),
          after: norm(proposed.title),
        });
      }

      if (normDate(proposed.date)) {
        push({
          id: changeId("section-date", unit.key, section.key, "date"),
          kind: "section-date",
          unitKey: unit.key,
          sectionKey: section.key,
          field: "Date",
          where,
          before: normDate(existing.date) || null,
          after: normDate(proposed.date),
        });
      }

      const proposedObjectives = proposedObjectivesText(proposed.objectives);
      if (proposedObjectives) {
        push({
          id: changeId("section-objectives", unit.key, section.key, "objectives"),
          kind: "section-objectives",
          unitKey: unit.key,
          sectionKey: section.key,
          field: "Objectives",
          where,
          before: objectivesText(existing.objectives) || null,
          after: proposedObjectives,
        });
      }

      for (const track of section.tracks) {
        const label = track.existing?.label ?? track.label;
        if (track.existing && track.proposed) {
          const after = norm(track.proposed.reference);
          if (!after) continue;
          push({
            id: changeId(
              "track-reference",
              unit.key,
              section.key,
              trackKey(track.kind, label)
            ),
            kind: "track-reference",
            unitKey: unit.key,
            sectionKey: section.key,
            field: `${label} reference`,
            where,
            before: norm(track.existing.reference) || null,
            after,
          });
        } else if (!track.existing && track.proposed) {
          changes.push({
            id: changeId("track-add", unit.key, section.key, trackKey(track.kind, label)),
            kind: "track-add",
            unitKey: unit.key,
            sectionKey: section.key,
            field: "New resource",
            where,
            before: null,
            after: norm(track.proposed.reference)
              ? `${label} — ${norm(track.proposed.reference)}`
              : label,
          });
        }
      }
    }

    // A checkpoint's anchor is compared against where its section will end up,
    // so a pure renumber below it does not read as the quiz having moved.
    const resultNumber = new Map<string, string>();
    for (const section of unit.sections) {
      if (!section.existing) continue;
      const renumbered =
        section.proposed && norm(section.proposed.number)
          ? norm(section.proposed.number)
          : section.existing.id;
      resultNumber.set(section.existing.id, renumbered);
    }

    for (const checkpoint of unit.checkpoints) {
      const { existing, proposed } = checkpoint;

      if (!existing && proposed) {
        changes.push({
          id: changeId("checkpoint-add", unit.key, checkpoint.key, "checkpoint"),
          kind: "checkpoint-add",
          unitKey: unit.key,
          checkpointKey: checkpoint.key,
          field: "New checkpoint",
          where: unitName,
          before: null,
          after: [norm(proposed.title), normDate(proposed.date)].filter(Boolean).join(" · "),
        });
        continue;
      }

      if (existing && !proposed) {
        changes.push({
          id: changeId("checkpoint-remove", unit.key, checkpoint.key, "checkpoint"),
          kind: "checkpoint-remove",
          unitKey: unit.key,
          checkpointKey: checkpoint.key,
          field: "Checkpoint",
          where: unitName,
          before: [norm(existing.title), normDate(existing.date)].filter(Boolean).join(" · "),
          after: null,
          destructive: true,
        });
        continue;
      }

      if (!existing || !proposed) continue;
      const where = `${unitName} · ${existing.title}`;

      const field = (name: string, before: string | null, after: string | null) => {
        if (!after) return;
        push({
          id: changeId("checkpoint-field", unit.key, checkpoint.key, name),
          kind: "checkpoint-field",
          unitKey: unit.key,
          checkpointKey: checkpoint.key,
          field: name,
          where,
          before,
          after,
        });
      };

      field("Title", norm(existing.title), norm(proposed.title));
      field("Kind", existing.kind, proposed.kind ?? null);
      field("Date", normDate(existing.date) || null, normDate(proposed.date));
      field("Note", norm(existing.note) || null, norm(proposed.note));

      const anchorNow = existing.afterSectionId
        ? (resultNumber.get(existing.afterSectionId) ?? existing.afterSectionId)
        : null;
      field("Sits after", anchorNow, norm(proposed.afterSectionNumber));
    }
  }

  return { changes, plan };
}

// ── applying ───────────────────────────────────────────────────────────────

/**
 * Renumbering is a sequence of moves over one shared set of keys, so the order
 * matters: shifting 3.3→3.4 before 3.4→3.5 would collide. Emit each move only
 * once nothing else still needs to leave its destination. A genuine cycle (a
 * swap) is broken with a scratch id and finished at the end.
 */
export function orderRemaps(remaps: SectionRemap[]): SectionRemap[] {
  const pending = remaps.filter((r) => r.from && r.to && r.from !== r.to);
  const out: SectionRemap[] = [];
  const deferred: SectionRemap[] = [];

  while (pending.length > 0) {
    const free = pending.findIndex(
      (r) => !pending.some((other) => other !== r && other.from === r.to)
    );
    if (free >= 0) {
      out.push(...pending.splice(free, 1));
      continue;
    }
    const cyclic = pending.shift()!;
    const scratch = `${cyclic.from}~moving`;
    out.push({ from: cyclic.from, to: scratch });
    deferred.push({ from: scratch, to: cyclic.to });
  }

  return [...out, ...deferred];
}

function newTrack(
  sectionId: string,
  planned: PlannedTrack,
  used: Set<string>
): ResourceTrack {
  const base = stableTrackId(sectionId, planned.kind);
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}::${suffix++}`;
  used.add(id);

  return {
    id,
    kind: planned.kind,
    label: norm(planned.proposed?.label) || planned.label || TRACK_KIND_LABELS[planned.kind],
    reference: norm(planned.proposed?.reference),
    objectives: [],
    blocks: [],
    ...(planned.kind === "extra" ? { optional: true } : {}),
  };
}

/**
 * The approved subset of a proposal, as a curriculum plus the section moves
 * that go with it. Anything not approved keeps exactly what it had — which is
 * why a denied renumber leaves the section, and every mark filed under it,
 * where it was.
 */
export function applyChanges(
  current: CurriculumUnit[],
  set: ChangeSet,
  approved: ReadonlySet<string>
): { units: CurriculumUnit[]; remaps: SectionRemap[] } {
  void current;

  const ok = (
    kind: ChangeKind,
    unitKey: string,
    childKey: string,
    field: string
  ): boolean => approved.has(changeId(kind, unitKey, childKey, field));

  // Which units survive.
  const keptUnits = set.plan.units.filter((unit) => {
    if (!unit.existing) return ok("unit-add", unit.key, "", "unit");
    if (!unit.proposed) return !ok("unit-remove", unit.key, "", "unit");
    return true;
  });

  // Which sections survive, and what each one is called afterwards. Ids that
  // are not moving are reserved first so a renumber can never land on one.
  // Slots stay in the order the table will read in; only the ids are settled
  // in two passes, so that a section staying put always wins its own number.
  interface Slot {
    unit: PlannedUnit;
    section: PlannedSection;
    id: string;
    wanted: string | null;
    moved: boolean;
  }
  const slots: Slot[] = [];
  const taken = new Set<string>();

  for (const unit of keptUnits) {
    for (const section of unit.sections) {
      const { existing, proposed } = section;

      if (!existing) {
        if (!proposed) continue;
        if (unit.existing && !ok("section-add", unit.key, section.key, "section")) continue;
        slots.push({ unit, section, id: "", wanted: norm(proposed.number), moved: false });
        continue;
      }

      if (!proposed) {
        if (unit.proposed && ok("section-remove", unit.key, section.key, "section")) continue;
        slots.push({ unit, section, id: existing.id, wanted: null, moved: false });
        continue;
      }

      const renumber =
        norm(proposed.number) !== "" &&
        norm(proposed.number) !== existing.id &&
        ok("section-renumber", unit.key, section.key, "number");

      slots.push({
        unit,
        section,
        id: renumber ? "" : existing.id,
        wanted: renumber ? norm(proposed.number) : null,
        moved: false,
      });
    }
  }

  for (const slot of slots) {
    if (slot.wanted === null) taken.add(slot.id);
  }

  for (const slot of slots) {
    if (slot.wanted === null) continue;
    let id = slot.wanted;
    if (!id || taken.has(id)) {
      // A number already spoken for. An existing section keeps the id it has
      // rather than colliding; a new one takes the next free suffix.
      if (slot.section.existing) {
        id = slot.section.existing.id;
      } else {
        const base = slot.wanted || `${(slot.unit.existing?.subunits.length ?? 0) + 1}.1`;
        id = base;
        let n = 0;
        while (taken.has(id)) id = `${base}${String.fromCharCode(97 + n++)}`;
      }
    }
    taken.add(id);
    slot.id = id;
    slot.moved = slot.section.existing !== null && id !== slot.section.existing.id;
  }

  // Old id → new id, for anything that points at a section by id.
  const idMap = new Map<string, string>();
  const remaps: SectionRemap[] = [];
  for (const slot of slots) {
    if (!slot.section.existing) continue;
    idMap.set(slot.section.existing.id, slot.id);
    if (slot.moved) remaps.push({ from: slot.section.existing.id, to: slot.id });
  }

  const units: CurriculumUnit[] = [];

  for (const unit of keptUnits) {
    const unitSlots = slots.filter((s) => s.unit === unit);
    const sectionIds = new Set(unitSlots.map((s) => s.id));

    const subunits: Section[] = unitSlots.map(({ section, id }) => {
      const { existing, proposed } = section;

      if (!existing) {
        const used = new Set<string>();
        const tracks = section.tracks.map((t) => newTrack(id, t, used));
        return {
          id,
          title: norm(proposed?.title) || id,
          date: normDate(proposed?.date) || undefined,
          objectives: (proposed?.objectives ?? [])
            .map(norm)
            .filter(Boolean)
            .map((text) => ({ id: uuidv4(), text })),
          tracks,
        };
      }

      const base = normalizeSection(existing);
      if (!proposed) return { ...base, id };

      const titleOk = ok("section-title", unit.key, section.key, "title");
      const dateOk = ok("section-date", unit.key, section.key, "date");
      const objectivesOk = ok("section-objectives", unit.key, section.key, "objectives");

      const used = new Set(base.tracks.map((t) => t.id));
      const tracks = section.tracks
        .map((track) => {
          // Matched tracks are returned by reference: the id, and every block
          // and mark filed under it, stay exactly as they were.
          if (track.existing) {
            const label = track.existing.label;
            const reference = norm(track.proposed?.reference);
            const approvedRef =
              reference !== "" &&
              ok("track-reference", unit.key, section.key, trackKey(track.kind, label));
            return approvedRef ? { ...track.existing, reference } : track.existing;
          }
          return ok("track-add", unit.key, section.key, trackKey(track.kind, track.label))
            ? newTrack(id, track, used)
            : null;
        })
        .filter((t): t is ResourceTrack => t !== null);

      return {
        ...base,
        id,
        title: titleOk && norm(proposed.title) ? norm(proposed.title) : base.title,
        date: dateOk && normDate(proposed.date) ? normDate(proposed.date) : base.date,
        objectives: objectivesOk
          ? (proposed.objectives ?? [])
              .map(norm)
              .filter(Boolean)
              .map((text) => ({ id: uuidv4(), text }))
          : base.objectives,
        tracks,
      };
    });

    /** A checkpoint's anchor, given by number, resolved against this unit. */
    const anchorFor = (number: string | null | undefined): string | null => {
      const wanted = norm(number);
      if (!wanted) return null;
      return sectionIds.has(wanted) ? wanted : null;
    };

    const checkpoints: Checkpoint[] = [];
    for (const planned of unit.checkpoints) {
      const { existing, proposed } = planned;

      if (!existing) {
        if (!proposed) continue;
        if (unit.existing && !ok("checkpoint-add", unit.key, planned.key, "checkpoint")) {
          continue;
        }
        checkpoints.push({
          id: uuidv4(),
          kind: proposed.kind ?? "quiz",
          title: norm(proposed.title) || "Checkpoint",
          date: normDate(proposed.date) || undefined,
          afterSectionId: anchorFor(proposed.afterSectionNumber),
          note: norm(proposed.note) || undefined,
        });
        continue;
      }

      const anchorNow = existing.afterSectionId
        ? (idMap.get(existing.afterSectionId) ?? existing.afterSectionId)
        : null;
      const carried: Checkpoint = {
        ...existing,
        afterSectionId: anchorNow && sectionIds.has(anchorNow) ? anchorNow : null,
      };

      if (!proposed) {
        if (unit.proposed && ok("checkpoint-remove", unit.key, planned.key, "checkpoint")) {
          continue;
        }
        checkpoints.push(carried);
        continue;
      }

      const field = (name: string) => ok("checkpoint-field", unit.key, planned.key, name);
      checkpoints.push({
        ...carried,
        title: field("Title") && norm(proposed.title) ? norm(proposed.title) : carried.title,
        kind: field("Kind") && proposed.kind ? proposed.kind : carried.kind,
        date:
          field("Date") && normDate(proposed.date) ? normDate(proposed.date) : carried.date,
        note: field("Note") && norm(proposed.note) ? norm(proposed.note) : carried.note,
        afterSectionId: field("Sits after")
          ? anchorFor(proposed.afterSectionNumber)
          : carried.afterSectionId,
      });
    }

    if (subunits.length === 0) continue;

    const titleOk = ok("unit-title", unit.key, "", "title");
    const title =
      titleOk && norm(unit.proposed?.title)
        ? norm(unit.proposed!.title)
        : (unit.existing?.title ?? norm(unit.proposed?.title) ?? "Unit");

    units.push({
      id: unit.existing?.id ?? uuidv4(),
      title,
      subunits,
      checkpoints,
    });
  }

  return { units, remaps: orderRemaps(remaps) };
}
