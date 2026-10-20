import { describe, expect, it } from "vitest";
import { applyChanges, buildChangeSet, conformToClass, type CurriculumProposal } from "./curriculum-diff";
import {
  acceptedChangeIds,
  buildHunks,
  carryDecisions,
  decisionOf,
  reviewRows,
  type Decisions,
} from "./curriculum-review";
import type { CurriculumUnit } from "./db/types";

/**
 * The review groups a draft into hunks — one row each — and applies exactly
 * the hunks the teacher accepted. What matters is that a decision lands on
 * every change in its row and on nothing else, and that a "yes" never carries
 * over to a row whose proposal has since changed.
 */

function units(): CurriculumUnit[] {
  return [
    {
      id: "u3",
      title: "Unit 3: Linear Functions",
      subunits: [
        { id: "3.1", title: "Slope", date: "10/1", objectives: [], tracks: [] },
        { id: "3.2", title: "Intercepts", date: "10/3", objectives: [], tracks: [] },
      ],
      checkpoints: [{ id: "q", kind: "quiz", title: "Quiz 3A", date: "10/4", afterSectionId: "3.2" }],
    },
  ];
}

function draft(): CurriculumProposal {
  return {
    units: [
      {
        existingId: "u3",
        number: "3",
        title: "Unit 3: Linear Functions",
        sections: [
          // Retitled and moved a day: two changes, one row.
          { existingId: "3.1", number: "3.1", title: "Slope Fields", date: "10/2" },
          { existingId: "3.2", number: "3.2", title: "Intercepts", date: "10/3" },
          { number: "3.3", title: "Point-Slope Form", date: "10/6" },
        ],
        checkpoints: [{ existingId: "q", kind: "quiz", title: "Quiz 3A", date: "10/4", afterSectionNumber: "3.2" }],
      },
    ],
  };
}

describe("buildHunks", () => {
  it("puts every change to one row in one hunk, in reading order", () => {
    const set = buildChangeSet(units(), draft());
    const hunks = buildHunks(set);
    expect(hunks.map((h) => h.key)).toEqual(["sec|u3|3.1", "sec|u3|new:u3:2"]);
    expect(hunks[0].changes.map((c) => c.kind).sort()).toEqual(["section-date", "section-title"]);
  });

  it("applies exactly the accepted rows", () => {
    const set = buildChangeSet(units(), draft());
    const hunks = buildHunks(set);
    const decisions: Decisions = {
      [hunks[0].key]: { decision: "rejected", signature: hunks[0].signature },
      [hunks[1].key]: { decision: "accepted", signature: hunks[1].signature },
    };
    const { units: next } = applyChanges(units(), set, acceptedChangeIds(hunks, decisions));
    expect(next[0].subunits.map((s) => [s.id, s.title, s.date])).toEqual([
      ["3.1", "Slope", "10/1"],
      ["3.2", "Intercepts", "10/3"],
      ["3.3", "Point-Slope Form", "10/6"],
    ]);
  });
});

describe("carryDecisions", () => {
  it("keeps a decision only while its row proposes the same thing", () => {
    const first = buildHunks(buildChangeSet(units(), draft()));
    const decisions: Decisions = Object.fromEntries(
      first.map((h) => [h.key, { decision: "accepted" as const, signature: h.signature }])
    );

    // A follow-up moves 3.1 to a different day; 3.3 is untouched.
    const revised = draft();
    revised.units[0].sections[0].date = "10/5";
    const second = buildHunks(buildChangeSet(units(), revised));
    const carried = carryDecisions(second, decisions);

    expect(decisionOf(second[0], carried)).toBeNull();
    expect(decisionOf(second[1], carried)).toBe("accepted");
  });
});

describe("reviewRows", () => {
  it("places a checkpoint after the section it sits after", () => {
    const set = buildChangeSet(units(), draft());
    const rows = reviewRows(set.plan.units[0]).map((r) =>
      r.kind === "section" ? r.section.proposed?.number : r.checkpoint.proposed?.title
    );
    expect(rows).toEqual(["3.1", "3.2", "Quiz 3A", "3.3"]);
  });
});

