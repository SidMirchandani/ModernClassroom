import { describe, expect, it } from "vitest";
import type { CurriculumUnit } from "../db/types";
import { curriculumView, dayLabel, externalColumns, visibleColumns } from "./edits";
import { gridColumns, type GridLink } from "./grid";

/** Written from a local date, so the test reads the same in any time zone. */
const on = (month: number, day: number) => new Date(2026, month - 1, day, 23, 59).toISOString();

const unit: CurriculumUnit = {
  id: "u3",
  title: "Unit 3",
  subunits: [
    {
      id: "3.1",
      title: "Slope",
      date: "10/5",
      objectives: [],
      tracks: [
        { id: "t1", kind: "textbook", label: "Textbook", objectives: [], blocks: [] },
        { id: "t2", kind: "guided", label: "Notes", objectives: [], blocks: [] },
      ],
    },
  ],
  checkpoints: [{ id: "q", kind: "quiz", title: "Quiz 3A", date: "10/6", afterSectionId: "3.1" }],
};

function link(itemKey: string, over: Partial<GridLink> = {}): GridLink {
  const fields = { title: itemKey, due: on(10, 5) };
  return { itemKey, state: "PUBLISHED", scheduledFor: null, sent: fields, classroom: fields, ...over };
}

describe("visibleColumns", () => {
  const columns = gridColumns(unit);

  it("drops what was deleted in Classroom", () => {
    const shown = visibleColumns(columns, [link("practice:t1", { state: "GONE" })]);
    expect(shown.map((c) => c.key)).toEqual(["practice:t2", "checkpoint:q"]);
  });

  it("shows a quiz under the title and date it has in Classroom", () => {
    const shown = visibleColumns(columns, [
      link("checkpoint:q", {
        sent: { title: "Quiz 3A", due: on(10, 6) },
        classroom: { title: "Quiz 3A (moved)", due: on(10, 9) },
      }),
    ]);
    expect(shown.at(-1)).toMatchObject({ head: "Quiz 3A (moved)", date: dayLabel(on(10, 9)) });
  });

  it("leaves an unedited item as the curriculum has it", () => {
    const shown = visibleColumns(columns, [link("practice:t1")]);
    expect(shown[0]).toEqual(columns[0]);
  });
});

describe("externalColumns", () => {
  it("lists only what was posted by hand", () => {
    const shown = externalColumns([
      link("practice:t1"),
      link("external:9", { kind: "external", classroom: { title: "Field trip form", due: on(11, 2) } }),
    ]);
    expect(shown).toEqual([
      { key: "external:9", head: "Field trip form", date: dayLabel(on(11, 2)), kind: "checkpoint" },
    ]);
  });
});

describe("curriculumView", () => {
  const moved = { sent: { title: "x", due: on(10, 5) }, classroom: { title: "x", due: on(10, 8) } };

  it("moves a lesson only when all its items moved to the same day", () => {
    const one = curriculumView([unit], [link("practice:t1", moved), link("practice:t2")]);
    expect(one.units[0].subunits[0].date).toBe("10/5");

    const both = curriculumView([unit], [link("practice:t1", moved), link("practice:t2", moved)]);
    expect(both.units[0].subunits[0].date).toBe(dayLabel(on(10, 8)));
    expect(both.edits).toBe(1);
  });

  it("marks a lesson gone only when every item is", () => {
    const some = curriculumView([unit], [link("practice:t1", { state: "GONE" }), link("practice:t2")]);
    expect(some.gone.has("3.1")).toBe(false);

    const all = curriculumView(
      [unit],
      [link("practice:t1", { state: "GONE" }), link("practice:t2", { state: "GONE" })]
    );
    expect(all.gone.has("3.1")).toBe(true);
  });

  it("takes a renamed unit and quiz from Classroom without touching the curriculum", () => {
    const view = curriculumView(
      [unit],
      [
        link("unit:u3", { kind: "topic", sent: { title: "Unit 3" }, classroom: { title: "Lines" } }),
        link("checkpoint:q", { sent: { title: "Quiz 3A", due: on(10, 6) }, classroom: { title: "Pop quiz", due: on(10, 6) } }),
      ]
    );
    expect(view.units[0].title).toBe("Lines");
    expect(view.units[0].checkpoints[0].title).toBe("Pop quiz");
    expect(unit.title).toBe("Unit 3");
    expect(view.edits).toBe(2);
  });
});
