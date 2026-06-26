import type { ContentBlock, Section, StudentProgress, Unit } from "./types";
import { STUDENTS } from "./students";

export const DEMO_CLASS_NAME = "Algebra II, Honors";
export const DEMO_CLASS_CODE = "482910";

function makeSection(
  unitNum: number,
  num: number,
  title: string,
  practiceNote?: string
): Section {
  const id = `${unitNum}.${num}`;
  const blocks: ContentBlock[] = [
    {
      id: `learn-${id}-1`,
      type: "learn",
      title: `Khan Academy – ${title}`,
      attachments: [
        {
          id: `learn-${id}-1-a`,
          kind: "link",
          label: `Khan Academy – ${title}`,
          url: "https://www.khanacademy.org/",
        },
      ],
    },
    {
      id: `learn-${id}-2`,
      type: "learn",
      title: `Delta Math – ${id}`,
      attachments: [
        {
          id: `learn-${id}-2-a`,
          kind: "link",
          label: `Delta Math – ${id}`,
          url: "https://www.deltamath.com/",
        },
      ],
    },
    {
      id: `practice-${id}`,
      type: "practice",
      title: "Practice Assignment",
      description:
        practiceNote ??
        `Complete the assigned practice for Section ${id} and upload a screenshot of your work.`,
      attachments: [],
    },
    {
      id: `extra-${id}`,
      type: "extra",
      title: "Desmos Exploration",
      attachments: [
        {
          id: `extra-${id}-a`,
          kind: "link",
          label: "Desmos Exploration",
          url: "https://www.desmos.com/",
        },
      ],
    },
  ];

  return {
    id,
    title,
    objectives: [
      { id: `${id}.1`, text: `I can apply key concepts from ${title}` },
      { id: `${id}.2`, text: `I can solve problems involving ${title.toLowerCase()}` },
    ],
    blocks,
  };
}

function legacySection(
  id: string,
  title: string,
  objectives: Section["objectives"],
  learnResources: { label: string; url: string }[],
  practiceDescription: string,
  extraMaterials: { label: string; url: string }[]
): Section {
  const blocks: ContentBlock[] = [];

  learnResources.forEach((r, i) => {
    blocks.push({
      id: `${id}-learn-${i}`,
      type: "learn",
      title: r.label,
      attachments: [
        { id: `${id}-learn-${i}-a`, kind: "link", label: r.label, url: r.url },
      ],
    });
  });

  if (practiceDescription.trim()) {
    blocks.push({
      id: `${id}-practice`,
      type: "practice",
      title: "Practice Assignment",
      description: practiceDescription,
      attachments: [],
    });
  }

  extraMaterials.forEach((r, i) => {
    blocks.push({
      id: `${id}-extra-${i}`,
      type: "extra",
      title: r.label,
      attachments: [
        { id: `${id}-extra-${i}-a`, kind: "link", label: r.label, url: r.url },
      ],
    });
  });

  return { id, title, objectives, blocks };
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
  quizzes: [{ id: "quiz-1a", title: "Quiz 1A", dueDate: "9/5", afterSection: "1.3" }],
  testDate: "9/12",
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
  quizzes: [{ id: "quiz-2a", title: "Quiz 2A", dueDate: "9/26", afterSection: "2.3" }],
  testDate: "10/3",
};

