import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurriculumUnit } from "../db/types";
import {
  ClassroomError,
  createTopic,
  createWork,
  deleteTopic,
  deleteWork,
  listSubmissions,
  listTopics,
  listWork,
  renameTopic,
  updateWork,
  wireDue,
  wireState,
  type WireItem,
} from "./api";
import {
  absorb,
  baselines,
  plannedFields,
  plannedItems,
  planSync,
  rekeys,
  removals,
  sentAfter,
  tidy,
  type ClassroomLink,
  type ItemFields,
  type LinkState,
  type PlannedWork,
  type PostingRule,
  type SyncOp,
} from "./plan";

/**
 * Carries out a plan against Classroom and records every item it makes in
 * `classroom_links` as it goes, so a run cut short by the time limit (or by
 * Google) loses nothing: the next run plans from what was saved and picks up
 * where this one stopped.
 *
 * Each run first looks at what Classroom has now, then sends what changed in the
 * curriculum (ADR-012). The order matters: an edit made in Classroom has to be
 * on record before anything is decided about that item.
 */

export interface SyncResult {
  created: number;
  updated: number;
  /** Extra copies of tracked items, removed from Classroom. */
  removed: number;
  /** Dropped from the curriculum, and deleted from Classroom. */
  deleted: number;
  /** Dropped from the curriculum, but kept because students have work on them. */
  kept: number;
  failed: number;
  /** Calls still to make when the time budget ran out. Run again to finish. */
  remaining: number;
  /** One line per failure, for the server log and the teacher's summary. */
  errors: string[];
}

interface Row {
  item_key: string;
  kind: ClassroomLink["kind"];
  classroom_id: string;
  state: LinkState;
  scheduled_for: string | null;
  sent: ItemFields | null;
  classroom: ItemFields | null;
}

/** The links the sync owns. Hand-posted work is the pull's, for the grid only. */
export async function loadLinks(db: SupabaseClient, classId: string): Promise<ClassroomLink[]> {
  const { data, error } = await db
    .from("classroom_links")
    .select("item_key, kind, classroom_id, state, scheduled_for, sent, classroom")
    .eq("class_id", classId)
    .neq("kind", "external");
  if (error) throw new Error(`Could not read Classroom links: ${error.message}`);
  return (data as Row[]).map((r) => ({
    itemKey: r.item_key,
    kind: r.kind,
    classroomId: r.classroom_id,
    state: r.state,
    scheduledFor: r.scheduled_for,
    sent: r.sent,
    classroom: r.classroom,
  }));
}

function classroomFields(row: WireItem): ItemFields {
  return {
    title: row.title ?? "",
    description: (row.description ?? "").trim(),
    due: wireDue(row),
    postAt: row.scheduledTime ?? null,
  };
}

/** Anything but an untouched assignment counts: deleting it would delete their work. */
function hasStudentWork(state: string, assignedGrade: number | null, draftGrade: number | null): boolean {
  return state !== "NEW" || assignedGrade !== null || draftGrade !== null;
}

