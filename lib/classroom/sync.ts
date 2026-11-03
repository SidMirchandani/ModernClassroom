import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurriculumUnit } from "../db/types";
import { ClassroomError, createTopic, createWork, deleteWork, listOwnWork, updateWorkState } from "./api";
import {
  plannedItems,
  planSync,
  tidy,
  type ClassroomLink,
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
 */

export interface SyncResult {
  created: number;
  updated: number;
  /** Extra copies of tracked items, removed from Classroom. */
  removed: number;
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
}

export async function loadLinks(db: SupabaseClient, classId: string): Promise<ClassroomLink[]> {
  const { data, error } = await db
    .from("classroom_links")
    .select("item_key, kind, classroom_id, state, scheduled_for")
    .eq("class_id", classId);
  if (error) throw new Error(`Could not read Classroom links: ${error.message}`);
  return (data as Row[]).map((r) => ({
    itemKey: r.item_key,
    kind: r.kind,
    classroomId: r.classroom_id,
    state: r.state,
    scheduledFor: r.scheduled_for,
  }));
}

function linkState(work: PlannedWork): { state: LinkState; scheduled_for: string | null } {
  return work.target.state === "SCHEDULED"
    ? { state: "SCHEDULED", scheduled_for: work.target.at }
    : { state: work.target.state, scheduled_for: null };
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
  const result: SyncResult = { created: 0, updated: 0, removed: 0, failed: 0, remaining: 0, errors: [] };

  const save = async (row: Omit<Row, "kind"> & { kind: ClassroomLink["kind"] }) => {
    const { error } = await db
      .from("classroom_links")
      .upsert({ class_id: classId, course_id: courseId, ...row }, { onConflict: "class_id,item_key" });
    if (error) throw new Error(`Could not save a Classroom link: ${error.message}`);
  };

  // First square Classroom with the links: record what we made but never
  // saved, and remove the second copies a doubled post left behind.
  let links = await loadLinks(db, classId);
  const topicIdsOf = (from: ClassroomLink[]) =>
    new Map(from.filter((l) => l.kind === "topic").map((l) => [l.itemKey, l.classroomId]));
  const found = tidy(await listOwnWork(token, courseId), links, plannedItems(options), topicIdsOf(links));
  for (const { item, own } of found.adopt) {
    await save({ item_key: item.key, kind: item.kind, classroom_id: own.id, state: own.state, scheduled_for: own.scheduledFor });
  }
  for (const own of found.remove) {
    try {
      await deleteWork(token, courseId, own);
      result.removed++;
    } catch (err) {
      result.errors.push(`remove ${own.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (found.adopt.length) links = await loadLinks(db, classId);

  const ops = planSync({ ...options, links });
  const topicIds = topicIdsOf(links);

  const apply = async (op: SyncOp) => {
    const { item } = op;
    try {
      if (op.type === "create" && item.kind === "topic") {
        const id = await createTopic(token, courseId, item);
        topicIds.set(item.key, id);
        await save({ item_key: item.key, kind: "topic", classroom_id: id, state: "PUBLISHED", scheduled_for: null });
        result.created++;
      } else if (op.type === "create" && item.kind !== "topic") {
        const id = await createWork(token, courseId, topicIds.get(item.topicKey), item);
        await save({ item_key: item.key, kind: item.kind, classroom_id: id, ...linkState(item) });
        result.created++;
      } else if (op.type === "update") {
        await updateWorkState(token, courseId, op.link.classroomId, op.item);
        await save({ item_key: item.key, kind: op.item.kind, classroom_id: op.link.classroomId, ...linkState(op.item) });
        result.updated++;
      }
    } catch (err) {
      // Deleted in Classroom: Classroom wins, so remember it and leave it be.
      if (op.type === "update" && err instanceof ClassroomError && err.status === 404) {
        await save({ item_key: item.key, kind: op.item.kind, classroom_id: op.link.classroomId, state: "GONE", scheduled_for: null });
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
  return result;
}
