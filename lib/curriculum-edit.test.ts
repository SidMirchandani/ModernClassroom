import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  insertSubunit,
  nextReference,
  removeSubunit,
  shiftDateText,
  shiftUnit,
} from "./curriculum-edit";
import type { CurriculumUnit } from "./db/types";

/**
 * The hand edits that replaced asking the chat. What matters: dates land on
 * school days in the right year, a new subunit looks like its neighbours,
 * and inserting one never loses the work filed under the ones it pushes along.
 */

// A Thursday in October of the 2026–27 school year. The clock is pinned to
// it, so which year "3/22" falls in — and so its weekday — never drifts.
const TODAY = new Date(2026, 9, 15);
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});
afterAll(() => {
  vi.useRealTimers();
});

describe("shiftDateText", () => {
  it("moves by school days, over weekends and into the spring", () => {
    expect(shiftDateText("10/16", 1, TODAY)).toBe("10/19"); // Fri → Mon
    expect(shiftDateText("10/19", -1, TODAY)).toBe("10/16"); // Mon → Fri
    expect(shiftDateText("3/22", 2, TODAY)).toBe("3/24"); // spring 2027
  });

  it("moves every date in the text, and the weekday with it", () => {
    expect(shiftDateText("10/12 or 10/13", 1, TODAY)).toBe("10/13 or 10/14");
    expect(shiftDateText("Fri 10/16", 1, TODAY)).toBe("Mon 10/19");
    expect(shiftDateText("TBD", 3, TODAY)).toBe("TBD");
  });
});

describe("nextReference", () => {
  const titles = ["Steep Steps", "Oblique Triangles"];
  it("continues references that run in step", () => {
    expect(nextReference(["Ch 12.5", "Ch 12.6"], titles, "New")).toBe("Ch 12.7");
    expect(nextReference(["Unit 12 Lesson 5", "Unit 12 Lesson 6"], titles, "New")).toBe("Unit 12 Lesson 7");
  });

  it("names an activity after its lesson when that is the pattern", () => {
    expect(nextReference(["Steep Steps", "Oblique Triangles"], titles, "Unit Circle")).toBe("Unit Circle");
  });

  it("guesses nothing when there is no clear pattern", () => {
    expect(nextReference(["Ch 3.2 – Forms", "Ch 11 – Least Squares"], titles, "New")).toBeNull();
    expect(nextReference(["Ch 12.4", "Ch 12.6"], titles, "New")).toBeNull();
    expect(nextReference(["", ""], titles, "New")).toBeNull();
  });
});

function unit(): CurriculumUnit {
  const section = (n: number, title: string, date: string) => ({
    id: `10.${n}`,
    title,
    date,
    objectives: [],
    tracks: [
      {
        id: `10.${n}::textbook`,
        kind: "textbook" as const,
        label: "Next-Gen Textbook",
        reference: `Ch 12.${n}`,
        objectives: [],
        blocks: [
          { id: `10.${n}-l`, type: "learn" as const, title: `Ch 12.${n}`, description: "", attachments: [] },
          {
            id: `10.${n}-p`,
            type: "practice" as const,
            title: "Practice",
            description: `Assigned practice for Ch 12.${n}.`,
            attachments: [],
          },
        ],
      },
    ],
  });
  return {
    id: "u10",
    title: "Unit 10: Trigonometry",
    subunits: [section(1, "Steep Steps", "3/12"), section(2, "Oblique Triangles", "3/15"), section(3, "Around the Corner", "3/16")],
    checkpoints: [{ id: "t", kind: "test", title: "Unit 10 Test", date: "3/25", afterSectionId: "10.3" }],
  };
}

describe("insertSubunit", () => {
  it("adds one in the class's format and pushes the rest along, work and all", () => {
    const result = insertSubunit([unit()], "u10", "10.2", { title: "Law of Sines" })!;
    const sections = result.units[0].subunits;
    expect(sections.map((s) => [s.id, s.title])).toEqual([
      ["10.1", "Steep Steps"],
      ["10.2", "Oblique Triangles"],
      ["10.3", "Law of Sines"],
      ["10.4", "Around the Corner"],
    ]);
    // Next school day after 3/15 (a Monday in 2027).
    expect(sections[2].date).toBe("3/16");
    // "Ch 12.3" is the next number — but it belongs to the lesson pushed
    // along, so the new one is left for the teacher to point at.
    expect(sections[2].tracks[0].reference).toBe("");
    // Practice's fixed title is still the class's; nothing needs a reference
    // to be "Practice". Learn and the instructions do, so they wait.
    expect(sections[2].tracks[0].blocks.map((b) => b.type)).toEqual([]);
    // The section that moved takes its work and its test with it.
    expect(result.remaps).toEqual([{ from: "10.3", to: "10.4" }]);
    expect(sections[3].tracks[0].id).toBe("10.3::textbook");
    expect(result.units[0].checkpoints[0].afterSectionId).toBe("10.4");
  });

  it("adds at the end without renumbering anything, in the class's format", () => {
    const result = insertSubunit([unit()], "u10", "10.3", { title: "Review", date: "3/18" })!;
    expect(result.id).toBe("10.4");
    expect(result.remaps).toEqual([]);
    const added = result.units[0].subunits[3];
    expect(added.date).toBe("3/18");
    expect(added.tracks[0].reference).toBe("Ch 12.4");
    expect(added.tracks[0].blocks.map((b) => [b.type, b.title, b.description])).toEqual([
      ["learn", "Ch 12.4", ""],
      ["practice", "Practice", "Assigned practice for Ch 12.4."],
    ]);
  });
});

describe("after a removal", () => {
  it("numbers a new subunit past the highest, never onto one in use", () => {
    const gapped = removeSubunit([unit()], "10.2");
    const result = insertSubunit(gapped, "u10", "10.1", { title: "New" })!;
    expect(result.id).toBe("10.4");
    expect(result.units[0].subunits.map((s) => s.id)).toEqual(["10.1", "10.4", "10.3"]);
    expect(result.remaps).toEqual([]);
  });
});

describe("removeSubunit", () => {
  it("keeps a test that sat after it, on the subunit before", () => {
    const next = removeSubunit([unit()], "10.3");
    expect(next[0].subunits.map((s) => s.id)).toEqual(["10.1", "10.2"]);
    expect(next[0].checkpoints[0].afterSectionId).toBe("10.2");
  });
});

describe("shiftUnit", () => {
  it("moves every subunit and test in the unit together", () => {
    const next = shiftUnit([unit()], "u10", 1);
    expect(next[0].subunits.map((s) => s.date)).toEqual(["3/15", "3/16", "3/17"]);
    expect(next[0].checkpoints[0].date).toBe("3/26");
  });
});
