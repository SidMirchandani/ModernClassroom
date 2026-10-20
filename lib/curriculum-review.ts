import type {
  Change,
  ChangeSet,
  PlannedCheckpoint,
  PlannedSection,
  PlannedUnit,
} from "./curriculum-diff";

/**
 * Reviewing a proposal the way an editor reviews an agent's edits: the
 * changes are grouped into hunks — one row of the curriculum each — and every
 * hunk is accepted or rejected as a whole. A decided hunk stops being a diff
 * and reads as the curriculum it will be; once the last one is decided, the
 * accepted ones are applied together.
 *
 * Hunks are keyed by where they sit (unit, section, checkpoint), which the
 * change set derives deterministically, so a decision survives the set being
 * rebuilt against a curriculum that moved underneath it. It is also stamped
 * with what the hunk proposed: a follow-up that changes a hunk's content asks
 * again instead of carrying a "yes" over to something the teacher never saw.
 */

export type Decision = "accepted" | "rejected";

export interface Hunk {
  key: string;
  unitKey: string;
  changes: Change[];
  /** What the hunk proposes; a decision only holds for the same proposal. */
  signature: string;
  /** Accepting it removes something a student may have worked under. */
  destructive: boolean;
}

export type Decisions = Record<string, { decision: Decision; signature: string }>;

export function hunkKeyOf(change: Change): string {
  if (change.sectionKey) return `sec|${change.unitKey}|${change.sectionKey}`;
  if (change.checkpointKey) return `cp|${change.unitKey}|${change.checkpointKey}`;
  return `unit|${change.unitKey}`;
}

/** A row of a unit as the review reads it: sections, checkpoints between them. */
export type ReviewRow =
  | { kind: "section"; section: PlannedSection }
  | { kind: "checkpoint"; checkpoint: PlannedCheckpoint };

/** The section's number once the proposal is in: what it will be called. */
function sectionNumber(section: PlannedSection): string {
  return (section.proposed?.number ?? section.existing?.id ?? "").trim();
}

/**
 * Sections in order, each checkpoint after the section it sits after — the
 * same reading order as the class's own grid. A checkpoint pinned to no
 * section leads its unit; one whose section is gone ends it.
 */
export function reviewRows(unit: PlannedUnit): ReviewRow[] {
  const anchorOf = (c: PlannedCheckpoint): string | null => {
    const proposed = c.proposed?.afterSectionNumber;
    if (c.proposed && proposed !== undefined) return proposed ? proposed.trim() : null;
    const existing = c.existing?.afterSectionId ?? null;
    if (!existing) return null;
    // An existing anchor names the section's old id; follow it to its new number.
    const moved = unit.sections.find((s) => s.existing?.id === existing);
    return moved ? sectionNumber(moved) : existing;
  };

  const numbers = new Set(unit.sections.map(sectionNumber));
  const rows: ReviewRow[] = unit.checkpoints
    .filter((c) => anchorOf(c) === null)
    .map((checkpoint) => ({ kind: "checkpoint" as const, checkpoint }));

  for (const section of unit.sections) {
    rows.push({ kind: "section", section });
    const number = sectionNumber(section);
    for (const checkpoint of unit.checkpoints) {
      if (anchorOf(checkpoint) === number) rows.push({ kind: "checkpoint", checkpoint });
    }
  }

  for (const checkpoint of unit.checkpoints) {
    const anchor = anchorOf(checkpoint);
    if (anchor !== null && !numbers.has(anchor)) rows.push({ kind: "checkpoint", checkpoint });
  }
  return rows;
}

/** Every hunk in the order the review shows them, top to bottom. */
export function buildHunks(set: ChangeSet): Hunk[] {
  const byKey = new Map<string, Change[]>();
  for (const change of set.changes) {
    const key = hunkKeyOf(change);
    byKey.set(key, [...(byKey.get(key) ?? []), change]);
  }

  const order: string[] = [];
  for (const unit of set.plan.units) {
    order.push(`unit|${unit.key}`);
    for (const row of reviewRows(unit)) {
      order.push(
        row.kind === "section"
          ? `sec|${unit.key}|${row.section.key}`
          : `cp|${unit.key}|${row.checkpoint.key}`
      );
    }
  }
  // Anything the walk missed still gets reviewed, at the end.
  for (const key of byKey.keys()) if (!order.includes(key)) order.push(key);

  return order
    .filter((key) => byKey.has(key))
    .map((key) => {
      const changes = byKey.get(key)!;
      return {
        key,
        unitKey: changes[0].unitKey,
        changes,
        signature: changes.map((c) => `${c.id}=${c.after ?? ""}`).join("\n"),
        destructive: changes.some((c) => c.destructive),
      };
    });
}

/** The decision on a hunk, if it was made about what the hunk proposes now. */
export function decisionOf(hunk: Hunk, decisions: Decisions): Decision | null {
  const made = decisions[hunk.key];
  return made && made.signature === hunk.signature ? made.decision : null;
}

/** The change ids to apply: every change in every accepted hunk. */
export function acceptedChangeIds(hunks: Hunk[], decisions: Decisions): Set<string> {
  const ids = new Set<string>();
  for (const hunk of hunks) {
    if (decisionOf(hunk, decisions) === "accepted") hunk.changes.forEach((c) => ids.add(c.id));
  }
  return ids;
}

/** Decisions still standing against a new set of hunks — the rest are asked again. */
export function carryDecisions(hunks: Hunk[], decisions: Decisions): Decisions {
  const out: Decisions = {};
  for (const hunk of hunks) {
    const decision = decisionOf(hunk, decisions);
    if (decision) out[hunk.key] = { decision, signature: hunk.signature };
  }
  return out;
}

/** "3 units · 14 changes", for the chat's summary of an edit. */
export function describeSet(set: ChangeSet, hunks: Hunk[]): string {
  const added = set.changes.filter((c) => c.kind === "unit-add").length;
  const touched = new Set(hunks.map((h) => h.unitKey)).size;
  const parts: string[] = [];
  if (added > 0) parts.push(`${added} new unit${added === 1 ? "" : "s"}`);
  if (touched - added > 0) parts.push(`${touched - added} unit${touched - added === 1 ? "" : "s"} changed`);
  return parts.join(" · ");
}
