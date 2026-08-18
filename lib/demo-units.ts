import type {
  Checkpoint,
  ContentBlock,
  ResourceTrack,
  Section,
  SectionObjective,
  StudentProgress,
  TrackKind,
  TrackProgress,
  Unit,
} from "./types";
import { stableTrackId, TRACK_KIND_LABELS } from "./section-tracks";
import { STUDENTS } from "./students";

export const DEMO_CLASS_NAME = "Algebra II, Honors";
export const DEMO_CLASS_CODE = "482910";

/**
 * Algebra II runs on three parallel resources — the Next-Gen textbook, the
 * eMath guided-notes series, and the Discovery activity book. They cover the
 * same objectives in different orders, so each is its own track.
 */
interface TrackSeed {
  kind: TrackKind;
  label?: string;
  /** This resource's own numbering, which rarely matches the section number. */
  reference?: string;
  learn: { title: string; url?: string; description?: string }[];
  practice?: { title: string; description: string; url?: string };
  optional?: boolean;
}

interface SectionSeed {
  id: string;
  title: string;
  date?: string;
  objectives: string[];
  tracks: TrackSeed[];
}

function buildTrack(sectionId: string, seed: TrackSeed): ResourceTrack {
  const id = stableTrackId(sectionId, seed.kind);
  const blocks: ContentBlock[] = seed.learn.map((item, i) => ({
    id: `${id}::learn::${i}`,
    type: "learn",
    title: item.title,
    description: item.description,
    attachments: item.url
      ? [{ id: `${id}::learn::${i}::a`, kind: "link", label: item.title, url: item.url }]
      : [],
  }));

  if (seed.practice) {
    blocks.push({
      id: `${id}::practice::0`,
      type: "practice",
      title: seed.practice.title,
      description: seed.practice.description,
      attachments: seed.practice.url
        ? [
            {
              id: `${id}::practice::0::a`,
              kind: "link",
              label: seed.practice.title,
              url: seed.practice.url,
            },
          ]
        : [],
    });
  }

  return {
    id,
    kind: seed.kind,
    label: seed.label ?? TRACK_KIND_LABELS[seed.kind],
    reference: seed.reference,
    objectives: [],
    blocks,
    ...(seed.optional ? { optional: true } : {}),
  };
}

function buildSection(seed: SectionSeed): Section {
  const objectives: SectionObjective[] = seed.objectives.map((text, i) => ({
    id: `${seed.id}.${i + 1}`,
    text,
  }));

  return {
    id: seed.id,
    title: seed.title,
    date: seed.date,
    objectives,
    tracks: seed.tracks.map((t) => buildTrack(seed.id, t)),
  };
}

/** Generic filler for the units either side of the one the demo focuses on. */
function makeSection(unitNum: number, num: number, title: string): Section {
  const id = `${unitNum}.${num}`;
  return buildSection({
    id,
    title,
    objectives: [
      `I can apply key concepts from ${title}`,
      `I can solve problems involving ${title.toLowerCase()}`,
    ],
    tracks: [
      {
        kind: "textbook",
        label: "Next-Gen Textbook",
        reference: `Ch ${unitNum}.${num}`,
        learn: [{ title: `Read Section ${id}`, url: "https://www.khanacademy.org/" }],
        practice: {
          title: "Section Exercises",
          description: `Complete the exercise set for ${id} and upload a photo of your work.`,
        },
      },
      {
        kind: "guided",
        label: "eMath Guided Notes",
        reference: `Lesson ${num}`,
        learn: [
          { title: `Video Tutorial – ${title}`, url: "https://www.emathinstruction.com/" },
        ],
        practice: {
          title: "Guided Notes Packet",
          description: "Fill in the guided notes packet and upload a screenshot.",
        },
      },
    ],
  });
}

