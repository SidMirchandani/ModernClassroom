import { describe, expect, it } from "vitest";
import type { ClassroomWork } from "./api";
import { classroomCurriculum } from "./curriculum";
import { curriculumView } from "./edits";
import { adoptionLinks, planSync, plannedItems, removals } from "./plan";

let id = 0;
function item(title: string, over: Partial<ClassroomWork> = {}): ClassroomWork {
  id++;
  return { id: `i${id}`, kind: "assignment", title, state: "PUBLISHED", scheduledFor: null, own: false, ...over };
}
const build = (work: ClassroomWork[], topics: { id: string; name: string }[] = [], tz = "UTC") =>
  classroomCurriculum(work, topics, tz);

describe("classroomCurriculum", () => {
  it("makes each topic a unit and keeps the numbers it already has", () => {
    const { units, items, topics } = build(
      [item("4.2 Intercepts", { topicId: "t" }), item("4.1 Slope", { topicId: "t" })],
      [{ id: "t", name: "Unit 4: Linear Functions" }]
    );
    expect(units.map((u) => u.title)).toEqual(["Unit 4: Linear Functions"]);
    expect(units[0].subunits.map((s) => [s.id, s.title])).toEqual([["4.1", "Slope"], ["4.2", "Intercepts"]]);
    expect([items, topics]).toEqual([2, 1]);
  });

  it("numbers topics and lessons that have no numbers", () => {
    const { units } = build(
      [
        item("Slope", { topicId: "a", created: "2026-09-01T00:00:00Z" }),
        item("Graphs", { topicId: "b", created: "2026-10-01T00:00:00Z" }),
        item("Intercepts", { topicId: "a", created: "2026-09-08T00:00:00Z" }),
      ],
      [{ id: "b", name: "Graphing" }, { id: "a", name: "Linear" }]
    );
    expect(units.map((u) => u.title)).toEqual(["Unit 1: Linear", "Unit 2: Graphing"]);
    expect(units[0].subunits.map((s) => s.id)).toEqual(["1.1", "1.2"]);
  });

  it("orders numbered topics by number, whatever order Classroom lists them in", () => {
    const { units } = build(
      [item("a", { topicId: "t10", created: "2026-09-01" }), item("b", { topicId: "t2", created: "2026-10-01" })],
      [{ id: "t10", name: "Unit 10: Later" }, { id: "t2", name: "Unit 2: Earlier" }]
    );
    expect(units.map((u) => u.title)).toEqual(["Unit 2: Earlier", "Unit 10: Later"]);
  });

  it("makes quizzes, tests and projects checkpoints, placed after the lesson before them", () => {
    const { units } = build(
      [
        item("1.1 Slope", { topicId: "t", due: "2026-09-01T12:00:00Z" }),
        item("Quiz 1", { topicId: "t", due: "2026-09-05T12:00:00Z", maxPoints: 20 }),
        item("1.2 Intercepts", { topicId: "t", due: "2026-09-08T12:00:00Z" }),
        item("Unit 1 Test", { topicId: "t", due: "2026-09-12T12:00:00Z" }),
        item("Unit 1 Project", { topicId: "t", due: "2026-09-13T12:00:00Z" }),
      ],
      [{ id: "t", name: "Unit 1" }]
    );
    expect(units[0].checkpoints.map((c) => [c.kind, c.title, c.afterSectionId, c.maxPoints])).toEqual([
      ["quiz", "Quiz 1", "1.1", 20],
      ["test", "Unit 1 Test", "1.2", undefined],
      ["project", "Unit 1 Project", "1.2", undefined],
    ]);
    expect(units[0].subunits).toHaveLength(2);
  });

  it("does not mistake a review or a material for a checkpoint", () => {
    const { units } = build([item("Quiz 1 Review"), item("Test notes", { kind: "material" })]);
    expect(units[0].checkpoints).toEqual([]);
    expect(units[0].subunits).toHaveLength(2);
  });

  it("makes items numbered the same one lesson", () => {
    const { units } = build(
      [
        item("4.1 Notes", { topicId: "t", kind: "material", created: "2026-09-01" }),
        item("4.1 Homework", { topicId: "t", due: "2026-09-03T12:00:00Z", created: "2026-09-02" }),
      ],
      [{ id: "t", name: "Unit 4" }]
    );
    expect(units[0].subunits).toHaveLength(1);
    expect(units[0].subunits[0].tracks.map((t) => t.label)).toEqual(["4.1 Notes", "4.1 Homework"]);
    expect(units[0].subunits[0].date).toBe("9/3");
  });

  it("keeps a lesson whose number belongs to another unit, under a number of its own", () => {
    const { units } = build([item("5.2 Stray", { topicId: "t" })], [{ id: "t", name: "Unit 4" }]);
    expect(units[0].subunits.map((s) => [s.id, s.title])).toEqual([["4.1", "5.2 Stray"]]);
  });

  it("puts work with no topic last, in a unit of its own", () => {
    const { units, topics } = build(
      [item("Welcome"), item("1.1 Slope", { topicId: "t" }), item("Gone", { topicId: "deleted" })],
      [{ id: "t", name: "Unit 1: Linear" }]
    );
    expect(units.map((u) => u.title)).toEqual(["Unit 1: Linear", "Unit 2: Not in a topic"]);
    expect(units[1].subunits).toHaveLength(2);
    expect(topics).toBe(1);
  });

  it("does not trust numbers two topics share", () => {
    const { units } = build(
      [item("a", { topicId: "x", created: "2026-09-01" }), item("b", { topicId: "y", created: "2026-09-02" })],
      [{ id: "x", name: "1 Algebra" }, { id: "y", name: "1 Geometry" }]
    );
    expect(units.map((u) => u.title)).toEqual(["Unit 1: 1 Algebra", "Unit 2: 1 Geometry"]);
  });

  it("gives every lesson a different id, across the whole class", () => {
    const work = Array.from({ length: 104 }, (_, i) =>
      item(i % 2 ? `${(i % 12) + 1}.${i % 7} Lesson` : `Lesson ${i}`, { topicId: `t${i % 12}` })
    );
    const topics = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, name: `Topic ${i + 1}` }));
    const { units } = build(work, topics);
    const ids = units.flatMap((u) => u.subunits.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(units).toHaveLength(12);
  });

  it("gives a due date on the teacher's calendar, not UTC's", () => {
    const { units } = build([item("Slope", { due: "2026-10-13T03:59:00.000Z" })], [], "America/New_York");
    expect(units[0].subunits[0].date).toBe("10/12");
  });

  it("builds nothing from an empty class", () => {
    expect(build([], [{ id: "t", name: "Unit 1" }])).toEqual({ units: [], items: 0, topics: 0 });
  });

  it("gives the same ids when done twice", () => {
    const work = [item("Slope", { topicId: "t" })];
    expect(build(work, [{ id: "t", name: "Linear" }])).toEqual(build(work, [{ id: "t", name: "Linear" }]));
  });
});

