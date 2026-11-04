import { describe, expect, it } from "vitest";
import type { CurriculumUnit } from "../db/types";
import type { ResourceTrack } from "../types";
import {
  absorb,
  baselines,
  parseCurriculumDate,
  plannedFields,
  rekeys,
  removals,
  sentAfter,
  planSync,
  plannedItems,
  tidy,
  zonedInstant,
  type ClassroomLink,
  type ItemFields,
  type OwnWork,
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

describe("two-way sync", () => {

  /** Every planned item, linked and in step, as a settled class would be. */
  function settled(): ClassroomLink[] {
    return plan().map((item) => ({
      itemKey: item.key,
      kind: item.kind,
      classroomId: `id-${item.key}`,
      state: item.kind === "topic" || item.target.state === "PUBLISHED" ? "PUBLISHED" : "SCHEDULED",
      scheduledFor: item.kind !== "topic" && item.target.state === "SCHEDULED" ? item.target.at : null,
      sent: plannedFields(item),
    }));
  }
  const input = (links: ClassroomLink[], rule: PostingRule = "lesson_day") => ({
    units: units(),
    rule,
    links,
    now: NOW,
    timeZone: TZ,
  });
  const edit = (links: ClassroomLink[], key: string, sent: Partial<ItemFields>) =>
    links.map((l) => (l.itemKey === key ? { ...l, sent: { ...l.sent!, ...sent } } : l));

  it("has nothing to do when the curriculum has not changed", () => {
    expect(planSync(input(settled()))).toEqual([]);
  });

  it("sends a changed title, even to something already posted", () => {
    const ops = planSync(input(edit(settled(), "practice:3.1::textbook", { title: "old" })));
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ type: "update", fields: ["title"] });
  });

  it("sends a changed due date", () => {
    const ops = planSync(input(edit(settled(), "checkpoint:q3a", { due: "2026-10-30T03:59:00.000Z" })));
    expect(ops[0]).toMatchObject({ type: "update", fields: ["due"] });
  });

  it("does not treat a due date passing as an edit", () => {
    const links = edit(settled(), "practice:3.1::textbook", { due: "2026-09-29T03:59:00.000Z" });
    expect(planSync(input(links))).toEqual([]);
  });

  it("clears a due date still ahead when the curriculum no longer has one", () => {
    const links = edit(settled(), "practice:3.1::textbook", { due: "2026-12-01T03:59:00.000Z" });
    expect(planSync(input(links))[0]).toMatchObject({ type: "update", fields: ["due"] });
  });

  it("moves a scheduled item when its date changes, but never a posted one", () => {
    const scheduled = planSync(input(edit(settled(), "practice:3.2::textbook", { postAt: "2026-11-01T11:00:00.000Z" })));
    expect(scheduled[0]).toMatchObject({ type: "update", fields: ["state"] });

    const posted = planSync(input(edit(settled(), "practice:3.1::textbook", { postAt: "2026-11-01T11:00:00.000Z" })));
    expect(posted).toEqual([]);
  });

  it("leaves a teacher's reschedule in Classroom alone", () => {
    const links = settled().map((l) =>
      l.itemKey === "practice:3.2::textbook" ? { ...l, scheduledFor: "2026-12-25T12:00:00.000Z" } : l
    );
    expect(planSync(input(links))).toEqual([]);
  });

  it("leaves a teacher's edit in Classroom alone until the curriculum changes it", () => {
    const edited = settled().map((l) =>
      l.itemKey === "checkpoint:q3a" ? { ...l, classroom: { title: "Pop quiz" } } : l
    );
    expect(planSync(input(edited))).toEqual([]);

    const fileChanged = edit(edited, "checkpoint:q3a", { title: "older" });
    expect(planSync(input(fileChanged))[0]).toMatchObject({ type: "update", fields: ["title"] });
  });

  it("renames a topic when the unit's title changes", () => {
    const ops = planSync(input(edit(settled(), "unit:u3", { title: "old" })));
    expect(ops[0]).toMatchObject({ type: "rename", item: { name: "Unit 3: Linear Functions" } });
  });

  it("never recreates what was deleted in Classroom", () => {
    const links = settled().map((l) => (l.itemKey === "checkpoint:q3a" ? { ...l, state: "GONE" as const } : l));
    expect(planSync(input(links))).toEqual([]);
  });

  it("starts counting edits from now for links made before this existed", () => {
    const old = settled().map((l) => ({ ...l, sent: null }));
    const recorded = baselines(plan(), old);
    expect(recorded).toHaveLength(old.length);
    expect(planSync(input(old.map((l) => recorded.find((r) => r.itemKey === l.itemKey)!)))).toEqual([]);
  });

  describe("absorb", () => {
    const keys = new Set(plan().map((p) => p.key));
    const asOwn = (links: ClassroomLink[]): OwnWork[] =>
      links
        .filter((l) => l.kind !== "topic")
        .map((l) => ({
          id: l.classroomId,
          kind: l.kind as "material" | "assignment",
          title: l.sent!.title,
          state: l.state as OwnWork["state"],
          scheduledFor: l.scheduledFor,
          description: l.sent!.description,
          due: l.sent!.due,
        }));
    const topics = (links: ClassroomLink[]) =>
      links.filter((l) => l.kind === "topic").map((l) => ({ id: l.classroomId, name: l.sent!.title }));

    it("changes nothing when both sides agree, however dates and keys are written", () => {
      const links = settled().map((l) => ({ ...l, classroom: l.sent }));
      const first = absorb(links, asOwn(links), topics(links), keys);
      const inPostgres = links.map((l) => {
        const now = first.find((c) => c.itemKey === l.itemKey) ?? l;
        const c = now.classroom!;
        return {
          ...now,
          scheduledFor: now.scheduledFor ? now.scheduledFor.replace(".000Z", "+00:00") : null,
          classroom: { due: c.due, title: c.title, postAt: c.postAt, description: c.description },
        };
      });
      expect(absorb(inPostgres, asOwn(links), topics(links), keys)).toEqual([]);
    });

    it("marks what is no longer in Classroom as gone", () => {
      const links = settled();
      const own = asOwn(links).filter((o) => o.id !== "id-checkpoint:q3a");
      const changed = absorb(links, own, topics(links), keys);
      expect(changed.find((l) => l.itemKey === "checkpoint:q3a")).toMatchObject({ state: "GONE" });
    });

    it("does not believe an empty answer", () => {
      const links = settled();
      expect(absorb(links, [], [], keys).filter((l) => l.state === "GONE")).toEqual([]);
    });

    it("records an edit and a publish made in Classroom", () => {
      const links = settled();
      const own = asOwn(links).map((o) =>
        o.id === "id-practice:3.2::textbook"
          ? { ...o, title: "Renamed", state: "PUBLISHED" as const, scheduledFor: null }
          : o
      );
      const changed = absorb(links, own, topics(links), keys).find((l) => l.itemKey === "practice:3.2::textbook");
      expect(changed).toMatchObject({ state: "PUBLISHED", scheduledFor: null, classroom: { title: "Renamed" } });
    });

    it("ignores work posted by hand", () => {
      const links: ClassroomLink[] = [
        ...settled(),
        { itemKey: "external:9", kind: "external", classroomId: "9", state: "PUBLISHED", scheduledFor: null },
      ];
      const changed = absorb(links, asOwn(settled()), topics(settled()), keys);
      expect(changed.some((l) => l.itemKey === "external:9")).toBe(false);
    });

    it("brings a kept item back when the curriculum has it again", () => {
      const links = settled().map((l) =>
        l.itemKey === "checkpoint:q3a" ? { ...l, state: "KEPT" as const } : l
      );
      const own = asOwn(settled());
      const back = absorb(links, own, topics(links), keys).find((l) => l.itemKey === "checkpoint:q3a");
      expect(back?.state).not.toBe("KEPT");

      const without = new Set([...keys].filter((k) => k !== "checkpoint:q3a"));
      const stays = absorb(links, own, topics(links), without).find((l) => l.itemKey === "checkpoint:q3a");
      expect(stays?.state).toBe("KEPT");
    });
  });

  it("keeps the due date on record when an update did not touch it", () => {
    const item = work("practice:3.1::textbook");
    const link = settled().find((l) => l.itemKey === item.key)!;
    const past = { ...link, sent: { ...link.sent!, due: "2026-09-29T03:59:00.000Z" } };
    expect(sentAfter(item, past, ["title"]).due).toBe("2026-09-29T03:59:00.000Z");
    expect(sentAfter(item, past, ["due"]).due).toBeNull();
  });

  it("doesn't record a past due date as a teacher's edit on older links", () => {
    const item = work("practice:3.1::textbook");
    const link = settled().find((l) => l.itemKey === item.key)!;
    const older = { ...link, sent: null, classroom: { title: item.title, due: "2026-09-29T03:59:00.000Z" } };
    expect(baselines([item], [older])[0].sent?.due).toBe("2026-09-29T03:59:00.000Z");
  });

  describe("removals", () => {
    const extra = (over: Partial<ClassroomLink>): ClassroomLink => ({
      itemKey: "practice:old",
      kind: "assignment",
      classroomId: "old",
      state: "PUBLISHED",
      scheduledFor: null,
      sent: { title: "9.9 Old" },
      ...over,
    });

    it("finds what the curriculum dropped", () => {
      const links = [...settled(), extra({}), extra({ itemKey: "unit:old", kind: "topic" })];
      const gone = removals(links, plan());
      expect(gone.work.map((l) => l.itemKey)).toEqual(["practice:old"]);
      expect(gone.topics.map((l) => l.itemKey)).toEqual(["unit:old"]);
    });

    it("removes nothing if the plan is empty", () => {
      expect(removals([extra({})], []).work).toEqual([]);
    });

    it("leaves kept and hand-posted items, and forgets deleted ones", () => {
      const gone = removals(
        [
          extra({ state: "KEPT" }),
          extra({ itemKey: "external:1", kind: "external" }),
          extra({ itemKey: "practice:deleted", state: "GONE" }),
        ],
        plan()
      );
      expect(gone.work).toEqual([]);
      expect(gone.forget.map((l) => l.itemKey)).toEqual(["practice:deleted"]);
    });
  });

  describe("rekeys", () => {
    it("keeps a renumbered lesson's Classroom item", () => {
      const item = work("practice:3.2::textbook");
      const links = settled()
        .filter((l) => l.itemKey !== item.key)
        .concat({
          itemKey: "practice:3.9::textbook",
          kind: "assignment",
          classroomId: "kept",
          state: "PUBLISHED",
          scheduledFor: null,
          sent: { title: item.title.replace("3.2", "3.9") },
        });
      expect(rekeys(links, plan())).toEqual([{ from: "practice:3.9::textbook", to: item.key }]);
    });

    it("does not guess between two candidates", () => {
      const item = work("practice:3.2::textbook");
      const twin = (key: string): ClassroomLink => ({
        itemKey: key,
        kind: "assignment",
        classroomId: key,
        state: "PUBLISHED",
        scheduledFor: null,
        sent: { title: item.title.replace("3.2", key.includes("a") ? "3.8" : "3.9") },
      });
      const links = settled()
        .filter((l) => l.itemKey !== item.key)
        .concat(twin("practice:a"), twin("practice:b"));
      expect(rekeys(links, plan())).toEqual([]);
    });
  });

});
