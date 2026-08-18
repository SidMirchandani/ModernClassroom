import type { Database, DbClass, DbStudentProgress } from "./db/types";
import type { CheckpointGrade, Section, StudentProgress } from "./types";
import { checkpointMax } from "./grades";
import { DB_STORAGE_KEY } from "./db/client";
import { SESSION_STORAGE_KEY } from "./auth-client";
import { getCourseTemplate, instantiateTemplate } from "./course-templates";
import { DEMO_PROGRESS, UNIT } from "./demo-units";

export const DEMO_FLAG_KEY = "modern-classroom-demo";
const DEMO_NOTICE_KEY = "modern-classroom-demo-notice";

/** The single demo account. It teaches all three classes and sits in them as a student. */
export const DEMO_USER_ID = "demo-user";

/**
 * The demo's clock. Mrs Gomes's timeline runs September to June, and the seeded
 * progress sits in the middle of Unit 3 — against a real "today" in August the
 * entire course would be in the future and nothing would ever be due. Pinning
 * the reference date keeps the demo's dates and its progress telling the same
 * story.
 */
export const DEMO_TODAY = new Date(2026, 9, 14);

/** Today, or the demo's pinned date when the demo store is loaded. */
export function referenceToday(): Date {
  return isDemoMode() ? new Date(DEMO_TODAY) : new Date();
}

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEMO_FLAG_KEY) === "1";
}

export function exitDemoMode(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEMO_FLAG_KEY);
  localStorage.removeItem(DEMO_NOTICE_KEY);
  localStorage.removeItem(DB_STORAGE_KEY);
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/** The "nothing is saved" line is a one-time explanation, not a permanent banner. */
export function isDemoNoticeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEMO_NOTICE_KEY) === "dismissed";
}

export function dismissDemoNotice(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_NOTICE_KEY, "dismissed");
}

/** Eight classmates who fill the roster. Ordinary names — nothing labelled "demo". */
const CLASSMATES: { id: string; first: string; last: string }[] = [
  { id: "demo-s1", first: "Dutt", last: "Patel" },
  { id: "demo-s2", first: "Julian", last: "Reyes" },
  { id: "demo-s3", first: "Carson", last: "Wu" },
  { id: "demo-s4", first: "Maya", last: "Iyer" },
  { id: "demo-s5", first: "Priya", last: "Nair" },
  { id: "demo-s6", first: "Ethan", last: "Brooks" },
  { id: "demo-s7", first: "Sofia", last: "Marin" },
  { id: "demo-s8", first: "Liam", last: "Novak" },
];

/** The authored Unit 3 spread is keyed s1…s8; seat i maps to classmate i. */
const AUTHORED_SOURCE_IDS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

function makeClass(
  templateId: string,
  name: string,
  code: string,
  gateSectionId: string | null,
  transform?: (units: DbClass["units"]) => DbClass["units"]
): DbClass {
  const template = getCourseTemplate(templateId)!;
  const units = transform
    ? transform(instantiateTemplate(template))
    : instantiateTemplate(template);

  return {
    id: `demo-${templateId}`,
    name,
    code,
    teacherId: DEMO_USER_ID,
    units,
    blockSectionId: gateSectionId,
    createdAt: new Date(0).toISOString(),
  };
}

/**
 * Algebra II is the showcase class, so Unit 3 carries the fully-authored
 * sections from the dashboard sheet — real objectives, real resources — while
 * the other ten units keep the template's skeleton.
 */
function withAuthoredUnit3(units: DbClass["units"]): DbClass["units"] {
  const authored: Section[] = UNIT.sections;
  return units.map((unit) =>
    unit.subunits.some((s) => s.id === "3.1")
      ? { ...unit, subunits: structuredClone(authored) }
      : unit
  );
}

type StepState = "done" | "available" | "locked" | "help";

interface SeededTrack {
  learn: StepState;
  practice: StepState;
  practiceApproved?: boolean;
}

/**
 * Walk each person a different distance into the course: everything before
 * their reach is signed off, the reach section is underway, the rest untouched.
 * Reaches are indices into the class's flattened section list.
 */