describe("adoptionLinks", () => {
  const NOW = new Date("2026-10-01T12:00:00Z");
  const FUTURE = "2026-10-20T12:00:00Z";
  const { units } = build(
    [
      item("1.1 Slope", { topicId: "t", due: FUTURE }),
      item("1.2 Notes", { topicId: "t", kind: "material" }),
      item("1.2 Homework", { topicId: "t", due: FUTURE }),
      item("Quiz 1", { topicId: "t", due: FUTURE }),
      item("Welcome"),
    ],
    [{ id: "t", name: "Unit 1: Linear" }]
  );
  const adopted = () => adoptionLinks(units, new Set(), NOW);
  const input = (u = units, links = adopted()) => ({
    units: u,
    rule: "lesson_day" as const,
    links,
    now: NOW,
    timeZone: "America/New_York",
  });

  it("leaves the sync nothing to post, whatever the posting rule or time zone", () => {
    expect(planSync(input())).toEqual([]);
    expect(planSync({ ...input(), rule: "unit_start" })).toEqual([]);
    expect(planSync({ ...input(), timeZone: "Asia/Tokyo" })).toEqual([]);
  });

  it("links a unit to the real topic it came from, and nothing else to anything real", () => {
    const links = adopted();
    expect(links.find((l) => l.kind === "topic" && l.state === "PUBLISHED")?.classroomId).toBe("t");
    expect(links.filter((l) => l.kind !== "topic").every((l) => l.state === "GONE")).toBe(true);
    expect(links.filter((l) => l.state === "GONE").every((l) => l.classroomId.startsWith("from-classroom:"))).toBe(true);
  });

  it("still posts a lesson added afterwards, under its topic's link", () => {
    const later = structuredClone(units);
    later[0].subunits.push({ id: "1.3", title: "New", objectives: [], tracks: [] });
    expect(planSync(input(later)).map((op) => op.item.key)).toEqual(["lesson:1.3"]);
  });

  it("only adds links for items without one", () => {
    const keys = new Set(plannedItems({ units, rule: "lesson_day", now: NOW, timeZone: "UTC" }).map((p) => p.key));
    expect(adoptionLinks(units, keys, NOW)).toEqual([]);
  });

  it("deletes nothing of the teacher's when a lesson is dropped later", () => {
    const fewer = structuredClone(units);
    fewer[0].subunits.shift();
    const gone = removals(adopted(), plannedItems({ ...input(fewer) }));
    expect(gone.work).toEqual([]);
    expect(gone.forget.map((l) => l.itemKey).length).toBeGreaterThan(0);
  });

  it("does not show adopted lessons as deleted or edited in Classroom", () => {
    const view = curriculumView(units, adopted());
    expect(view.gone.size).toBe(0);
    expect(view.edits).toBe(0);
  });
});
