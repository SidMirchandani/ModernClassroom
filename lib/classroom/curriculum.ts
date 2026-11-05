import type { CurriculumUnit } from "../db/types";
import type { Checkpoint, CheckpointKind, ResourceTrack, Section } from "../types";
import type { ClassroomWork } from "./api";
import { CLASSROOM_TOPIC_UNIT } from "./plan";

/**
 * A Google Classroom class as a curriculum, by plain rules and with no AI, so it
 * takes no time and has nothing to fail: the teacher already organised it.
 *
 *   Topic                         → Unit
 *   Quiz, test, exam, project     → Checkpoint
 *   Anything else                 → Lesson
 *   Items numbered the same       → One lesson ("4.1 Notes" and "4.1 Homework")
 *
 * Ids come from Classroom's, so doing it twice gives the same curriculum.
 */

const NUMBERED_TOPIC = /^(?:(?:unit|topic|module|chapter|ch\.?)\s*)?(\d{1,2})(?![\w.])\s*[:.\-–—]?\s*(.*)$/i;
const NUMBERED_ITEM = /^(\d{1,2})\.(\d{1,2})(?![\w.])\s*[:.\-–—]?\s*(.*)$/;
const NOT_GRADED_AS_SUCH = /\b(review|study guide|practice|prep|corrections?|retake notes|answer key)\b/i;

function checkpointKind(item: ClassroomWork): CheckpointKind | null {
  if (item.kind !== "assignment" || NOT_GRADED_AS_SUCH.test(item.title)) return null;
  if (/\b(quiz(zes)?|qz)\b/i.test(item.title)) return "quiz";
  if (/\b(tests?|exams?|midterms?|finals?|assessments?)\b/i.test(item.title)) return "test";
  if (/\bprojects?\b/i.test(item.title)) return "project";
  return null;
}

/** When it happens: when it is due, or failing that when it went up. */
function when(item: ClassroomWork): string {
  return item.due ?? item.scheduledFor ?? item.created ?? "";
}

function dayLabel(item: ClassroomWork, timeZone: string): string | undefined {
  const instant = when(item);
  if (!instant) return undefined;
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", timeZone }).format(date);
}

/** Lessons in number order where they are numbered, and by date around that. */
function inOrder(a: ClassroomWork, b: ClassroomWork): number {
  const [x, y] = [a.title.match(NUMBERED_ITEM), b.title.match(NUMBERED_ITEM)];
  if (x && y) {
    const byNumber = Number(x[1]) - Number(y[1]) || Number(x[2]) - Number(y[2]);
    if (byNumber) return byNumber;
  }
  return when(a).localeCompare(when(b));
}

interface Group {
  topicId: string | null;
  name: string;
  items: ClassroomWork[];
  number: number | null;
  rest: string;
}

/** Each topic with its number, if it has one of its own. */
function orderedGroups(work: ClassroomWork[], topics: { id: string; name: string }[]): Group[] {
  const names = new Map(topics.map((t) => [t.id, t.name]));
  const byTopic = new Map<string | null, ClassroomWork[]>();
  for (const item of work) {
    // A topic deleted since is as good as none.
    const key = item.topicId && names.has(item.topicId) ? item.topicId : null;
    byTopic.set(key, [...(byTopic.get(key) ?? []), item]);
  }

  const groups: Group[] = [...byTopic.entries()].map(([topicId, items]) => {
    const name = topicId ? names.get(topicId)! : "Not in a topic";
    const match = topicId ? name.match(NUMBERED_TOPIC) : null;
    return { topicId, name, items, number: match ? Number(match[1]) : null, rest: match?.[2].trim() || "" };
  });

  // Two topics can't share a unit number: then the numbers mean something else.
  const named = groups.filter((g) => g.number !== null).map((g) => g.number);
  if (new Set(named).size !== named.length) {
    for (const g of groups) {
      g.number = null;
      g.rest = "";
    }
  }

  const earliest = (g: Group) => g.items.map(when).filter(Boolean).sort()[0] ?? "";
  const allNumbered = groups.filter((g) => g.topicId).every((g) => g.number !== null);
  return groups.sort((a, b) => {
    if (!a.topicId || !b.topicId) return a.topicId ? -1 : b.topicId ? 1 : 0;
    return allNumbered ? a.number! - b.number! : earliest(a).localeCompare(earliest(b));
  });
}

