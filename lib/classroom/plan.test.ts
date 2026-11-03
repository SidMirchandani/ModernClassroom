import { describe, expect, it } from "vitest";
import type { CurriculumUnit } from "../db/types";
import type { ResourceTrack } from "../types";
import {
  parseCurriculumDate,
  planSync,
  plannedItems,
  tidy,
  zonedInstant,
  type ClassroomLink,
  type PlannedWork,
  type PostingRule,
} from "./plan";

/**
 * The plan is the whole of "what does Classroom get": which items exist, which
 * stay unpublished behind the gate, which are scheduled for when, and what a
 * re-run changes. The network side only carries these calls out.
 */

const NOW = new Date("2026-10-01T12:00:00Z");
const TZ = "America/New_York";

function track(id: string, label: string, steps: ("learn" | "practice")[]): ResourceTrack {
  return {
    id,
    kind: "textbook",
    label,
    objectives: [],
    blocks: steps.map((type) => ({
      id: `${id}-${type}`,
      type,
      title: type === "learn" ? "Read 2.1" : "Problems 1–20",
      attachments:
        type === "learn" ? [{ id: "a", kind: "link", url: "https://example.org/notes" }] : [],
    })),
  };
}

function units(): CurriculumUnit[] {
  return [
    {
      id: "u3",
      title: "Unit 3: Linear Functions",
      subunits: [
        { id: "3.1", title: "Slope", date: "9/28", objectives: [], tracks: [track("3.1::textbook", "Textbook", ["learn", "practice"])] },
        { id: "3.2", title: "Intercepts", date: "10/5", objectives: [], tracks: [track("3.2::textbook", "Textbook", ["learn", "practice"])] },
      ],
      checkpoints: [{ id: "q3a", kind: "quiz", title: "Quiz 3A", date: "10/6", afterSectionId: "3.2", maxPoints: 20 }],
    },
    {
      id: "u4",
      title: "Unit 4: Systems",
      subunits: [
        { id: "4.1", title: "Graphing systems", date: "10/12", objectives: [], tracks: [track("4.1::textbook", "Textbook", ["practice"])] },
      ],
      checkpoints: [],
    },
  ];
}

function plan(rule: PostingRule = "lesson_day") {
  return plannedItems({ units: units(), rule, now: NOW, timeZone: TZ });
}

function work(key: string, items = plan()): PlannedWork {
  const found = items.find((i) => i.key === key);
  if (!found || found.kind === "topic") throw new Error(`no work item ${key}`);
  return found;
}

describe("parseCurriculumDate", () => {
  it("places a month/day in the school year the date falls in", () => {
    expect(parseCurriculumDate("10/14", NOW)).toEqual({ year: 2026, month: 10, day: 14 });
    expect(parseCurriculumDate("3/2", NOW)).toEqual({ year: 2027, month: 3, day: 2 });
    expect(parseCurriculumDate("9/3", new Date("2027-03-01T00:00:00Z"))).toEqual({ year: 2026, month: 9, day: 3 });
  });

  it("takes the first date of free text and refuses nonsense", () => {
    expect(parseCurriculumDate("Tue 10/12 or 10/13", NOW)).toEqual({ year: 2026, month: 10, day: 12 });
    expect(parseCurriculumDate("TBD", NOW)).toBeNull();
    expect(parseCurriculumDate("13/40", NOW)).toBeNull();
    expect(parseCurriculumDate(undefined, NOW)).toBeNull();
  });
});

describe("zonedInstant", () => {
  it("turns a local wall-clock time into the right instant, either side of daylight saving", () => {
    expect(zonedInstant({ year: 2026, month: 10, day: 14 }, { hours: 7, minutes: 0 }, TZ).toISOString())
      .toBe("2026-10-14T11:00:00.000Z");
    expect(zonedInstant({ year: 2026, month: 12, day: 14 }, { hours: 7, minutes: 0 }, TZ).toISOString())
      .toBe("2026-12-14T12:00:00.000Z");
  });
});

