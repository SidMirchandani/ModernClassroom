import { describe, expect, it } from "vitest";
import { classHasStarted, getCurrentUnitIndexByDate, getUnitPhase } from "./unit-phase";

const lesson = (date?: string) => ({ id: "1.1", title: "x", date, objectives: [], tracks: [] });
const units = [{ subunits: [lesson("9/14")] }, { subunits: [lesson("10/12")] }, { subunits: [lesson("11/20")] }];

describe("classHasStarted", () => {
  it("is false before the first lesson", () => {
    expect(classHasStarted(units, new Date(2026, 8, 1))).toBe(false);
  });
  it("is true from the first lesson on, with nobody enrolled here", () => {
    expect(classHasStarted(units, new Date(2026, 8, 14))).toBe(true);
    expect(classHasStarted(units, new Date(2026, 9, 21))).toBe(true);
  });
  it("counts a class with no dates as started", () => {
    expect(classHasStarted([{ subunits: [lesson()] }], new Date(2026, 8, 1))).toBe(true);
  });
});

describe("the label a unit gets mid-year", () => {
  it("reads finished, active and upcoming from the calendar", () => {
    const today = new Date(2026, 9, 21);
    const current = getCurrentUnitIndexByDate(units, today);
    const started = classHasStarted(units, today);
    expect(units.map((_, i) => getUnitPhase(i, current, started))).toEqual(["finished", "active", "upcoming"]);
  });
});
