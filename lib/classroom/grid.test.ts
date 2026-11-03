import { describe, expect, it } from "vitest";
import type { CurriculumUnit } from "../db/types";
import type { ResourceTrack } from "../types";
import {
  cellStatus,
  diffRows,
  gridColumns,
  studentOverall,
  type CachedSubmission,
  type GridColumn,
  type GridLink,
} from "./grid";
import { plannedItems } from "./plan";

/**
 * What the grid says about each student. The columns must line up with what
 * the plan posts, or a turn-in would have no cell to land in.
 */

const NOW = new Date(2026, 9, 10, 12); // Oct 10, noon, local

const bare = (id: string, label: string): ResourceTrack => ({ id, kind: "textbook", label, objectives: [], blocks: [] });
const block = (id: string, type: "learn" | "practice") => ({ id, type, title: type, attachments: [] });

function unit(): CurriculumUnit {
  return {
    id: "u1",
    title: "Unit 1",
    subunits: [
      { id: "1.1", title: "Rebound", date: "10/5", objectives: [], tracks: [bare("1.1::a", "Next-Gen"), bare("1.1::b", "Delta Math")] },
      { id: "1.2", title: "Doses", date: "10/6", objectives: [], tracks: [] },
      {
        id: "1.3",
        title: "Match",
        date: "10/7",
        objectives: [],
        tracks: [
          { ...bare("1.3::a", "Next-Gen"), blocks: [block("x", "learn"), block("y", "practice")] },
          { ...bare("1.3::b", "Notes"), blocks: [block("z", "learn")] },
        ],
      },
    ],
    checkpoints: [
      { id: "q1", kind: "quiz", title: "Quiz 1", date: "10/8", afterSectionId: "1.1" },
      { id: "t0", kind: "test", title: "Pretest", date: "10/1", afterSectionId: null },
    ],
  };
}

describe("gridColumns", () => {
  it("runs in course order, one column per thing to turn in", () => {
    expect(gridColumns(unit()).map((c) => c.key)).toEqual([
      "checkpoint:t0",
      "practice:1.1::a",
      "practice:1.1::b",
      "checkpoint:q1",
      "lesson:1.2",
      "practice:1.3::a",
    ]);
  });

  it("uses exactly the keys the plan posts as assignments", () => {
    const posted = plannedItems({ units: [unit()], rule: "lesson_day", now: NOW, timeZone: "UTC" })
      .filter((i) => i.kind === "assignment")
      .map((i) => i.key)
      .sort();
    expect(gridColumns(unit()).map((c) => c.key).sort()).toEqual(posted);
  });

  it("names a lesson's resource, and leaves a quiz to its title", () => {
    const columns = gridColumns(unit());
    expect(columns[1]).toMatchObject({ head: "1.1", detail: "Rebound · Next-Gen", kind: "lesson" });
    expect(columns[3]).toMatchObject({ head: "Quiz 1", kind: "checkpoint" });
    expect(columns[3].detail).toBeUndefined();
  });
});

describe("cellStatus", () => {
  const column = (date: string): GridColumn => ({ key: "k", head: "1.1", date, kind: "lesson" });
  const posted: GridLink = { itemKey: "k", state: "PUBLISHED", scheduledFor: null };
  const sub = (state: CachedSubmission["state"], late = false): CachedSubmission => ({
    userId: "u",
    itemKey: "k",
    state,
    late,
    assignedGrade: null,
    draftGrade: null,
  });

  it("says what the student has done", () => {
    expect(cellStatus(column("10/5"), posted, sub("TURNED_IN"), NOW)).toBe("turned-in");
    expect(cellStatus(column("10/5"), posted, sub("TURNED_IN", true), NOW)).toBe("late");
    expect(cellStatus(column("10/5"), posted, sub("RETURNED"), NOW)).toBe("returned");
  });

  it("calls work missing once its date is over, and not before", () => {
    expect(cellStatus(column("10/9"), posted, sub("CREATED"), NOW)).toBe("missing");
    expect(cellStatus(column("10/10"), posted, sub("CREATED"), NOW)).toBe("not-yet");
    expect(cellStatus(column("10/20"), posted, undefined, NOW)).toBe("not-yet");
  });

  it("counts taking work back as not handed in", () => {
    expect(cellStatus(column("10/9"), posted, sub("RECLAIMED_BY_STUDENT"), NOW)).toBe("missing");
  });

  it("holds nothing against a student for work not posted yet", () => {
    const later: GridLink = { itemKey: "k", state: "SCHEDULED", scheduledFor: "2026-12-01T12:00:00Z" };
    expect(cellStatus(column("12/1"), later, undefined, NOW)).toBe("scheduled");
    expect(cellStatus(column("10/1"), undefined, undefined, NOW)).toBe("scheduled");
  });

  it("treats a scheduled post as posted once its time has passed", () => {
    const past: GridLink = { itemKey: "k", state: "SCHEDULED", scheduledFor: "2026-10-05T11:00:00Z" };
    expect(cellStatus(column("10/5"), past, undefined, NOW)).toBe("missing");
  });
});

describe("studentOverall", () => {
  it("is the share handed in of what has been posted", () => {
    expect(studentOverall(["turned-in", "late", "returned", "missing", "scheduled"])).toBe(75);
    expect(studentOverall(["not-yet", "scheduled"])).toBe(0);
  });

  it("has nothing to say before anything is posted", () => {
    expect(studentOverall(["scheduled"])).toBeNull();
  });
});

describe("diffRows", () => {
  const key = (r: { id: string }) => r.id;

  it("writes only what changed and removes what is gone", () => {
    const { upsert, remove } = diffRows(
      [{ id: "a", v: 1 }, { id: "b", v: 1 }, { id: "c", v: 1 }],
      [{ id: "a", v: 1 }, { id: "b", v: 2 }, { id: "d", v: 1 }],
      key
    );
    expect(upsert.map(key)).toEqual(["b", "d"]);
    expect(remove.map(key)).toEqual(["c"]);
  });

  it("does nothing when nothing changed", () => {
    expect(diffRows([{ id: "a", v: 1 }], [{ id: "a", v: 1 }], key)).toEqual({ upsert: [], remove: [] });
  });
});