export async function runSync(options: {
  db: SupabaseClient;
  token: string;
  classId: string;
  courseId: string;
  units: CurriculumUnit[];
  rule: PostingRule;
  timeZone: string;
  now: Date;
  deadline: number;
}): Promise<SyncResult> {
  const { db, token, classId, courseId, deadline } = options;
  const result: SyncResult = {
    created: 0,
    updated: 0,
    removed: 0,
    deleted: 0,
    kept: 0,
    failed: 0,
    remaining: 0,
    errors: [],
  };

  const rowOf = (link: ClassroomLink) => ({
    class_id: classId,
    course_id: courseId,
    item_key: link.itemKey,
    kind: link.kind,
    classroom_id: link.classroomId,
    state: link.state,
    scheduled_for: link.scheduledFor,
    sent: link.sent ?? null,
    classroom: link.classroom ?? null,
  });
  const save = async (...links: ClassroomLink[]) => {
    if (links.length === 0) return;
    const { error } = await db
      .from("classroom_links")
      .upsert(links.map(rowOf), { onConflict: "class_id,item_key" });
    if (error) throw new Error(`Could not save a Classroom link: ${error.message}`);
  };
  const forget = async (itemKey: string) => {
    const { error } = await db.from("classroom_links").delete().eq("class_id", classId).eq("item_key", itemKey);
    if (error) throw new Error(`Could not remove a Classroom link: ${error.message}`);
    await db.from("classroom_submissions").delete().eq("class_id", classId).eq("item_key", itemKey);
  };

  const planned = plannedItems(options);
  const plannedKeys = new Set(planned.map((p) => p.key));

  // What Classroom has now.
  const [everything, topics] = await Promise.all([listWork(token, courseId), listTopics(token, courseId)]);
  const own = everything.filter((w) => w.own);
  let links = await loadLinks(db, classId);

  // Record what we made but never saved, and remove the second copies a doubled
  // post left behind.
  const topicIdsOf = (from: ClassroomLink[]) =>
    new Map(from.filter((l) => l.kind === "topic" && l.state !== "GONE").map((l) => [l.itemKey, l.classroomId]));
  const found = tidy(own, links, planned, topicIdsOf(links));
  await save(
    ...found.adopt.map(
      ({ item, own: o }): ClassroomLink => ({
        itemKey: item.key,
        kind: item.kind,
        classroomId: o.id,
        state: o.state,
        scheduledFor: o.scheduledFor,
        sent: plannedFields(item),
      })
    )
  );
  const removedCopies = new Set<string>();
  for (const o of found.remove) {
    try {
      await deleteWork(token, courseId, o);
      removedCopies.add(o.id);
      result.removed++;
    } catch (err) {
      result.errors.push(`remove ${o.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (found.adopt.length) links = await loadLinks(db, classId);

  // A lesson renumbered in an upload keeps its Classroom item and student work.
  for (const { from, to } of rekeys(links, planned)) {
    const { error } = await db
      .from("classroom_links")
      .update({ item_key: to })
      .eq("class_id", classId)
      .eq("item_key", from);
    if (error) throw new Error(`Could not move a Classroom link: ${error.message}`);
    links = links.map((l) => (l.itemKey === from ? { ...l, itemKey: to } : l));
  }

  // Edits, reschedules and deletions made in Classroom go on record...
  const merge = (changed: ClassroomLink[]) => {
    const byKey = new Map(changed.map((l) => [l.itemKey, l]));
    links = links.map((l) => byKey.get(l.itemKey) ?? l);
  };
  const absorbed = absorb(links, own, topics, plannedKeys);
  await save(...absorbed);
  merge(absorbed);

  // ...and links older than this start counting edits from here.
  const baseline = baselines(planned, links);
  await save(...baseline);
  const ops = planSync({ ...options, links });
  merge(baseline);

  const topicIds = topicIdsOf(links);

  const apply = async (op: SyncOp) => {
    const { item } = op;
    try {
      if (op.type === "create" && item.kind === "topic") {
        const id = await createTopic(token, courseId, item);
        topicIds.set(item.key, id);
        await save({
          itemKey: item.key,
          kind: "topic",
          classroomId: id,
          state: "PUBLISHED",
          scheduledFor: null,
          sent: plannedFields(item),
          classroom: { title: item.name },
        });
        result.created++;
      } else if (op.type === "create" && item.kind !== "topic") {
        const made = await createWork(token, courseId, topicIds.get(item.topicKey), item);
        await save({
          itemKey: item.key,
          kind: item.kind,
          classroomId: made.id,
          state: wireState(made),
          scheduledFor: made.scheduledTime ?? null,
          sent: plannedFields(item),
          classroom: classroomFields(made),
        });
        result.created++;
      } else if (op.type === "rename") {
        await renameTopic(token, courseId, op.link.classroomId, op.item.name);
        await save({ ...op.link, sent: plannedFields(op.item), classroom: { title: op.item.name } });
        result.updated++;
      } else if (op.type === "update") {
        const updated = await updateWork(token, courseId, op.link.classroomId, op.item, op.fields);
        await save({
          ...op.link,
          state: wireState(updated),
          scheduledFor: updated.scheduledTime ?? null,
          sent: sentAfter(op.item, op.link, op.fields),
          classroom: classroomFields(updated),
        });
        result.updated++;
      }
    } catch (err) {
      // Deleted in Classroom since we looked: Classroom wins, so leave it be.
      if (op.type === "update" && err instanceof ClassroomError && err.status === 404) {
        await save({ ...op.link, state: "GONE", scheduledFor: null });
        return;
      }
      result.failed++;
      result.errors.push(`${item.key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // One call at a time, in plan order: topics come first because their work
  // needs the ids they come back with, and Classroom stacks a topic's items
  // in the order they were created.
  for (let i = 0; i < ops.length; i++) {
    if (Date.now() > deadline) {
      result.remaining = ops.length - i;
      return result;
    }
    await apply(ops[i]);
  }

  // What the curriculum no longer has. Nothing with student work is deleted.
  const gone = removals(links, planned);
  for (const link of gone.forget) await forget(link.itemKey);

  const worked = new Set<string>();
  if (gone.work.some((l) => l.kind === "assignment")) {
    for (const s of await listSubmissions(token, courseId)) {
      if (hasStudentWork(s.state, s.assignedGrade, s.draftGrade)) worked.add(s.courseWorkId);
    }
  }
  const deletedIds = new Set<string>(removedCopies);
  for (let i = 0; i < gone.work.length; i++) {
    if (Date.now() > deadline) {
      result.remaining = gone.work.length - i;
      return result;
    }
    const link = gone.work[i] as ClassroomLink & { kind: PlannedWork["kind"] };
    if (worked.has(link.classroomId)) {
      await save({ ...link, state: "KEPT" });
      result.kept++;
      continue;
    }
    try {
      await deleteWork(token, courseId, { id: link.classroomId, kind: link.kind });
      deletedIds.add(link.classroomId);
      await forget(link.itemKey);
      result.deleted++;
    } catch (err) {
      if (err instanceof ClassroomError && err.status === 404) {
        await forget(link.itemKey);
        continue;
      }
      result.failed++;
      result.errors.push(`delete ${link.itemKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // A unit's topic goes only once nothing is left under it, including anything
  // the teacher posted there by hand.
  for (const link of gone.topics) {
    if (Date.now() > deadline) break;
    const inUse = everything.some((w) => w.topicId === link.classroomId && !deletedIds.has(w.id));
    if (inUse) continue;
    try {
      await deleteTopic(token, courseId, link.classroomId);
      await forget(link.itemKey);
    } catch (err) {
      if (err instanceof ClassroomError && err.status === 404) await forget(link.itemKey);
      else result.errors.push(`topic ${link.itemKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}
