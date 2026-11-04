import { describe, expect, it } from "vitest";
import { isUnreturned, markOf, parseMark, parsePoints, unreturnedIn } from "./grades";
import type { CachedSubmission } from "./grid";

function work(over: Partial<CachedSubmission> = {}): CachedSubmission {
  return { userId: "s1", itemKey: "a", state: "TURNED_IN", late: false, assignedGrade: null, draftGrade: null, ...over };
}

describe("parseMark", () => {
  it("reads a mark, including zero and decimals", () => {
    expect(parseMark("18")).toEqual({ ok: true, mark: 18 });
    expect(parseMark("0")).toEqual({ ok: true, mark: 0 });
    expect(parseMark(" 9.5 ")).toEqual({ ok: true, mark: 9.5 });
  });
  it("treats empty as clearing it", () => {
    expect(parseMark("  ")).toEqual({ ok: true, mark: null });
  });
  it("refuses what isn't a mark", () => {
    expect(parseMark("abc")).toEqual({ ok: false });
    expect(parseMark("-1")).toEqual({ ok: false });
  });
  it("allows extra credit above the total", () => {
    expect(parseMark("105")).toEqual({ ok: true, mark: 105 });
  });
});

describe("parsePoints", () => {
  it("takes whole points above zero only", () => {
    expect(parsePoints("20")).toBe(20);
    expect(parsePoints("0")).toBeNull();
    expect(parsePoints("2.5")).toBeNull();
    expect(parsePoints("")).toBeNull();
  });
});

describe("markOf", () => {
  it("shows the latest typed mark over the returned one", () => {
    expect(markOf(work({ assignedGrade: 80, draftGrade: 90 }))).toBe(90);
  });
  it("shows a mark given in Classroom with no draft", () => {
    expect(markOf(work({ assignedGrade: 80 }))).toBe(80);
  });
  it("keeps a zero, which is a mark", () => {
    expect(markOf(work({ draftGrade: 0 }))).toBe(0);
  });
  it("is empty with no mark or no work", () => {
    expect(markOf(work())).toBeNull();
    expect(markOf(undefined)).toBeNull();
  });
});

describe("isUnreturned", () => {
  it("is true for a draft the student hasn't got", () => {
    expect(isUnreturned(work({ draftGrade: 18 }))).toBe(true);
  });
  it("is true for a changed mark after returning", () => {
    expect(isUnreturned(work({ state: "RETURNED", assignedGrade: 18, draftGrade: 20 }))).toBe(true);
  });
  it("is false once returned, or with no draft", () => {
    expect(isUnreturned(work({ state: "RETURNED", assignedGrade: 18, draftGrade: 18 }))).toBe(false);
    expect(isUnreturned(work({ assignedGrade: 18 }))).toBe(false);
    expect(isUnreturned(undefined)).toBe(false);
  });
});

describe("unreturnedIn", () => {
  it("counts only that column's unreturned marks", () => {
    const rows = [
      work({ userId: "a", draftGrade: 1 }),
      work({ userId: "b" }),
      work({ userId: "c", itemKey: "other", draftGrade: 1 }),
    ];
    expect(unreturnedIn("a", rows).map((s) => s.userId)).toEqual(["a"]);
  });
});