const UNIT_3_SECTIONS: SectionSeed[] = [
  {
    id: "3.1",
    title: "Slope & Recursive Formulas",
    date: "10/12",
    objectives: [
      "I can compute slope given any scenario",
      "I can relate recursive formulas to linear equations",
      "I can interpret slope and intercepts in relation to a problem",
      "I can interpret and classify: Recursion, linear and graphical models",
    ],
    tracks: [
      {
        kind: "textbook",
        label: "Next-Gen Textbook",
        reference: "Ch 3.1 – Linear Change",
        learn: [
          {
            title: "Read 3.1 – Rate of Change",
            url: "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:linear-equations-graphs",
          },
        ],
        practice: {
          title: "Section 3.1 Exercises",
          description:
            "Complete exercises 1–24 odd. Show all work and upload a photo of your finished page.",
        },
      },
      {
        kind: "guided",
        label: "eMath Guided Notes",
        reference: "Unit 3 Lesson 1",
        learn: [
          { title: "Video – Slope from Any Scenario", url: "https://www.emathinstruction.com/" },
          { title: "Guided Notes – Recursive vs Explicit", url: "https://www.emathinstruction.com/" },
        ],
        practice: {
          title: "Lesson 1 Homework Set",
          description:
            "Work the homework set that follows the video. Upload a screenshot of your completed answers.",
        },
      },
      {
        kind: "custom",
        label: "Discovery Activity",
        reference: "Match Point",
        learn: [{ title: "Match Point – in-class investigation" }],
        practice: {
          title: "Match Point Write-Up",
          description:
            "Submit your group's data table and the linear model you fit to it.",
        },
      },
      {
        kind: "extra",
        label: "Extra Material",
        optional: true,
        learn: [{ title: "Calculator Notes – Slope", url: "https://www.desmos.com/" }],
      },
    ],
  },
  {
    id: "3.2",
    title: "Linear Equations as Models",
    date: "10/13",
    objectives: [
      "I can create linear equations to model data",
      "I can define linear descriptive vocabulary",
      "I can write and interpret all 5 forms of linear equations",
    ],
    tracks: [
      {
        kind: "textbook",
        label: "Next-Gen Textbook",
        reference: "Ch 3.2 – Forms",
        learn: [{ title: "Read 3.2 – Forms of a Line", url: "https://www.khanacademy.org/" }],
        practice: {
          title: "Section 3.2 Exercises",
          description:
            "Complete the exercise set on the five forms. Upload a photo or scan of your work.",
        },
      },
      {
        kind: "guided",
        label: "eMath Guided Notes",
        reference: "Unit 3 Lesson 2",
        learn: [{ title: "Video – Writing Linear Models", url: "https://www.emathinstruction.com/" }],
        practice: {
          title: "Lesson 2 Homework Set",
          description: "Complete the homework set and upload your screenshot.",
        },
      },
      {
        kind: "custom",
        label: "Discovery Activity",
        reference: "Balloon Blastoff",
        learn: [{ title: "Balloon Blastoff – collect and model launch data" }],
        practice: {
          title: "Balloon Blastoff Write-Up",
          description: "Submit your model, your prediction, and how far off you were.",
        },
      },
      {
        kind: "extra",
        label: "Extra Material",
        optional: true,
        learn: [
          { title: "Desmos Activity – Lines", url: "https://www.desmos.com/activities" },
        ],
      },
    ],
  },
  {
    id: "3.3",
    title: "Line of Best Fit",
    date: "10/14",
    objectives: [
      "I can create and interpret the line of best fit by hand",
      "I can use a line of best fit to interpolate and extrapolate data",
    ],
    tracks: [
      {
        kind: "textbook",
        label: "Next-Gen Textbook",
        reference: "Ch 11 – Least Squares",
        learn: [
          {
            title: "Read Ch 11 – Least Squares Regression",
            description:
              "The textbook covers this in Chapter 11, not Chapter 3 — the numbering does not line up.",
            url: "https://www.khanacademy.org/",
          },
        ],
        practice: {
          title: "Chapter 11 Exercises",
          description: "Complete the assigned regression exercises and upload your work.",
        },
      },
      {
        kind: "guided",
        label: "eMath Guided Notes",
        reference: "Unit 3 Lesson 3",
        learn: [{ title: "Video – Line of Best Fit by Hand", url: "https://www.emathinstruction.com/" }],
        practice: {
          title: "Lesson 3 Homework Set",
          description:
            "Draw a line of best fit by hand for the given data and answer the analysis questions.",
        },
      },
      {
        kind: "custom",
        label: "Discovery Activity",
        reference: "The Wave",
        learn: [{ title: "The Wave – timed group data collection" }],
        practice: {
          title: "The Wave Write-Up",
          description: "Submit your scatter plot and the line you fit to the class data.",
        },
      },
      {
        kind: "extra",
        label: "Extra Material",
        optional: true,
        learn: [{ title: "Desmos Regression Explorer", url: "https://www.desmos.com/" }],
      },
    ],
  },
  {
    id: "3.4",
    title: "Median-Median Line",
    date: "10/15",
    objectives: [
      "I can create appropriate bins for a data set",
      "I can find the median-median line of a small data set by hand",
      "I can classify causation and correlation, and predicted outcomes",
    ],
    tracks: [
      {
        kind: "textbook",
        label: "Next-Gen Textbook",
        reference: "Ch 3.4 – Inverse",
        learn: [{ title: "Read 3.4", url: "https://www.khanacademy.org/" }],
        practice: {
          title: "Section 3.4 Exercises",
          description: "Complete the assigned exercises and upload a clear photo.",
        },
      },
      {
        kind: "guided",
        label: "eMath Guided Notes",
        reference: "Unit 3 Lesson 4",
        learn: [
          { title: "Video – Median-Median Line", url: "https://www.emathinstruction.com/" },
          { title: "Video – Correlation vs Causation", url: "https://www.youtube.com/" },
        ],
        practice: {
          title: "Lesson 4 Homework Set",
          description: "Find the median-median line for the given set. Show all work.",
        },
      },
      {
        kind: "custom",
        label: "Discovery Activity",
        reference: "Airline Schedule",
        learn: [{ title: "Airline Schedule – binning real timetable data" }],
        practice: {
          title: "Airline Schedule Write-Up",
          description: "Submit your bins, your summary points, and your fitted line.",
        },
      },
      {
        kind: "extra",
        label: "Extra Material",
        optional: true,
        learn: [{ title: "Correlation Simulator", url: "https://www.rossmanchance.com/" }],
      },
    ],
  },
  {
    id: "3.5",
    title: "Residuals & RMSE",
    date: "10/19",
    objectives: [
      "I can interpret the meaning of residuals",
      "I can compute the root mean square error",
    ],
    tracks: [
      {
        kind: "textbook",
        label: "Next-Gen Textbook",
        reference: "Ch 3.3 – Modeling",
        learn: [{ title: "Read 3.3 – Residual Analysis", url: "https://www.khanacademy.org/" }],
        practice: {
          title: "Section 3.3 Exercises",
          description: "Complete the residual and RMSE exercises. Upload your work.",
        },
      },
      {
        kind: "guided",
        label: "eMath Guided Notes",
        reference: "Unit 3 Lesson 5",
        learn: [{ title: "Video – Residuals & RMSE", url: "https://www.emathinstruction.com/" }],
        practice: {
          title: "Lesson 5 Homework Set",
          description: "Complete the homework set and upload your completion screenshot.",
        },
      },
      {
        kind: "custom",
        label: "Discovery Activity",
        reference: "Spring Experiment",
        learn: [{ title: "Spring Experiment – A Good Fit?" }],
        practice: {
          title: "Spring Experiment Write-Up",
          description: "Submit your residual plot and your judgement on the fit.",
        },
      },
      {
        kind: "extra",
        label: "Extra Material",
        optional: true,
        learn: [{ title: "Delta Math – Residuals Set", url: "https://www.deltamath.com/" }],
      },
    ],
  },
  {
    id: "3.6",
    title: "Linear Systems – Graphical",
    date: "10/20",
    objectives: [
      "I can estimate solutions to linear systems graphically and numerically",
      "I can describe how the property of equality relates to solving systems",
    ],
    tracks: [
      {
        kind: "textbook",
        label: "Next-Gen Textbook",
        reference: "Ch 6 – Systems",
        learn: [{ title: "Read Ch 6.1 – Solving Graphically", url: "https://www.khanacademy.org/" }],
        practice: {
          title: "Chapter 6 Exercises",
          description: "Graph each system and identify the solution. Upload your Desmos screenshot.",
        },
      },
      {
        kind: "guided",
        label: "eMath Guided Notes",
        reference: "Unit 3 Lesson 6",
        learn: [{ title: "Video – Systems Graphically", url: "https://www.emathinstruction.com/" }],
        practice: {
          title: "Lesson 6 Homework Set",
          description: "Complete the homework set and upload your screenshot.",
        },
      },
      {
        kind: "custom",
        label: "Discovery Activity",
        reference: "Population Trends",
        learn: [{ title: "Population Trends – when do the two curves cross?" }],
        practice: {
          title: "Population Trends Write-Up",
          description: "Submit your graph and your estimate of the crossing year.",
        },
      },
      {
        kind: "extra",
        label: "Extra Material",
        optional: true,
        learn: [{ title: "Desmos – Graphing Systems", url: "https://teacher.desmos.com/" }],
      },
    ],
  },
  {
    id: "3.7",
    title: "Linear Systems – Algebraic",
    date: "10/21",
    objectives: [
      "I can define linear descriptive vocabulary for systems",
      "I can solve a system algebraically",
      "I can create and solve real-world problems using systems",
    ],
    tracks: [
      {
        kind: "textbook",
        label: "Next-Gen Textbook",
        reference: "Ch 6.2 – Substitution & Elimination",
        learn: [{ title: "Read Ch 6.2", url: "https://www.khanacademy.org/" }],
        practice: {
          title: "Chapter 6.2 Exercises",
          description:
            "Complete the substitution and elimination set. Upload a photo of your work.",
        },
      },
      {
        kind: "guided",
        label: "eMath Guided Notes",
        reference: "Unit 3 Lesson 7",
        learn: [{ title: "Video – Solving Systems Algebraically", url: "https://www.emathinstruction.com/" }],
        practice: {
          title: "Lesson 7 Homework Set",
          description: "Complete the homework set and upload your screenshot.",
        },
      },
      {
        kind: "custom",
        label: "Discovery Activity",
        reference: "What's Your System?",
        learn: [{ title: "What's Your System? – build a system from a real scenario" }],
        practice: {
          title: "What's Your System? Write-Up",
          description: "Submit your scenario, your system, and your solution.",
        },
      },
      {
        kind: "extra",
        label: "Extra Material",
        optional: true,
        learn: [{ title: "Systems and Optimization – Chapter 6 extension" }],
      },
    ],
  },
];