/** The lessons' own numbers where they fit this unit, the next free ones otherwise. */
function buildUnit(group: Group, unitNumber: number, timeZone: string): CurriculumUnit {
  const items = [...group.items].sort(inOrder);
  const taken = new Set<number>();
  for (const item of items) {
    const match = item.title.match(NUMBERED_ITEM);
    if (match && Number(match[1]) === unitNumber && !checkpointKind(item)) taken.add(Number(match[2]));
  }
  let next = 1;
  const freeNumber = () => {
    while (taken.has(next)) next++;
    taken.add(next);
    return next;
  };

  const subunits: Section[] = [];
  const checkpoints: Checkpoint[] = [];
  const lessons = new Map<number, { section: Section; items: ClassroomWork[] }>();

  for (const item of items) {
    const kind = checkpointKind(item);
    if (kind) {
      checkpoints.push({
        id: `classroom-${item.id}`,
        kind,
        title: item.title,
        date: dayLabel(item, timeZone),
        afterSectionId: subunits.at(-1)?.id ?? null,
        ...(item.maxPoints ? { maxPoints: item.maxPoints } : {}),
      });
      continue;
    }
    const match = item.title.match(NUMBERED_ITEM);
    const own = match && Number(match[1]) === unitNumber ? Number(match[2]) : null;
    const same = own !== null ? lessons.get(own) : undefined;
    if (same) {
      same.items.push(item);
      // Its date is when the work on it is due, when any of it is.
      if (item.due && !same.items[0].due) same.section.date = dayLabel(item, timeZone);
      continue;
    }
    const n = own ?? freeNumber();
    const section: Section = {
      id: `${unitNumber}.${n}`,
      title: (own !== null ? match![3] : item.title).split(" · ")[0].trim() || item.title,
      date: dayLabel(item, timeZone),
      objectives: [],
      tracks: [],
    };
    subunits.push(section);
    lessons.set(n, { section, items: [item] });
  }

  // One lesson made of several items: each is a resource under it.
  for (const { section, items: parts } of lessons.values()) {
    if (parts.length < 2) continue;
    section.tracks = parts.map(
      (part): ResourceTrack => ({
        id: `${section.id}::classroom-${part.id}`,
        kind: "custom",
        label: part.title.includes(" · ") ? part.title.split(" · ").slice(1).join(" · ") : part.title,
        objectives: [],
        blocks: [],
      })
    );
  }

  const name = group.number !== null && group.rest ? group.rest : group.name;
  return {
    id: group.topicId ? `${CLASSROOM_TOPIC_UNIT}${group.topicId}` : "classroom-no-topic",
    title: /^unit\s*\d+/i.test(group.name) && group.number === unitNumber && !group.rest ? group.name : `Unit ${unitNumber}: ${name}`,
    subunits,
    checkpoints,
  };
}

export interface ClassroomCurriculum {
  units: CurriculumUnit[];
  /** Assignments and materials read. None means there was nothing to build from. */
  items: number;
  /** Topics with something under them. */
  topics: number;
}

export function classroomCurriculum(
  work: ClassroomWork[],
  topics: { id: string; name: string }[],
  timeZone: string
): ClassroomCurriculum {
  const groups = orderedGroups(work, topics);
  const taken = new Set(groups.map((g) => g.number).filter((n): n is number => n !== null));
  let next = 1;
  const units = groups.map((group) => {
    let number = group.number;
    if (number === null) {
      while (taken.has(next)) next++;
      number = next;
      taken.add(number);
    }
    return buildUnit(group, number, timeZone);
  });
  return { units, items: work.length, topics: groups.filter((g) => g.topicId).length };
}