/**
 * How well each seat does on the quizzes they have sat. A flat 90% everywhere
 * would make the grade columns look like placeholder text.
 */
const GRADE_RATIOS = [0.9, 1, 0.75, 0.95, 0.85, 0.7, 1, 0.8];

/**
 * Anything anchored to a section the student has finished has been sat, so it
 * carries a mark — the grade columns are only meaningful with marks in them.
 */
function seedGrades(cls: DbClass, reach: number, personIndex: number) {
  const sections = cls.units.flatMap((u) => u.subunits);
  const grades: Record<string, CheckpointGrade> = {};

  cls.units.forEach((unit) => {
    (unit.checkpoints ?? []).forEach((checkpoint, cpIndex) => {
      const anchor = sections.findIndex((s) => s.id === checkpoint.afterSectionId);
      if (anchor < 0 || anchor >= reach) return;

      const outOf = checkpointMax(checkpoint);
      const ratio = GRADE_RATIOS[(personIndex + cpIndex) % GRADE_RATIOS.length];
      grades[checkpoint.id] = { score: Math.round(outOf * ratio), outOf };
    });
  });

  return grades;
}

function seedProgressFor(
  cls: DbClass,
  people: { id: string }[],
  reaches: number[],
  overlayByPerson?: Record<string, Record<string, StudentProgress["sections"][string]>>
): DbStudentProgress[] {
  const sections = cls.units.flatMap((u) => u.subunits);

  return people.map((person, personIndex) => {
    const reach = reaches[personIndex] ?? 1;
    const overlay = overlayByPerson?.[person.id];
    const sectionStates: StudentProgress["sections"] = {};

    sections.forEach((section, sectionIndex) => {
      const authored = overlay?.[section.id];
      if (authored) {
        sectionStates[section.id] = structuredClone(authored);
        return;
      }

      const tracks: Record<string, SeededTrack> = {};
      for (const track of section.tracks) {
        if (sectionIndex < reach) {
          tracks[track.id] = { learn: "done", practice: "done", practiceApproved: true };
        } else if (sectionIndex === reach) {
          tracks[track.id] = { learn: "done", practice: "available" };
        } else {
          tracks[track.id] = { learn: "locked", practice: "locked" };
        }
      }
      sectionStates[section.id] = { tracks };
    });

    return {
      classId: cls.id,
      studentId: person.id,
      sections: sectionStates,
      checkpoints: seedGrades(cls, reach, personIndex),
    };
  });
}

/** Where a unit's first section sits in the class's flattened section list. */
function unitStart(cls: DbClass, unitIndex: number): number {
  return cls.units
    .slice(0, unitIndex)
    .reduce((n, unit) => n + unit.subunits.length, 0);
}

/**
 * Every class opens in **Unit 3**: the first two units signed off and the class
 * a few sections into the third. Reaches are offsets from Unit 3's first
 * section rather than absolute indices, because the three courses have
 * different-sized opening units — Algebra II reaches 3.1 after 8 sections, AP
 * Precalculus after 29.
 */
const UNIT3 = 2;
const CLASSMATE_OFFSETS = [2, 3, 0, 3, 2, 1, 3, 2];

/**
 * The signed-in account's own student progress: two sections into Unit 3, one
 * behind the gate. Its current section is left deliberately mid-flight — one
 * resource finished, one submitted and waiting, one asking for help — so the
 * student view demonstrates every state the moment you open it.
 */
const SELF_OFFSET = 2;

function classmateReaches(cls: DbClass): number[] {
  const base = unitStart(cls, UNIT3);
  return CLASSMATE_OFFSETS.map((offset) => base + offset);
}

function selfReach(cls: DbClass): number {
  return unitStart(cls, UNIT3) + SELF_OFFSET;
}