function checkpoint(
  id: string,
  kind: Checkpoint["kind"],
  title: string,
  date: string,
  afterSectionId: string | null,
  note?: string
): Checkpoint {
  return { id, kind, title, date, afterSectionId, note };
}

const UNIT_1: Unit = {
  id: 1,
  title: "Functions & Relations",
  sections: [
    makeSection(1, 1, "Function Notation"),
    makeSection(1, 2, "Domain & Range"),
    makeSection(1, 3, "Piecewise Functions"),
    makeSection(1, 4, "Transformations"),
    makeSection(1, 5, "Inverse Functions"),
  ],
  checkpoints: [
    checkpoint("quiz-1a", "quiz", "Quiz 1A", "9/5", "1.3"),
    checkpoint("test-1", "test", "Unit 1 Test", "9/12", "1.5"),
  ],
};

const UNIT_2: Unit = {
  id: 2,
  title: "Quadratic Functions",
  sections: [
    makeSection(2, 1, "Vertex Form"),
    makeSection(2, 2, "Factoring Quadratics"),
    makeSection(2, 3, "Quadratic Formula"),
    makeSection(2, 4, "Completing the Square"),
    makeSection(2, 5, "Quadratic Applications"),
  ],
  checkpoints: [
    checkpoint("quiz-2a", "quiz", "Quiz 2A", "9/26", "2.3"),
    checkpoint("test-2", "test", "Unit 2 Test", "10/3", "2.5"),
  ],
};

