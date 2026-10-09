import { describe, expect, it } from "vitest";
import {
  applyChanges,
  buildChangeSet,
  orderRemaps,
  shapeProposal,
  type CurriculumProposal,
} from "./curriculum-diff";
import type { CurriculumUnit } from "./db/types";
import type { Section, SectionActivityStatus } from "./types";
import { stableTrackId } from "./section-tracks";

/**
 * The import is only allowed to move student work, never to lose it. These
 * tests are written from that angle: every case asks what happened to the
 * marks, not just what happened to the table.
 */

function section(id: string, title: string, date?: string): Section {
  return {
    id,
    title,
    date,
    objectives: [],
    tracks: [
      {
        id: stableTrackId(id, "textbook"),
        kind: "textbook",
        label: "Textbook",
        reference: `Ch ${id}`,
        objectives: [],
        blocks: [
          {
            id: `${id}-b1`,
            type: "learn",
            title: "Read",
            attachments: [],
          },
        ],
      },
    ],
  };
}

function curriculum(): CurriculumUnit[] {
  return [
    {
      id: "unit-3",
      title: "Unit 3: Linear Functions",
      subunits: [
        section("3.1", "Slope", "10/1"),
        section("3.2", "Intercepts", "10/3"),
        section("3.3", "Point-Slope Form", "10/7"),
      ],
      checkpoints: [
        {
          id: "cp-1",
          kind: "quiz",
          title: "Quiz 3A",
          date: "10/8",
          afterSectionId: "3.3",
        },
      ],
    },
  ];
}

/** The proposal a model would return if nothing at all had changed. */
function echoProposal(units: CurriculumUnit[]): CurriculumProposal {
  return {
    units: units.map((unit) => ({
      existingId: unit.id,
      title: unit.title,
      sections: unit.subunits.map((s) => ({
        existingId: s.id,
        number: s.id,
        title: s.title,
        date: s.date ?? null,
        tracks: s.tracks.map((t) => ({
          kind: t.kind,
          label: t.label,
          reference: t.reference ?? null,
        })),
      })),
      checkpoints: unit.checkpoints.map((c) => ({
        existingId: c.id,
        kind: c.kind,
        title: c.title,
        date: c.date ?? null,
        afterSectionNumber: c.afterSectionId,
      })),
    })),
  };
}

/** What the store does with a remap list, so a test can check work survives. */
function moveProgress(
  progress: Record<string, SectionActivityStatus>,
  remaps: { from: string; to: string }[]
): Record<string, SectionActivityStatus> {
  const out = { ...progress };
  for (const { from, to } of remaps) {
    if (!out[from]) continue;
    out[to] = out[from];
    delete out[from];
  }
  return out;
}

const allOf = (set: { changes: { id: string }[] }) =>
  new Set(set.changes.map((c) => c.id));

describe("buildChangeSet", () => {
  it("finds nothing to change in a curriculum re-imported unchanged", () => {
    const current = curriculum();
    const set = buildChangeSet(current, echoProposal(current));
    expect(set.changes).toEqual([]);
  });

  it("ignores whitespace and date spacing", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    proposal.units[0].sections[0].title = "  Slope  ";
    proposal.units[0].sections[0].date = "10 / 1";
    expect(buildChangeSet(current, proposal).changes).toEqual([]);
  });

  it("offers exactly one cell for one edited date", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    proposal.units[0].sections[1].date = "10/6";

    const set = buildChangeSet(current, proposal);
    expect(set.changes).toHaveLength(1);
    expect(set.changes[0]).toMatchObject({
      kind: "section-date",
      field: "Date",
      before: "10/3",
      after: "10/6",
    });
  });

  it("does not blank a field the proposal is silent about", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    proposal.units[0].sections[1].date = null;
    proposal.units[0].sections[1].tracks = [];

    expect(buildChangeSet(current, proposal).changes).toEqual([]);
  });

  it("treats an unmentioned section as a removal to approve, not a fact", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    proposal.units[0].sections.splice(1, 1);

    const set = buildChangeSet(current, proposal);
    const removal = set.changes.find((c) => c.kind === "section-remove");
    expect(removal).toBeDefined();
    expect(removal!.destructive).toBe(true);

    // Denying it (approving nothing) leaves the curriculum whole.
    const { units } = applyChanges(current, set, new Set());
    expect(units[0].subunits.map((s) => s.id)).toEqual(["3.1", "3.2", "3.3"]);
  });

  it("matches a renumbered section by its title, not its number", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    // A new 3.3 is inserted; the old 3.3 slides down and loses its id hint.
    proposal.units[0].sections.splice(2, 0, {
      existingId: null,
      number: "3.3",
      title: "Parallel and Perpendicular",
      date: "10/6",
      tracks: [{ kind: "textbook", label: "Textbook", reference: "Ch 3.3" }],
    });
    proposal.units[0].sections[3].existingId = null;
    proposal.units[0].sections[3].number = "3.4";

    const set = buildChangeSet(current, proposal);
    const renumber = set.changes.find((c) => c.kind === "section-renumber");
    expect(renumber).toMatchObject({ before: "3.3", after: "3.4" });
    expect(set.changes.filter((c) => c.kind === "section-remove")).toHaveLength(0);
  });
});