describe("filling in a subunit's content", () => {
  function withTrack(blocks: { type: "learn" | "practice"; title: string }[]): CurriculumUnit[] {
    const base = units();
    base[0].subunits[1].tracks = [
      {
        id: "3.2::textbook",
        kind: "textbook",
        label: "Textbook",
        reference: "Ch 3.2",
        objectives: [],
        blocks: blocks.map((b, i) => ({ id: `b${i}`, type: b.type, title: b.title, attachments: [] })),
      },
    ];
    return base;
  }

  function filled(): CurriculumProposal {
    const proposal = draft();
    proposal.units[0].sections[1].tracks = [
      {
        kind: "textbook",
        label: "Textbook",
        objectives: ["I can find both intercepts"],
        learn: { title: "Their version of the reading", instructions: "Read it" },
        practice: { title: "Intercept practice", instructions: "Find the intercepts of eight lines" },
      },
    ];
    return proposal;
  }

  it("adds only what a resource lacks, and keeps the teacher's own activity and its id", () => {
    const current = withTrack([{ type: "learn", title: "My own reading" }]);
    const set = buildChangeSet(current, filled());
    const content = set.changes.find((c) => c.kind === "track-content");
    expect(content?.after).toBe("1 target · Practice: Intercept practice");

    const hunks = buildHunks(set);
    const all: Decisions = Object.fromEntries(
      hunks.map((h) => [h.key, { decision: "accepted" as const, signature: h.signature }])
    );
    const { units: next } = applyChanges(current, set, acceptedChangeIds(hunks, all));
    const track = next[0].subunits.find((s) => s.id === "3.2")!.tracks[0];
    expect(track.id).toBe("3.2::textbook");
    expect(track.blocks.map((b) => [b.id.length > 2 ? "new" : b.id, b.type, b.title])).toEqual([
      ["b0", "learn", "My own reading"],
      ["new", "practice", "Intercept practice"],
    ]);
    expect(track.objectives.map((o) => o.text)).toEqual(["I can find both intercepts"]);
  });

  it("offers nothing for a resource that already has both activities and its targets", () => {
    const current = withTrack([
      { type: "learn", title: "My own reading" },
      { type: "practice", title: "My own problems" },
    ]);
    current[0].subunits[1].tracks[0].objectives = [{ id: "o", text: "Mine" }];
    expect(buildChangeSet(current, filled()).changes.some((c) => c.kind === "track-content")).toBe(false);
  });

  it("gives a new subunit's resources their activities, so students can see them", () => {
    const proposal = draft();
    proposal.units[0].sections[2].tracks = [
      {
        kind: "guided",
        learn: { title: "Point-slope notes", instructions: "Fill in the notes" },
        practice: { title: "Point-slope practice" },
      },
    ];
    const set = buildChangeSet(units(), proposal);
    const hunks = buildHunks(set);
    const add = hunks.find((h) => h.changes.some((c) => c.kind === "section-add"))!;
    const { units: next } = applyChanges(
      units(),
      set,
      acceptedChangeIds(hunks, { [add.key]: { decision: "accepted", signature: add.signature } })
    );
    const track = next[0].subunits.find((s) => s.id === "3.3")!.tracks[0];
    expect(track.blocks.map((b) => [b.type, b.title, b.description])).toEqual([
      ["learn", "Point-slope notes", "Fill in the notes"],
      ["practice", "Point-slope practice", ""],
    ]);
  });
});