const UNIT_3: Unit = {
  id: 3,
  title: "Linear Models and Systems",
  sections: UNIT_3_SECTIONS.map(buildSection),
  checkpoints: [
    checkpoint("quiz-3a", "quiz", "Quiz 3A", "10/12 or 10/13", "3.5"),
    checkpoint(
      "quiz-3b",
      "quiz",
      "Quiz 3B",
      "10/19 or 10/20",
      "3.7",
      "Mostly on 3.6 and 3.7, and revisits previous topics"
    ),
    checkpoint("test-3", "test", "Unit 3 Test", "10/26 or 10/27", "3.7"),
  ],
};

const UNIT_4: Unit = {
  id: 4,
  title: "Exponential & Logarithmic Functions",
  sections: [
    makeSection(4, 1, "Exponential Growth & Decay"),
    makeSection(4, 2, "Properties of Exponents"),
    makeSection(4, 3, "Introduction to Logarithms"),
    makeSection(4, 4, "Properties of Logarithms"),
    makeSection(4, 5, "Exponential & Log Models"),
  ],
  checkpoints: [
    checkpoint("quiz-4a", "quiz", "Quiz 4A", "11/9", "4.3"),
    checkpoint("test-4", "test", "Unit 4 Test", "11/16", "4.5"),
  ],
};