describe("applyChanges", () => {
  it("changes nothing at all when every change is denied", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    proposal.units[0].title = "Unit 3: Lines";
    proposal.units[0].sections[0].title = "Slope and Rate of Change";
    proposal.units[0].sections[2].number = "3.9";

    const set = buildChangeSet(current, proposal);
    expect(set.changes.length).toBeGreaterThan(0);

    const { units, remaps } = applyChanges(current, set, new Set());
    expect(remaps).toEqual([]);
    expect(units[0].title).toBe(current[0].title);
    expect(units[0].subunits.map((s) => s.id)).toEqual(["3.1", "3.2", "3.3"]);
    expect(units[0].subunits.map((s) => s.title)).toEqual(
      current[0].subunits.map((s) => s.title)
    );
  });

  it("applies only the cell that was approved", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    proposal.units[0].sections[0].title = "Slope and Rate of Change";
    proposal.units[0].sections[1].date = "10/6";

    const set = buildChangeSet(current, proposal);
    const dateChange = set.changes.find((c) => c.kind === "section-date")!;
    const { units } = applyChanges(current, set, new Set([dateChange.id]));

    expect(units[0].subunits[0].title).toBe("Slope");
    expect(units[0].subunits[1].date).toBe("10/6");
  });

  it("keeps a matched section's track objects and ids", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    proposal.units[0].sections[2].number = "3.4";
    proposal.units[0].sections[2].tracks = [
      { kind: "textbook", label: "Textbook", reference: "Ch 3.4" },
    ];

    const set = buildChangeSet(current, proposal);
    const { units } = applyChanges(current, set, allOf(set));

    const moved = units[0].subunits.find((s) => s.id === "3.4")!;
    // The id still reads 3.3 — it is a key into progress, not a label.
    expect(moved.tracks[0].id).toBe(stableTrackId("3.3", "textbook"));
    expect(moved.tracks[0].blocks).toHaveLength(1);
    expect(moved.tracks[0].reference).toBe("Ch 3.4");
  });

  it("moves a student's work when an insertion renumbers the sections", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    proposal.units[0].sections.splice(2, 0, {
      existingId: null,
      number: "3.3",
      title: "Parallel and Perpendicular",
      date: "10/6",
      tracks: [{ kind: "textbook", label: "Textbook", reference: "Ch 3.3" }],
    });
    proposal.units[0].sections[3].number = "3.4";
    proposal.units[0].checkpoints![0].afterSectionNumber = "3.4";

    const set = buildChangeSet(current, proposal);
    const { units, remaps } = applyChanges(current, set, allOf(set));

    expect(units[0].subunits.map((s) => s.id)).toEqual(["3.1", "3.2", "3.3", "3.4"]);
    expect(remaps).toEqual([{ from: "3.3", to: "3.4" }]);

    // Carson's Help! on the old 3.3 now reads under 3.4, still on its own track.
    const trackId = stableTrackId("3.3", "textbook");
    const before: Record<string, SectionActivityStatus> = {
      "3.3": { tracks: { [trackId]: { learn: "done", practice: "help" } } },
    };
    const after = moveProgress(before, remaps);
    expect(after["3.3"]).toBeUndefined();
    expect(after["3.4"]!.tracks[trackId]!.practice).toBe("help");

    // And the track that progress is filed under is still on the section.
    const moved = units[0].subunits.find((s) => s.id === "3.4")!;
    expect(moved.tracks.some((t) => t.id === trackId)).toBe(true);

    expect(units[0].checkpoints[0].afterSectionId).toBe("3.4");
  });

  it("refuses a renumber that would land on a section staying put", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    // 3.1 is told to become 3.2, but 3.2 is not moving anywhere.
    proposal.units[0].sections[0].number = "3.2";
    proposal.units[0].sections[1].number = "3.2";

    const set = buildChangeSet(current, proposal);
    const { units, remaps } = applyChanges(current, set, allOf(set));

    expect(remaps).toEqual([]);
    expect(units[0].subunits.map((s) => s.id)).toEqual(["3.1", "3.2", "3.3"]);
  });

  it("adds a section without touching the ones around it", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    proposal.units[0].sections.push({
      existingId: null,
      number: "3.4",
      title: "Modeling With Lines",
      date: "10/10",
      objectives: ["Fit a line to data"],
      tracks: [{ kind: "guided", label: "Guided Notes", reference: "GN 3.4" }],
    });

    const set = buildChangeSet(current, proposal);
    expect(set.changes).toHaveLength(1);
    expect(set.changes[0].kind).toBe("section-add");

    const { units, remaps } = applyChanges(current, set, allOf(set));
    expect(remaps).toEqual([]);
    expect(units[0].subunits).toHaveLength(4);

    const added = units[0].subunits[3];
    expect(added.id).toBe("3.4");
    expect(added.tracks[0].id).toBe(stableTrackId("3.4", "guided"));
    expect(added.objectives.map((o) => o.text)).toEqual(["Fit a line to data"]);
    expect(units[0].subunits[2].tracks[0].id).toBe(stableTrackId("3.3", "textbook"));
  });

  it("drops a section only once its removal is approved", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    proposal.units[0].sections.splice(1, 1);

    const set = buildChangeSet(current, proposal);
    const removal = set.changes.find((c) => c.kind === "section-remove")!;
    const { units } = applyChanges(current, set, new Set([removal.id]));

    expect(units[0].subunits.map((s) => s.id)).toEqual(["3.1", "3.3"]);
  });

  it("re-applying its own output finds nothing left to do", () => {
    const current = curriculum();
    const proposal = echoProposal(current);
    proposal.units[0].sections[1].date = "10/6";
    proposal.units[0].sections[2].number = "3.4";

    const first = buildChangeSet(current, proposal);
    const { units } = applyChanges(current, first, allOf(first));

    const second = buildChangeSet(units, echoProposal(units));
    expect(second.changes).toEqual([]);
  });
});