const UNIT_3: Unit = {
  id: 3,
  title: "Linear Models and Systems",
  sections: [
    legacySection(
      "3.1",
      "Slope & Recursive Formulas",
      [
        { id: "3.1.1", text: "I can compute slope given any scenario" },
        { id: "3.1.2", text: "I can relate recursive formulas to linear equations" },
        { id: "3.1.3", text: "I can interpret slope and intercepts in relation to a problem" },
        { id: "3.1.4", text: "I can interpret and classify: Recursion, linear and graphical models" },
      ],
      [
        { label: "Khan Academy – Slope", url: "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:linear-equations-graphs" },
        { label: "Delta Math – Section 3.1", url: "https://www.deltamath.com/" },
      ],
      "Complete the assigned Delta Math problems for Section 3.1 and upload a screenshot of your completed score.",
      [{ label: "Calculator Notes – Slope", url: "https://www.desmos.com/" }]
    ),
    legacySection(
      "3.2",
      "Linear Equations as Models",
      [
        { id: "3.2.1", text: "I can create linear equations to model data" },
        { id: "3.2.2", text: "I can define linear descriptive vocabulary" },
        { id: "3.2.3", text: "I can write and interpret all 5 forms of linear equations" },
      ],
      [
        { label: "Khan Academy – Writing Linear Equations", url: "https://www.khanacademy.org/" },
        { label: "Edpuzzle – Section 3.2 Video", url: "https://edpuzzle.com/" },
      ],
      "Complete the Section 3.2 worksheet and upload a photo or scan of your finished work.",
      [{ label: "Desmos Activity – Lines", url: "https://www.desmos.com/activities" }]
    ),
    legacySection(
      "3.3",
      "Line of Best Fit",
      [
        { id: "3.3.1", text: "I can create and interpret the line of best fit by hand" },
        { id: "3.3.2", text: "I can use a line of best fit to interpolate and extrapolate data" },
      ],
      [
        { label: "Khan Academy – Scatter Plots", url: "https://www.khanacademy.org/" },
        { label: "CK-12 – Line of Best Fit", url: "https://www.ck12.org/" },
      ],
      "Using the provided data set, draw a line of best fit by hand and answer the analysis questions. Upload a photo of your work.",
      [{ label: "Desmos Regression Explorer", url: "https://www.desmos.com/" }]
    ),
    legacySection(
      "3.4",
      "Median-Median Line",
      [
        { id: "3.4.1", text: "I can create appropriate bins for a data set" },
        { id: "3.4.2", text: "I can find the median-median line of a small data set by hand" },
        { id: "3.4.3", text: "I can classify causation and correlation, and predicted outcomes" },
      ],
      [
        { label: "Notes – Median-Median Line", url: "https://www.khanacademy.org/" },
        { label: "Video – Correlation vs Causation", url: "https://www.youtube.com/" },
      ],
      "Complete the median-median line practice problems. Show all work and upload a clear photo.",
      [{ label: "Correlation Simulator", url: "https://www.rossmanchance.com/" }]
    ),
    legacySection(
      "3.5",
      "Residuals & RMSE",
      [
        { id: "3.5.1", text: "I can interpret the meaning of residuals" },
        { id: "3.5.2", text: "I can compute the root mean square error" },
      ],
      [
        { label: "Khan Academy – Residuals", url: "https://www.khanacademy.org/" },
        { label: "Edpuzzle – RMSE Explained", url: "https://edpuzzle.com/" },
      ],
      "Complete the residuals and RMSE problems on Delta Math. Upload your completion screenshot.",
      [{ label: "RMSE Calculator Tool", url: "https://www.desmos.com/" }]
    ),
    legacySection(
      "3.6",
      "Linear Systems – Graphical",
      [
        { id: "3.6.1", text: "I can estimate solutions to linear systems graphically and numerically" },
        { id: "3.6.2", text: "I can describe how the property of equality relates to solving systems" },
      ],
      [
        { label: "Khan Academy – Systems of Equations", url: "https://www.khanacademy.org/" },
        { label: "Desmos – Graphing Systems", url: "https://www.desmos.com/" },
      ],
      "Graph each system of equations and identify the solution. Upload a screenshot from Desmos showing your graphs.",
      [{ label: "Systems of Equations Activity", url: "https://teacher.desmos.com/" }]
    ),
    legacySection(
      "3.7",
      "Linear Systems – Algebraic",
      [
        { id: "3.7.1", text: "I can define linear descriptive vocabulary for systems" },
        { id: "3.7.2", text: "I can solve a system algebraically" },
        { id: "3.7.3", text: "I can create and solve real-world problems using systems" },
      ],
      [
        { label: "Khan Academy – Substitution", url: "https://www.khanacademy.org/" },
        { label: "Khan Academy – Elimination", url: "https://www.khanacademy.org/" },
      ],
      "Complete the algebraic systems worksheet (substitution and elimination). Upload a photo of your completed work.",
      [{ label: "Real-World Systems Problems", url: "https://www.desmos.com/" }]
    ),
  ],
  quizzes: [
    { id: "quiz-3a", title: "Quiz 3A", dueDate: "10/12 or 10/13", afterSection: "3.5" },
    { id: "quiz-3b", title: "Quiz 3B", dueDate: "10/19 or 10/20", afterSection: "3.7" },
  ],
  testDate: "10/26 or 10/27",
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
  quizzes: [{ id: "quiz-4a", title: "Quiz 4A", dueDate: "11/9", afterSection: "4.3" }],
  testDate: "11/16",
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
  quizzes: [{ id: "quiz-5a", title: "Quiz 5A", dueDate: "12/7", afterSection: "5.2" }],
  testDate: "12/14",
};

export const DEMO_UNITS: Unit[] = [UNIT_1, UNIT_2, UNIT_3, UNIT_4, UNIT_5];

export const UNIT = UNIT_3;