const UNIT_5: Unit = {
  id: 5,
  title: "Sequences & Series",
  sections: [
    makeSection(5, 1, "Arithmetic Sequences"),
    makeSection(5, 2, "Geometric Sequences"),
    makeSection(5, 3, "Series & Summation"),
    makeSection(5, 4, "Applications of Sequences"),
  ],
  checkpoints: [
    checkpoint("quiz-5a", "quiz", "Quiz 5A", "12/7", "5.2"),
    checkpoint("test-5", "test", "Unit 5 Test", "12/14", "5.4"),
  ],
};

export const DEMO_UNITS: Unit[] = [UNIT_1, UNIT_2, UNIT_3, UNIT_4, UNIT_5];

export const UNIT = UNIT_3;

/**
 * Shorthand for seeded progress, one code per track:
 *  C  complete and signed off      R  submitted, waiting on the teacher
 *  P  read it, practice still open H  stuck on practice
 *  HL stuck on the reading         S  just opened it
 *  -  not started
 */
type ProgressCode = "C" | "R" | "P" | "H" | "HL" | "S" | "-";

const CODE_STATES: Record<ProgressCode, TrackProgress> = {
  C: { learn: "done", practice: "done", practiceApproved: true },
  R: { learn: "done", practice: "done", practiceApproved: false },
  P: { learn: "done", practice: "available" },
  H: { learn: "done", practice: "help" },
  HL: { learn: "help", practice: "available" },
  S: { learn: "available", practice: "locked" },
  "-": { learn: "locked", practice: "locked" },
};

const DEMO_TRACK_ORDER: TrackKind[] = ["textbook", "guided", "custom", "extra"];

function seedSections(
  rows: Record<string, ProgressCode[]>
): Record<string, { tracks: Record<string, TrackProgress> }> {
  const sections: Record<string, { tracks: Record<string, TrackProgress> }> = {};

  for (const [sectionId, codes] of Object.entries(rows)) {
    const tracks: Record<string, TrackProgress> = {};
    DEMO_TRACK_ORDER.forEach((kind, i) => {
      const code = codes[i] ?? "-";
      tracks[stableTrackId(sectionId, kind)] = { ...CODE_STATES[code] };
    });
    sections[sectionId] = { tracks };
  }

  return sections;
}

const NOT_STARTED: ProgressCode[] = ["-", "-", "-", "-"];
const ALL_DONE: ProgressCode[] = ["C", "C", "C", "C"];

/**
 * Eight students spread across Unit 3. Nobody is past 3.4 — the progress gate
 * sits there by default. The spread is deliberately uneven per track so the
 * teacher grid shows what it is for: who is behind on which resource.
 */