describe("orderRemaps", () => {
  it("moves the far end of a shift first", () => {
    expect(
      orderRemaps([
        { from: "3.3", to: "3.4" },
        { from: "3.4", to: "3.5" },
        { from: "3.5", to: "3.6" },
      ])
    ).toEqual([
      { from: "3.5", to: "3.6" },
      { from: "3.4", to: "3.5" },
      { from: "3.3", to: "3.4" },
    ]);
  });

  it("keeps an upward shift in its natural order", () => {
    expect(
      orderRemaps([
        { from: "3.4", to: "3.3" },
        { from: "3.5", to: "3.4" },
      ])
    ).toEqual([
      { from: "3.4", to: "3.3" },
      { from: "3.5", to: "3.4" },
    ]);
  });

  it("breaks a swap with a scratch id rather than colliding", () => {
    const ordered = orderRemaps([
      { from: "3.1", to: "3.2" },
      { from: "3.2", to: "3.1" },
    ]);

    // Replaying the moves over a set of keys must never overwrite one.
    const rows: Record<string, string> = { "3.1": "a", "3.2": "b" };
    for (const { from, to } of ordered) {
      expect(rows[to]).toBeUndefined();
      rows[to] = rows[from];
      delete rows[from];
    }
    expect(rows).toEqual({ "3.1": "b", "3.2": "a" });
  });
});

describe("units the files never mention", () => {
  it("leaves them untouched rather than proposing a deletion", () => {
    const current = [
      ...curriculum(),
      {
        id: "unit-4",
        title: "Unit 4: Quadratics",
        subunits: [section("4.1", "Parabolas", "11/1")],
        checkpoints: [],
      },
    ];

    // The teacher uploads a sheet covering Unit 3 only.
    const proposal = echoProposal([current[0]]);
    proposal.units[0].sections[1].date = "10/6";

    const set = buildChangeSet(current, proposal);
    expect(set.changes.filter((c) => c.kind === "unit-remove")).toEqual([]);
    expect(set.changes).toHaveLength(1);

    const { units } = applyChanges(current, set, allOf(set));
    expect(units.map((u) => u.title)).toEqual([
      "Unit 3: Linear Functions",
      "Unit 4: Quadratics",
    ]);
    expect(units[1].subunits[0].tracks[0].id).toBe(stableTrackId("4.1", "textbook"));
  });
});

