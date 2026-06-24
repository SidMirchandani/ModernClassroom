import type { Section, StudentProgress, Unit } from "./types";
import { STUDENTS } from "./students";

export const DEMO_CLASS_NAME = "Algebra II, Honors";

function makeSection(
  unitNum: number,
  num: number,
  title: string,
  practiceNote?: string
): Section {
  const id = `${unitNum}.${num}`;
  return {
    id,
    title,
    objectives: [
      { id: `${id}.1`, text: `I can apply key concepts from ${title}` },
      { id: `${id}.2`, text: `I can solve problems involving ${title.toLowerCase()}` },
    ],
    learnResources: [
      { label: `Khan Academy – ${title}`, url: "https://www.khanacademy.org/" },
      { label: `Delta Math – ${id}`, url: "https://www.deltamath.com/" },
    ],
    practiceDescription:
      practiceNote ??
      `Complete the assigned practice for Section ${id} and upload a screenshot of your work.`,
    extraMaterials: [{ label: "Desmos Exploration", url: "https://www.desmos.com/" }],
  };
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
    {
      id: "3.1",
      title: "Slope & Recursive Formulas",
      objectives: [
        { id: "3.1.1", text: "I can compute slope given any scenario" },
        { id: "3.1.2", text: "I can relate recursive formulas to linear equations" },
        { id: "3.1.3", text: "I can interpret slope and intercepts in relation to a problem" },
        { id: "3.1.4", text: "I can interpret and classify: Recursion, linear and graphical models" },
      ],
      learnResources: [
        { label: "Khan Academy – Slope", url: "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:linear-equations-graphs" },
        { label: "Delta Math – Section 3.1", url: "https://www.deltamath.com/" },
      ],
      practiceDescription: "Complete the assigned Delta Math problems for Section 3.1 and upload a screenshot of your completed score.",
      extraMaterials: [{ label: "Calculator Notes – Slope", url: "https://www.desmos.com/" }],
    },
    {
      id: "3.2",
      title: "Linear Equations as Models",
      objectives: [
        { id: "3.2.1", text: "I can create linear equations to model data" },
        { id: "3.2.2", text: "I can define linear descriptive vocabulary" },
        { id: "3.2.3", text: "I can write and interpret all 5 forms of linear equations" },
      ],
      learnResources: [
        { label: "Khan Academy – Writing Linear Equations", url: "https://www.khanacademy.org/" },
        { label: "Edpuzzle – Section 3.2 Video", url: "https://edpuzzle.com/" },
      ],
      practiceDescription: "Complete the Section 3.2 worksheet and upload a photo or scan of your finished work.",
      extraMaterials: [{ label: "Desmos Activity – Lines", url: "https://www.desmos.com/activities" }],
    },
    {
      id: "3.3",
      title: "Line of Best Fit",
      objectives: [
        { id: "3.3.1", text: "I can create and interpret the line of best fit by hand" },
        { id: "3.3.2", text: "I can use a line of best fit to interpolate and extrapolate data" },
      ],
      learnResources: [
        { label: "Khan Academy – Scatter Plots", url: "https://www.khanacademy.org/" },
        { label: "CK-12 – Line of Best Fit", url: "https://www.ck12.org/" },
      ],
      practiceDescription: "Using the provided data set, draw a line of best fit by hand and answer the analysis questions. Upload a photo of your work.",
      extraMaterials: [{ label: "Desmos Regression Explorer", url: "https://www.desmos.com/" }],
    },
    {
      id: "3.4",
      title: "Median-Median Line",
      objectives: [
        { id: "3.4.1", text: "I can create appropriate bins for a data set" },
        { id: "3.4.2", text: "I can find the median-median line of a small data set by hand" },
        { id: "3.4.3", text: "I can classify causation and correlation, and predicted outcomes" },
      ],
      learnResources: [
        { label: "Notes – Median-Median Line", url: "https://www.khanacademy.org/" },
        { label: "Video – Correlation vs Causation", url: "https://www.youtube.com/" },
      ],
      practiceDescription: "Complete the median-median line practice problems. Show all work and upload a clear photo.",
      extraMaterials: [{ label: "Correlation Simulator", url: "https://www.rossmanchance.com/" }],
    },
    {
      id: "3.5",
      title: "Residuals & RMSE",
      objectives: [
        { id: "3.5.1", text: "I can interpret the meaning of residuals" },
        { id: "3.5.2", text: "I can compute the root mean square error" },
      ],
      learnResources: [
        { label: "Khan Academy – Residuals", url: "https://www.khanacademy.org/" },
        { label: "Edpuzzle – RMSE Explained", url: "https://edpuzzle.com/" },
      ],
      practiceDescription: "Complete the residuals and RMSE problems on Delta Math. Upload your completion screenshot.",
      extraMaterials: [{ label: "RMSE Calculator Tool", url: "https://www.desmos.com/" }],
    },
    {
      id: "3.6",
      title: "Linear Systems – Graphical",
      objectives: [
        { id: "3.6.1", text: "I can estimate solutions to linear systems graphically and numerically" },
        { id: "3.6.2", text: "I can describe how the property of equality relates to solving systems" },
      ],
      learnResources: [
        { label: "Khan Academy – Systems of Equations", url: "https://www.khanacademy.org/" },
        { label: "Desmos – Graphing Systems", url: "https://www.desmos.com/" },
      ],
      practiceDescription: "Graph each system of equations and identify the solution. Upload a screenshot from Desmos showing your graphs.",
      extraMaterials: [{ label: "Systems of Equations Activity", url: "https://teacher.desmos.com/" }],
    },
    {
      id: "3.7",
      title: "Linear Systems – Algebraic",
      objectives: [
        { id: "3.7.1", text: "I can define linear descriptive vocabulary for systems" },
        { id: "3.7.2", text: "I can solve a system algebraically" },
        { id: "3.7.3", text: "I can create and solve real-world problems using systems" },
      ],
      learnResources: [
        { label: "Khan Academy – Substitution", url: "https://www.khanacademy.org/" },
        { label: "Khan Academy – Elimination", url: "https://www.khanacademy.org/" },
      ],
      practiceDescription: "Complete the algebraic systems worksheet (substitution and elimination). Upload a photo of your completed work.",
      extraMaterials: [{ label: "Real-World Systems Problems", url: "https://www.desmos.com/" }],
    },
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