function selfCurrentSection(cls: DbClass, reach: number) {
  const section = cls.units.flatMap((u) => u.subunits)[reach];
  if (!section) return undefined;

  const tracks: Record<string, SeededTrack> = {};
  section.tracks.forEach((track, i) => {
    if (i === 0) {
      tracks[track.id] = { learn: "done", practice: "done", practiceApproved: true };
    } else if (i === 1) {
      tracks[track.id] = { learn: "done", practice: "done", practiceApproved: false };
    } else if (i === 2) {
      tracks[track.id] = { learn: "done", practice: "help" };
    } else {
      tracks[track.id] = { learn: "available", practice: "locked" };
    }
  });

  return { [section.id]: { tracks } };
}

/** Overlay keyed by the demo account, for `seedProgressFor`. */
function selfOverlay(cls: DbClass, reach: number) {
  const current = selfCurrentSection(cls, reach);
  return current ? { [DEMO_USER_ID]: current } : undefined;
}

/** The per-student help/review spread authored against Unit 3's real tracks. */
function authoredUnit3States(): Record<
  string,
  Record<string, StudentProgress["sections"][string]>
> {
  const byPerson: Record<
    string,
    Record<string, StudentProgress["sections"][string]>
  > = {};
  const unit3Ids = new Set(UNIT.sections.map((s) => s.id));

  for (const progress of DEMO_PROGRESS) {
    const seat = AUTHORED_SOURCE_IDS.indexOf(progress.studentId);
    const person = CLASSMATES[seat];
    if (!person) continue;

    const sections: Record<string, StudentProgress["sections"][string]> = {};
    for (const [sectionId, state] of Object.entries(progress.sections)) {
      if (unit3Ids.has(sectionId)) sections[sectionId] = state;
    }
    byPerson[person.id] = sections;
  }

  return byPerson;
}

/**
 * Build the whole demo world in one go: one account that teaches three real
 * courses from the 2026 timeline sheet *and* sits in them as a student, plus
 * eight classmates filling the roster. Everything lives in the same
 * localStorage store the signed-in app uses, so the demo *is* the product —
 * dashboard, class pages, curriculum editor and all.
 */
export function seedDemo(): void {
  if (typeof window === "undefined") return;

  const algebra = makeClass(
    "algebra-2",
    "Algebra II, Honors",
    "482910",
    "3.6",
    withAuthoredUnit3
  );
  const precalc = makeClass("ap-precalculus", "AP Precalculus", "573104", "3.6");
  const stats = makeClass("ap-statistics", "AP Statistics", "661820", "3.6");

  const classes = [algebra, precalc, stats];
  const self = [{ id: DEMO_USER_ID }];

  const db: Database = {
    users: [
      {
        id: DEMO_USER_ID,
        email: "demo@modernclassroom.app",
        username: "Demo",
        passwordHash: "demo",
        role: "member",
        firstName: "Demo",
        lastName: "",
        createdAt: new Date(0).toISOString(),
      },
      ...CLASSMATES.map((person) => ({
        id: person.id,
        email: `${person.first.toLowerCase()}.${person.last.toLowerCase()}@school.test`,
        username: `${person.last}${person.first.charAt(0)}`,
        passwordHash: "demo",
        role: "member" as const,
        firstName: person.first,
        lastName: person.last,
        createdAt: new Date(0).toISOString(),
      })),
    ],
    classes,
    // The demo account is enrolled in its own classes so the Enrolled tab shows
    // the same three courses from the student side.
    enrollments: classes.flatMap((cls) =>
      [...CLASSMATES, { id: DEMO_USER_ID }].map((person) => ({
        classId: cls.id,
        studentId: person.id,
        joinedAt: new Date(0).toISOString(),
      }))
    ),
    invites: [],
    progress: classes.flatMap((cls) => [
      ...seedProgressFor(
        cls,
        CLASSMATES,
        classmateReaches(cls),
        cls === algebra ? authoredUnit3States() : undefined
      ),
      ...seedProgressFor(cls, self, [selfReach(cls)], selfOverlay(cls, selfReach(cls))),
    ]),
  };

  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  localStorage.setItem(SESSION_STORAGE_KEY, DEMO_USER_ID);
  localStorage.setItem(DEMO_FLAG_KEY, "1");
  localStorage.removeItem(DEMO_NOTICE_KEY);
}