describe("shapeProposal", () => {
  const sec = (number: string, date?: string) => ({ number, title: `Lesson ${number}`, date });

  it("gives every unit number its own unit, however the model grouped them", () => {
    // A sheet numbered 1.1 to 3.2, lumped by semester.
    const lumped: CurriculumProposal = {
      units: [
        {
          title: "Semester 1",
          sections: [sec("1.1", "9/1"), sec("1.2", "9/2"), sec("2.1", "9/8")],
          checkpoints: [{ kind: "test", title: "Unit 1 Test", date: "9/4" }],
        },
        {
          title: "Semester 2",
          sections: [sec("2.2", "9/9"), sec("3.1", "1/12"), sec("3.2", "1/13")],
          checkpoints: [
            { kind: "test", title: "Unit 2 Test", date: "9/11", afterSectionNumber: "2.2" },
            { kind: "quiz", title: "Quiz 3.1", date: "1/12" },
          ],
        },
      ],
    };

    const { units } = shapeProposal(lumped);
    expect(units.map((u) => [u.number, u.title, u.sections.map((s) => s.number)])).toEqual([
      ["1", "Unit 1", ["1.1", "1.2"]],
      ["2", "Unit 2", ["2.1", "2.2"]],
      ["3", "Unit 3", ["3.1", "3.2"]],
    ]);
    // Tests follow the unit they assess, placed by the section or date.
    expect(units.map((u) => u.checkpoints?.map((c) => [c.title, c.afterSectionNumber]))).toEqual([
      [["Unit 1 Test", "1.2"]],
      [["Unit 2 Test", "2.2"]],
      [["Quiz 3.1", "3.1"]],
    ]);
  });

  it("keeps the year's teaching order when unit numbers are out of order", () => {
    // Unit 11 is taught in February, unit 8 after it — the model listed 8 first.
    const answer: CurriculumProposal = {
      units: [
        { title: "Conics", sections: [sec("8.1", "2/23"), sec("8.2", "2/24")], checkpoints: [] },
        { title: "Statistics", sections: [sec("11.1", "2/5"), sec("11.2", "2/8")], checkpoints: [] },
        { title: "Matrices", sections: [sec("6.1", "12/21"), sec("6.2", "1/4")], checkpoints: [] },
      ],
    };
    expect(shapeProposal(answer).units.map((u) => u.number)).toEqual(["6", "11", "8"]);
  });

  it("passes a well-formed answer through with its titles and ids", () => {
    const good: CurriculumProposal = {
      units: [
        { existingId: "u1", title: "Functions", sections: [sec("1.1"), sec("1.2")], checkpoints: [] },
        { existingId: null, title: "Quadratics", sections: [sec("2.1")], checkpoints: [] },
      ],
    };
    expect(shapeProposal(good).units.map((u) => [u.existingId, u.number, u.title])).toEqual([
      ["u1", "1", "Functions"],
      // A new unit is numbered; one the class already has keeps its title.
      [null, "2", "Unit 2: Quadratics"],
    ]);
  });

  it("finds the existing unit by number when a lumped answer lost its id", () => {
    const lumped: CurriculumProposal = {
      units: [{ title: "Fall", sections: [sec("3.1"), sec("3.2"), sec("4.1")], checkpoints: [] }],
    };
    const { units } = shapeProposal(lumped, curriculum());
    expect(units.map((u) => [u.existingId, u.title])).toEqual([
      ["unit-3", "Unit 3: Linear Functions"],
      [null, "Unit 4"],
    ]);
  });

  it("leaves an existing checkpoint's place alone, and an unnumbered answer as it was", () => {
    const kept: CurriculumProposal = {
      units: [
        {
          existingId: "unit-3",
          title: "Unit 3: Linear Functions",
          sections: [sec("3.1"), sec("3.2")],
          checkpoints: [{ existingId: "cp-1", kind: "quiz", title: "Quiz 3A", afterSectionNumber: null }],
        },
      ],
    };
    expect(shapeProposal(kept).units[0].checkpoints?.[0].afterSectionNumber).toBeNull();

    const plain: CurriculumProposal = {
      units: [{ title: "Poetry", sections: [{ number: "A", title: "Sonnets" }], checkpoints: [] }],
    };
    expect(shapeProposal(plain)).toBe(plain);
  });
});