export const DEMO_UNIT_3_PROGRESS: StudentProgress[] = [
  {
    studentId: "s1",
    unitId: 3,
    sections: {
      "3.1": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.2": { learn: "done", practice: "done", extra: "available", practiceApproved: true },
      "3.3": { learn: "done", practice: "help", extra: "available" },
      "3.4": { learn: "available", practice: "locked", extra: "locked" },
      "3.5": { learn: "locked", practice: "locked", extra: "locked" },
      "3.6": { learn: "locked", practice: "locked", extra: "locked" },
      "3.7": { learn: "locked", practice: "locked", extra: "locked" },
    },
  },
  {
    studentId: "s2",
    unitId: 3,
    sections: {
      "3.1": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.2": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.3": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.4": { learn: "done", practice: "available", extra: "locked", practiceApproved: true },
      "3.5": { learn: "locked", practice: "locked", extra: "locked" },
      "3.6": { learn: "locked", practice: "locked", extra: "locked" },
      "3.7": { learn: "locked", practice: "locked", extra: "locked" },
    },
  },
  {
    studentId: "s3",
    unitId: 3,
    sections: {
      "3.1": { learn: "done", practice: "help", extra: "available" },
      "3.2": { learn: "locked", practice: "locked", extra: "locked" },
      "3.3": { learn: "locked", practice: "locked", extra: "locked" },
      "3.4": { learn: "locked", practice: "locked", extra: "locked" },
      "3.5": { learn: "locked", practice: "locked", extra: "locked" },
      "3.6": { learn: "locked", practice: "locked", extra: "locked" },
      "3.7": { learn: "locked", practice: "locked", extra: "locked" },
    },
  },
  {
    studentId: "s4",
    unitId: 3,
    sections: {
      "3.1": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.2": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.3": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.4": { learn: "done", practice: "done", extra: "locked", practiceApproved: false },
      "3.5": { learn: "locked", practice: "locked", extra: "locked" },
      "3.6": { learn: "locked", practice: "locked", extra: "locked" },
      "3.7": { learn: "locked", practice: "locked", extra: "locked" },
    },
  },
  {
    studentId: "s5",
    unitId: 3,
    sections: {
      "3.1": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.2": { learn: "done", practice: "done", extra: "available", practiceApproved: true },
      "3.3": { learn: "done", practice: "available", extra: "locked" },
      "3.4": { learn: "locked", practice: "locked", extra: "locked" },
      "3.5": { learn: "locked", practice: "locked", extra: "locked" },
      "3.6": { learn: "locked", practice: "locked", extra: "locked" },
      "3.7": { learn: "locked", practice: "locked", extra: "locked" },
    },
  },
  {
    studentId: "s6",
    unitId: 3,
    sections: {
      "3.1": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.2": { learn: "done", practice: "help", extra: "available" },
      "3.3": { learn: "locked", practice: "locked", extra: "locked" },
      "3.4": { learn: "locked", practice: "locked", extra: "locked" },
      "3.5": { learn: "locked", practice: "locked", extra: "locked" },
      "3.6": { learn: "locked", practice: "locked", extra: "locked" },
      "3.7": { learn: "locked", practice: "locked", extra: "locked" },
    },
  },
  {
    studentId: "s7",
    unitId: 3,
    sections: {
      "3.1": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.2": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.3": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.4": { learn: "done", practice: "available", extra: "locked", practiceApproved: true },
      "3.5": { learn: "locked", practice: "locked", extra: "locked" },
      "3.6": { learn: "locked", practice: "locked", extra: "locked" },
      "3.7": { learn: "locked", practice: "locked", extra: "locked" },
    },
  },
  {
    studentId: "s8",
    unitId: 3,
    sections: {
      "3.1": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.2": { learn: "done", practice: "done", extra: "done", practiceApproved: true },
      "3.3": { learn: "help", practice: "locked", extra: "locked" },
      "3.4": { learn: "locked", practice: "locked", extra: "locked" },
      "3.5": { learn: "locked", practice: "locked", extra: "locked" },
      "3.6": { learn: "locked", practice: "locked", extra: "locked" },
      "3.7": { learn: "locked", practice: "locked", extra: "locked" },
    },
  },
];

export const DEMO_PROGRESS = DEMO_UNIT_3_PROGRESS;

function allCompleteProgress(unit: Unit): StudentProgress[] {
  return STUDENTS.map((s) => ({
    studentId: s.id,
    unitId: unit.id,
    sections: Object.fromEntries(
      unit.sections.map((sec) => [
        sec.id,
        { learn: "done" as const, practice: "done" as const, extra: "done" as const, practiceApproved: true },
      ])
    ),
  }));
}

function allNotStartedProgress(unit: Unit): StudentProgress[] {
  return STUDENTS.map((s) => ({
    studentId: s.id,
    unitId: unit.id,
    sections: Object.fromEntries(
      unit.sections.map((sec) => [
        sec.id,
        { learn: "locked" as const, practice: "locked" as const, extra: "locked" as const },
      ])
    ),
  }));
}

export function getDemoProgressForUnit(unitId: number): StudentProgress[] {
  if (unitId === 1 || unitId === 2) {
    return allCompleteProgress(DEMO_UNITS.find((u) => u.id === unitId)!);
  }
  if (unitId === 4 || unitId === 5) {
    return allNotStartedProgress(DEMO_UNITS.find((u) => u.id === unitId)!);
  }
  return DEMO_UNIT_3_PROGRESS;
}

export function demoUnitsToCurriculum() {
  return DEMO_UNITS.map((unit) => ({
    id: `unit-${unit.id}`,
    title: `Unit ${unit.id}: ${unit.title}`,
    subunits: structuredClone(unit.sections),
  }));
}

export const DEMO_DEFAULT_UNIT_INDEX = 2;