describe("plannedItems: the mapping", () => {
  it("makes one topic per unit, a material per Learn and an assignment per Practice and checkpoint", () => {
    const items = plan();
    expect(items.filter((i) => i.kind === "topic").map((i) => i.key)).toEqual(["unit:u4", "unit:u3"]);
    expect(work("learn:3.1::textbook").kind).toBe("material");
    expect(work("practice:3.1::textbook").kind).toBe("assignment");
    expect(work("checkpoint:q3a")).toMatchObject({ kind: "assignment", maxPoints: 20, title: "Quiz 3A" });
    // 4.1 has no Learn block, so no material for it.
    expect(items.some((i) => i.key === "learn:4.1::textbook")).toBe(false);
  });

  it("titles items by section and resource, and carries the links", () => {
    const learn = work("learn:3.1::textbook");
    expect(learn.title).toBe("3.1 Slope · Textbook (Learn)");
    expect(learn.links).toEqual(["https://example.org/notes"]);
    expect(learn.topicKey).toBe("unit:u3");
  });

  it("lists each unit's work last lesson first, so Classroom reads first lesson down", () => {
    const keys = plan().filter((i) => i.kind !== "topic" && i.topicKey === "unit:u3").map((i) => i.key);
    expect(keys).toEqual([
      "checkpoint:q3a",
      "practice:3.2::textbook",
      "learn:3.2::textbook",
      "practice:3.1::textbook",
      "learn:3.1::textbook",
    ]);
  });

  it("puts a due date only on work still due", () => {
    expect(work("practice:3.1::textbook").due).toBeUndefined(); // 9/28 is past
    expect(work("practice:3.2::textbook").due).toEqual({
      date: { year: 2026, month: 10, day: 6 },
      time: { hours: 3, minutes: 59 },
    }); // 11:59 pm on 10/5 in New York
    expect(work("learn:3.2::textbook").due).toBeUndefined();
  });
});

describe("plannedItems: the posting rule", () => {
  it("on the lesson day: past lessons publish now, future ones are scheduled for 7am", () => {
    expect(work("learn:3.1::textbook").target).toEqual({ state: "PUBLISHED" });
    expect(work("learn:3.2::textbook").target).toEqual({ state: "SCHEDULED", at: "2026-10-05T11:00:00.000Z" });
    expect(work("checkpoint:q3a").target).toEqual({ state: "SCHEDULED", at: "2026-10-06T11:00:00.000Z" });
  });

  it("when the unit starts: the whole unit shares its first lesson's date", () => {
    const items = plan("unit_start");
    expect(work("learn:3.2::textbook", items).target).toEqual({ state: "PUBLISHED" }); // unit 3 began 9/28
    expect(work("practice:4.1::textbook", items).target).toEqual({ state: "SCHEDULED", at: "2026-10-12T11:00:00.000Z" });
  });
});

describe("planSync: what a re-run changes", () => {
  function link(itemKey: string, state: ClassroomLink["state"], scheduledFor: string | null = null): ClassroomLink {
    return { itemKey, kind: itemKey.startsWith("unit:") ? "topic" : "assignment", classroomId: `gc-${itemKey}`, state, scheduledFor };
  }

  it("creates everything on a first run, topics before their work", () => {
    const ops = planSync({ units: units(), rule: "lesson_day", links: [], now: NOW, timeZone: TZ });
    expect(ops.every((o) => o.type === "create")).toBe(true);
    expect(ops.slice(0, 2).map((o) => o.item.kind)).toEqual(["topic", "topic"]);
  });

  it("changing the rule moves scheduled posts to their new dates", () => {
    const links = plannedItems({ units: units(), rule: "lesson_day", now: NOW, timeZone: TZ })
      .map((i) =>
        i.kind === "topic"
          ? link(i.key, "PUBLISHED")
          : link(i.key, i.target.state, i.target.state === "SCHEDULED" ? i.target.at : null)
      );
    // Unit 3 began 9/28, so under "when the unit starts" its later lessons post now.
    const ops = planSync({ units: units(), rule: "unit_start", links, now: NOW, timeZone: TZ });
    expect(ops.map((o) => [o.type, o.item.key])).toEqual([
      ["update", "checkpoint:q3a"],
      ["update", "practice:3.2::textbook"],
      ["update", "learn:3.2::textbook"],
    ]);
  });

  it("leaves published items alone and never recreates one deleted in Classroom", () => {
    const ops = planSync({
      units: units(),
      rule: "lesson_day",
      links: [link("unit:u3", "PUBLISHED"), link("learn:3.1::textbook", "GONE"), link("practice:3.2::textbook", "PUBLISHED")],
      now: NOW,
      timeZone: TZ,
    });
    const keys = ops.map((o) => o.item.key);
    expect(keys).not.toContain("unit:u3");
    expect(keys).not.toContain("learn:3.1::textbook");
    expect(keys).not.toContain("practice:3.2::textbook");
    expect(keys).toContain("practice:3.1::textbook");
  });

  it("does nothing when Classroom already matches", () => {
    const links = plannedItems({ units: units(), rule: "lesson_day", now: NOW, timeZone: TZ })
      .map((i) =>
        i.kind === "topic"
          ? link(i.key, "PUBLISHED")
          : link(i.key, i.target.state, i.target.state === "SCHEDULED" ? i.target.at : null)
      );
    expect(planSync({ units: units(), rule: "lesson_day", links, now: NOW, timeZone: TZ })).toEqual([]);
  });
});