export const DEMO_UNIT_3_PROGRESS: StudentProgress[] = [
  {
    studentId: "s1",
    unitId: 3,
    sections: seedSections({
      "3.1": ALL_DONE,
      "3.2": ["C", "C", "C", "P"],
      "3.3": ["C", "H", "P", "-"],
      "3.4": ["S", "S", "S", "S"],
      "3.5": NOT_STARTED,
      "3.6": NOT_STARTED,
      "3.7": NOT_STARTED,
    }),
  },
  {
    studentId: "s2",
    unitId: 3,
    sections: seedSections({
      "3.1": ALL_DONE,
      "3.2": ALL_DONE,
      "3.3": ALL_DONE,
      "3.4": ["C", "P", "P", "-"],
      "3.5": NOT_STARTED,
      "3.6": NOT_STARTED,
      "3.7": NOT_STARTED,
    }),
  },
  {
    studentId: "s3",
    unitId: 3,
    sections: seedSections({
      "3.1": ["C", "H", "P", "-"],
      "3.2": NOT_STARTED,
      "3.3": NOT_STARTED,
      "3.4": NOT_STARTED,
      "3.5": NOT_STARTED,
      "3.6": NOT_STARTED,
      "3.7": NOT_STARTED,
    }),
  },
  {
    studentId: "s4",
    unitId: 3,
    sections: seedSections({
      "3.1": ALL_DONE,
      "3.2": ALL_DONE,
      "3.3": ALL_DONE,
      "3.4": ["R", "R", "C", "-"],
      "3.5": NOT_STARTED,
      "3.6": NOT_STARTED,
      "3.7": NOT_STARTED,
    }),
  },
  {
    studentId: "s5",
    unitId: 3,
    sections: seedSections({
      "3.1": ALL_DONE,
      "3.2": ["C", "C", "C", "S"],
      "3.3": ["P", "C", "P", "-"],
      "3.4": NOT_STARTED,
      "3.5": NOT_STARTED,
      "3.6": NOT_STARTED,
      "3.7": NOT_STARTED,
    }),
  },
  {
    studentId: "s6",
    unitId: 3,
    sections: seedSections({
      "3.1": ALL_DONE,
      "3.2": ["C", "H", "H", "-"],
      "3.3": NOT_STARTED,
      "3.4": NOT_STARTED,
      "3.5": NOT_STARTED,
      "3.6": NOT_STARTED,
      "3.7": NOT_STARTED,
    }),
  },
  {
    studentId: "s7",
    unitId: 3,
    sections: seedSections({
      "3.1": ALL_DONE,
      "3.2": ALL_DONE,
      "3.3": ALL_DONE,
      "3.4": ["C", "C", "P", "-"],
      "3.5": NOT_STARTED,
      "3.6": NOT_STARTED,
      "3.7": NOT_STARTED,
    }),
  },
  {
    studentId: "s8",
    unitId: 3,
    sections: seedSections({
      "3.1": ALL_DONE,
      "3.2": ALL_DONE,
      "3.3": ["HL", "S", "S", "-"],
      "3.4": NOT_STARTED,
      "3.5": NOT_STARTED,
      "3.6": NOT_STARTED,
      "3.7": NOT_STARTED,
    }),
  },
];

/** Every section in the course, in order — the student view spans all units. */
export const DEMO_SECTIONS: Section[] = DEMO_UNITS.flatMap((u) => u.sections);

export const DEMO_CHECKPOINTS: Checkpoint[] = DEMO_UNITS.flatMap((u) => u.checkpoints);

function uniformSection(section: Section, code: ProgressCode) {
  return {
    tracks: Object.fromEntries(
      section.tracks.map((track) => [track.id, { ...CODE_STATES[code] }])
    ),
  };
}

/**
 * One record per student covering the whole year: the units before the current
 * one read as finished, Unit 3 carries the seeded spread, and the units after
 * it sit untouched behind the gate.
 */
export const DEMO_PROGRESS: StudentProgress[] = STUDENTS.map((student) => {
  const seeded = DEMO_UNIT_3_PROGRESS.find((p) => p.studentId === student.id);
  const sections: StudentProgress["sections"] = {};

  for (const unit of DEMO_UNITS) {
    for (const section of unit.sections) {
      if (unit.id === UNIT.id) {
        sections[section.id] =
          seeded?.sections[section.id] ?? uniformSection(section, "-");
      } else {
        sections[section.id] = uniformSection(section, unit.id < UNIT.id ? "C" : "-");
      }
    }
  }

  return { studentId: student.id, unitId: UNIT.id, sections };
});

function uniformProgress(unit: Unit, code: ProgressCode): StudentProgress[] {
  return STUDENTS.map((student) => ({
    studentId: student.id,
    unitId: unit.id,
    sections: Object.fromEntries(
      unit.sections.map((section) => [section.id, uniformSection(section, code)])
    ),
  }));
}

export function getDemoProgressForUnit(unitId: number): StudentProgress[] {
  if (unitId === 1 || unitId === 2) {
    return uniformProgress(DEMO_UNITS.find((u) => u.id === unitId)!, "C");
  }
  if (unitId === 4 || unitId === 5) {
    return uniformProgress(DEMO_UNITS.find((u) => u.id === unitId)!, "-");
  }
  return DEMO_UNIT_3_PROGRESS;
}

export function demoUnitsToCurriculum() {
  return DEMO_UNITS.map((unit) => ({
    id: `unit-${unit.id}`,
    title: `Unit ${unit.id}: ${unit.title}`,
    subunits: structuredClone(unit.sections),
    checkpoints: structuredClone(unit.checkpoints),
  }));
}

export const DEMO_DEFAULT_UNIT_INDEX = 2;