describe("keeping to the class's own format", () => {
  // The way the teacher's own subunits read: Learn titled with the reference,
  // Practice always "Practice" / "Assigned practice for <ref>.", no objectives.
  function formatted(): CurriculumUnit[] {
    const track = (id: string, ref: string) => ({
      id: `${id}::textbook`,
      kind: "textbook" as const,
      label: "Next-Gen Textbook",
      reference: ref,
      objectives: [],
      blocks: [
        { id: `${id}-l`, type: "learn" as const, title: ref, attachments: [] },
        {
          id: `${id}-p`,
          type: "practice" as const,
          title: "Practice",
          description: `Assigned practice for ${ref}.`,
          attachments: [],
        },
      ],
    });
    const base = units();
    base[0].subunits[0].tracks = [track("3.1", "Ch 12.5")];
    base[0].subunits[1].tracks = [track("3.2", "Ch 12.6")];
    return base;
  }

  function invented(reference: string | null): CurriculumProposal {
    return {
      units: [
        {
          existingId: "u3",
          number: "3",
          title: "Unit 3: Linear Functions",
          sections: [
            {
              number: "3.3",
              title: "Unit Circle Foundations",
              objectives: ["I can define sine and cosine"],
              tracks: [
                {
                  kind: "textbook",
                  reference,
                  objectives: ["A target the class never writes"],
                  learn: { title: "Unit Circle Exploration", instructions: "Review how triangles connect" },
                  practice: { title: "Unit Circle Practice", instructions: "Practise evaluating values" },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  it("writes a new subunit exactly as the class writes its own", () => {
    const section = conformToClass(invented("Ch 12.7"), formatted()).units[0].sections[0];
    expect(section.objectives).toBeNull();
    expect(section.tracks?.[0]).toMatchObject({
      objectives: null,
      learn: { title: "Ch 12.7" },
      practice: { title: "Practice", instructions: "Assigned practice for Ch 12.7." },
    });
  });

  it("keeps the fixed parts of the pattern even without a reference", () => {
    const track = conformToClass(invented(null), formatted()).units[0].sections[0].tracks![0];
    expect(track.practice?.title).toBe("Practice");
    // Nothing to fill "{ref}" with: the model's own words stand.
    expect(track.learn?.title).toBe("Unit Circle Exploration");
    expect(track.practice?.instructions).toBe("Practise evaluating values");
  });

  it("takes the format from the subunit's own unit when the class is written two ways", () => {
    // Another unit is hand-authored with objectives; this one is not.
    const authored: CurriculumUnit = {
      id: "u1",
      title: "Unit 1: Sequences",
      subunits: ["1.1", "1.2"].map((id) => ({
        id,
        title: `Lesson ${id}`,
        objectives: [{ id: `${id}-o`, text: "I can do it" }],
        tracks: [],
      })),
      checkpoints: [],
    };
    const section = conformToClass(invented("Ch 12.7"), [authored, ...formatted()]).units[0].sections[0];
    expect(section.objectives).toBeNull();
    expect(section.tracks?.[0].practice?.instructions).toBe("Assigned practice for Ch 12.7.");
  });

  it("writes the activities a pattern decides when the model left them out — on a new subunit only", () => {
    const bare = invented("Ch 12.7");
    bare.units[0].sections[0].tracks![0] = { kind: "textbook", reference: "Ch 12.7" };
    const track = conformToClass(bare, formatted()).units[0].sections[0].tracks![0];
    expect(track.learn).toEqual({ title: "Ch 12.7", instructions: "" });
    expect(track.practice).toEqual({ title: "Practice", instructions: "Assigned practice for Ch 12.7." });

    // The same silence on a subunit that already exists stays silence.
    const existing = invented("Ch 12.6");
    existing.units[0].sections[0] = {
      existingId: "3.2",
      number: "3.2",
      title: "Intercepts",
      tracks: [{ kind: "textbook", reference: "Ch 12.6" }],
    };
    const kept = conformToClass(existing, formatted()).units[0].sections[0].tracks![0];
    expect(kept.learn).toBeNull();
    expect(kept.practice).toBeNull();
  });

  it("leaves a class with no content to copy alone", () => {
    expect(conformToClass(invented("Ch 12.7"), units())).toEqual(invented("Ch 12.7"));
  });
});