describe("plannedItems: lessons with nothing written into them yet", () => {
  // How an imported plan usually arrives: titles, dates, the resources' names.
  function bare(): CurriculumUnit[] {
    return [
      {
        id: "u1",
        title: "Unit 1: Sequences",
        subunits: [
          {
            id: "1.2",
            title: "Rebound",
            date: "10/7",
            objectives: [],
            tracks: [
              { id: "1.2::textbook", kind: "textbook", label: "Next-Gen", reference: "Ch 1.2", objectives: [], blocks: [] },
              { id: "1.2::custom", kind: "custom", label: "Delta Math", objectives: [], blocks: [] },
            ],
          },
          { id: "1.3", title: "Doses of Medicine", date: "10/8", objectives: [], tracks: [] },
        ],
        checkpoints: [],
      },
    ];
  }

  const items = () => plannedItems({ units: bare(), rule: "lesson_day", now: NOW, timeZone: TZ });

  it("posts one assignment per resource, under its Practice key", () => {
    const nextGen = work("practice:1.2::textbook", items());
    expect(nextGen).toMatchObject({ kind: "assignment", title: "1.2 Rebound · Next-Gen", description: "Ch 1.2" });
    expect(work("practice:1.2::custom", items()).title).toBe("1.2 Rebound · Delta Math");
    expect(items().some((i) => i.key === "learn:1.2::textbook")).toBe(false);
  });

  it("posts a lesson that names no resource as one assignment", () => {
    expect(work("lesson:1.3", items())).toMatchObject({ kind: "assignment", title: "1.3 Doses of Medicine" });
  });

  it("dates and schedules them like any other lesson", () => {
    expect(work("practice:1.2::textbook", items())).toMatchObject({
      due: { date: { year: 2026, month: 10, day: 8 }, time: { hours: 3, minutes: 59 } },
      target: { state: "SCHEDULED", at: "2026-10-07T11:00:00.000Z" },
    });
  });

  it("gives a unit with only bare lessons a topic", () => {
    expect(items().filter((i) => i.kind === "topic").map((i) => i.key)).toEqual(["unit:u1"]);
  });
});

describe("tidy: squaring Classroom with the links", () => {
  const planned = () => plannedItems({ units: units(), rule: "lesson_day", now: NOW, timeZone: TZ });
  const topics = new Map([["unit:u3", "t3"], ["unit:u4", "t4"]]);
  const own = (id: string, title: string, topicId: string, kind: "assignment" | "material" = "assignment") =>
    ({ id, kind, title, topicId, state: "PUBLISHED" as const, scheduledFor: null });
  const linkTo = (itemKey: string, classroomId: string): ClassroomLink =>
    ({ itemKey, kind: "assignment", classroomId, state: "PUBLISHED", scheduledFor: null });

  it("removes a second copy of a tracked item, and only that", () => {
    const result = tidy(
      [own("a", "Quiz 3A", "t3"), own("b", "Quiz 3A", "t3"), own("c", "Quiz 3A", "t4")],
      [linkTo("checkpoint:q3a", "a")],
      planned(),
      topics
    );
    expect(result.remove.map((o) => o.id)).toEqual(["b"]);
    expect(result.adopt).toEqual([]);
  });

  it("records an item we made but never saved, instead of posting it again", () => {
    const result = tidy([own("x", "Quiz 3A", "t3")], [], planned(), topics);
    expect(result.adopt.map((a) => [a.item.key, a.own.id])).toEqual([["checkpoint:q3a", "x"]]);
    expect(planSync({ units: units(), rule: "lesson_day", now: NOW, timeZone: TZ,
      links: [linkTo("checkpoint:q3a", "x")] }).some((o) => o.item.key === "checkpoint:q3a")).toBe(false);
  });

  it("adopts one of several untracked twins and removes the rest", () => {
    const result = tidy([own("x", "Quiz 3A", "t3"), own("y", "Quiz 3A", "t3")], [], planned(), topics);
    expect(result.adopt.map((a) => a.own.id)).toEqual(["x"]);
    expect(result.remove.map((o) => o.id)).toEqual(["y"]);
  });

  it("leaves anything it does not recognise alone", () => {
    const result = tidy([own("z", "Something else", "t3")], [], planned(), topics);
    expect(result).toEqual({ adopt: [], remove: [] });
  });
});
