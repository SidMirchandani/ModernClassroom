import { v4 as uuidv4 } from "uuid";
import type { CurriculumUnit } from "./db/types";
import type {
  Checkpoint,
  CheckpointKind,
  ContentBlock,
  ResourceTrack,
  Section,
  TrackKind,
} from "./types";
import { stableTrackId } from "./section-tracks";

/**
 * Course skeletons taken from the 2026 class timeline sheet: the unit order,
 * the section numbering, the due date for each section, and where
 * each of the three resources covers it. The resource slots come in empty —
 * the teacher attaches the actual documents, keys and videos as the year runs.
 */

/** [sectionId, title, dueDate, textbookRef, secondRef, guidedRef] */
type SectionRow = [
  id: string,
  title: string,
  date: string,
  textbook: string,
  second: string,
  guided: string,
];

/** [kind, title, date, afterSectionId, note?] */
type CheckpointRow = [
  kind: CheckpointKind,
  title: string,
  date: string,
  after: string,
  note?: string,
];

interface UnitRow {
  title: string;
  sections: SectionRow[];
  checkpoints: CheckpointRow[];
}

export interface CourseTemplate {
  id: string;
  name: string;
  /** One line for the picker. */
  summary: string;
  /** The three resources this course runs on, in the order they appear. */
  tracks: { kind: TrackKind; label: string }[];
  units: UnitRow[];
}

const ALGEBRA_2: CourseTemplate = {
  id: "algebra-2",
  name: "Algebra II, Honors",
  summary:
    "Eleven units on the Discovery sequence, paired with the Next-Gen textbook and eMath guided notes.",
  tracks: [
    { kind: "textbook", label: "Next-Gen Textbook" },
    { kind: "custom", label: "Discovery Activity" },
    { kind: "guided", label: "eMath Guided Notes" },
  ],
  units: [
    {
      title: "Unit 1: Sequences",
      sections: [
        ["1.1", "Monitoring Inventory", "9/14", "Ch 1.1", "Monitoring Inventory – Technology", "Unit 1 Lesson 1"],
        ["1.2", "Rebound Heights", "9/15", "Ch 1.2", "Rebound / Super Stairs", "Unit 1 Lesson 2"],
        ["1.3", "Doses of Medicine", "9/16", "Ch 1.3", "Doses of Medicine", "Unit 1 Lesson 3"],
        ["1.4", "Recursion and Matching", "9/17", "Ch 1.4", "Match Them Up / Sort and Solve", "Unit 1 Lesson 4"],
        ["1.5", "Modelling Expenditure", "9/22", "Ch 1.5", "Life's Expenditure", "Unit 1 Lesson 5"],
      ],
      checkpoints: [
        ["quiz", "Quiz 1", "9/18", "1.4"],
        ["project", "Sequences Project", "9/23", "1.5"],
        ["test", "Unit 1 Test", "9/25", "1.5"],
      ],
    },
    {
      title: "Unit 2: Central Tendency and Dot Plots",
      sections: [
        ["2.1", "Pulse Rates", "9/30", "Ch 2.1", "Pulse Rates / Measuring Up", "Unit 2 Lesson 1"],
        ["2.2", "Good Design", "10/1", "Ch 2.2", "Good Design / Coffee Shop", "Unit 2 Lesson 2"],
        ["2.3", "Stem-and-Leaf Plots", "10/2", "Ch 2.3", "Eating on the Run", "Unit 2 Lesson 3"],
      ],
      checkpoints: [["test", "Unit 2 Test", "10/8", "2.3"]],
    },
    {
      title: "Unit 3: Linear Models and Systems",
      sections: [
        ["3.1", "Slope & Recursive Formulas", "10/12", "Ch 3.1 – Linear Change", "Match Point", "Unit 3 Lesson 1"],
        ["3.2", "Linear Equations as Models", "10/13", "Ch 3.2 – Forms", "Balloon Blastoff", "Unit 3 Lesson 2"],
        ["3.3", "Line of Best Fit", "10/14", "Ch 11 – Least Squares", "The Wave", "Unit 3 Lesson 3"],
        ["3.4", "Median-Median Line", "10/15", "Ch 3.4 – Inverse", "Airline Schedule", "Unit 3 Lesson 4"],
        ["3.5", "Residuals & RMSE", "10/19", "Ch 3.3 – Modeling", "Spring Experiment", "Unit 3 Lesson 5"],
        ["3.6", "Linear Systems – Graphical", "10/20", "Ch 6 – Systems", "Population Trends", "Unit 3 Lesson 6"],
        ["3.7", "Linear Systems – Algebraic", "10/21", "Ch 6.2 – Substitution & Elimination", "What's Your System?", "Unit 3 Lesson 7"],
      ],
      checkpoints: [
        ["quiz", "Quiz 3A", "10/12 or 10/13", "3.5"],
        ["quiz", "Quiz 3B", "10/19 or 10/20", "3.7", "Mostly on 3.6 and 3.7, and revisits previous topics"],
        ["checkpoint", "Cumulative Checkpoint", "10/23", "3.7"],
        ["test", "Unit 3 Test", "10/26 or 10/27", "3.7"],
      ],
    },
    {
      title: "Unit 4: Functions, Relations and Transformations",
      sections: [
        ["4.1", "Graph a Story", "10/29", "Ch 4.1", "Graph a Story", "Unit 4 Lesson 1"],
        ["4.2", "Step Functions", "10/30", "Ch 4.2", "To Be or Not To Be?", "Unit 4 Lesson 2"],
        ["4.3", "Translations", "11/9", "Ch 4.3", "Movin' Around", "Unit 4 Lesson 3"],
        ["4.4", "Building Graphs", "11/10", "Ch 4.4", "Make My Graph / Coin Fountain", "Unit 4 Lesson 4"],
        ["4.5", "Reflections", "11/11", "Ch 4.5", "Take a Moment to Reflect", "Unit 4 Lesson 5"],
        ["4.6", "Periodic Motion", "11/13", "Ch 4.6", "The Pendulum, Part I", "Unit 4 Lesson 6"],
        ["4.7", "Circles and Conics", "11/16", "Ch 4.7", "When Is a Circle Not a Circle?", "Unit 4 Lesson 7"],
        ["4.8", "Transformations in Context", "11/17", "Ch 4.8", "Lookin' Up", "Unit 4 Lesson 8"],
      ],
      checkpoints: [
        ["quiz", "Quiz 4A", "11/12", "4.5"],
        ["project", "Piecewise Pictures", "11/18", "4.8"],
        ["test", "Unit 4 Test", "11/23", "4.8"],
      ],
    },
    {
      title: "Unit 5: Exponents, Powers and Logarithms",
      sections: [
        ["5.1", "Radioactive Decay", "11/30", "Ch 5.1", "Radioactive Decay", "Unit 5 Lesson 1"],
        ["5.2", "Properties of Exponents", "12/1", "Ch 5.2", "Properties of Exponents", "Unit 5 Lesson 2"],
        ["5.3", "Rational Exponents", "12/2", "Ch 5.3", "Getting to the Root / Powers of 10", "Unit 5 Lesson 3"],
        ["5.4", "Applications of Power", "12/3", "Ch 5.4", "Application of Power", "Unit 5 Lesson 4"],
        ["5.5", "Inverse Functions", "12/7", "Ch 5.5", "The Inverse / Time Travel", "Unit 5 Lesson 5"],
        ["5.6", "Exponents and Logarithms", "12/8", "Ch 5.6", "Exponents and Logarithms", "Unit 5 Lesson 6"],
        ["5.7", "Properties of Logarithms", "12/9", "Ch 5.7", "Properties of Logarithms", "Unit 5 Lesson 7"],
        ["5.8", "Modelling Cooling", "12/10", "Ch 5.8", "Cooling / Income by Gender", "Unit 5 Lesson 8"],
      ],
      checkpoints: [
        ["quiz", "Quiz 5A", "12/4", "5.4"],
        ["project", "Cost of Living", "12/11", "5.8"],
        ["test", "Unit 5 Test", "12/16", "5.8"],
      ],
    },
    {
      title: "Unit 6: Matrices and Systems",
      sections: [
        ["6.1", "Chilly Choices", "12/18", "Ch 6.1", "Chilly Choices", "Unit 6 Lesson 1"],
        ["6.2", "Find Your Place", "12/21", "Ch 6.2", "Find Your Place", "Unit 6 Lesson 2"],
        ["6.3", "Inverse Matrices", "12/22", "Ch 6.3", "Inverse Matrix", "Unit 6 Lesson 3"],
        ["6.4", "Row Reduction", "12/23", "Ch 6.4", "Row Reduction Method", "Unit 6 Lesson 4"],
        ["6.5", "Paying for College", "1/5", "Ch 6.5", "Paying for College", "Unit 6 Lesson 5"],
        ["6.6", "Maximizing Profit", "1/6", "Ch 6.6", "Maximizing Profit / Nutritional Elements", "Unit 6 Lesson 6"],
      ],
      checkpoints: [
        ["quiz", "Quiz 6A", "1/4", "6.4"],
        ["test", "Unit 6 Test", "1/11", "6.6"],
      ],
    },
    {
      title: "Unit 7: Quadratic and Polynomial Functions",
      sections: [
        ["7.1", "Free Fall", "1/13", "Ch 7.1 – Features of Quadratics", "Free Fall", "Unit 7 Lesson 1"],
        ["7.2", "Rolling Along", "1/14", "Ch 7.2 – Factoring", "Rolling Along", "Unit 7 Lesson 2"],
        ["7.3", "Completing the Square", "1/15", "Ch 7.6 – Complete the Square", "Complete the Square", "Unit 7 Lesson 3"],
        ["7.4", "Projectile Modelling", "1/19", "Ch 7.5 – All Methods", "How High Can You Go?", "Unit 7 Lesson 4"],
        ["7.5", "Complex Arithmetic", "1/21", "Ch 7.7 – Zero Product", "Complex Arithmetic / Mandelbrot Set", "Unit 7 Lesson 5"],
        ["7.6", "Optimisation", "1/22", "Ch 7.8 – Solve Systems", "Box Factory", "Unit 7 Lesson 6"],
        ["7.7", "Largest Triangle", "1/25", "Ch 7.9 – Modeling", "Largest Triangle", "Unit 7 Lesson 7"],
        ["7.8", "Finding Solutions", "1/26", "Ch 7.9 – Modeling", "Finding Solutions", "Unit 7 Lesson 8"],
      ],
      checkpoints: [
        ["quiz", "Quiz 7A", "1/20", "7.4"],
        ["quiz", "Quiz 7B", "1/27", "7.8"],
        ["test", "Unit 7 Test", "2/1", "7.8"],
      ],
    },
    {
      title: "Unit 8: Statistics",
      sections: [
        ["8.1", "Designing a Study", "2/4", "Ch 11.1", "Designing a Study", "Statistics Lesson 1"],
        ["8.2", "Pencil Lengths", "2/5", "Ch 11.2", "Pencil Lengths / Simpson's Paradox", "Statistics Lesson 2"],
        ["8.3", "The Normal Curve", "2/8", "Ch 11.3", "The Normal Curve", "Statistics Lesson 3"],
        ["8.4", "Keeping Score", "2/9", "Ch 11.4", "Keeping Score", "Statistics Lesson 4"],
        ["8.5", "Correlation vs Causation", "2/11", "Ch 11.5", "Looking for Connections", "Statistics Lesson 5"],
        ["8.6", "Least-Squares Regression", "2/12", "Ch 11.6", "Spin Time – LSRL", "Statistics Lesson 6"],
      ],
      checkpoints: [
        ["quiz", "Statistics Quiz", "2/10", "8.4"],
        ["test", "Statistics Test", "2/19", "8.6"],
      ],
    },
    {
      title: "Unit 9: Conic Sections",
      sections: [
        ["9.1", "Bucket Race", "2/23", "Ch 8.1", "Bucket Race", "Unit 8 Lesson 1"],
        ["9.2", "Slice of Light", "2/24", "Ch 8.2", "Slice of Light", "Unit 8 Lesson 2"],
        ["9.3", "Fold a Parabola", "2/25", "Ch 8.3", "Fold a Parabola", "Unit 8 Lesson 3"],
        ["9.4", "Passing By", "2/26", "Ch 8.4", "Passing By", "Unit 8 Lesson 4"],
        ["9.5", "Systems of Conics", "3/2", "Ch 8.5", "System of Conic Equations", "Unit 8 Lesson 5"],
        ["9.6", "Breaking Point", "3/3", "Ch 8.6", "Breaking Point", "Unit 8 Lesson 6"],
        ["9.7", "Asymptotes and Holes", "3/4", "Ch 8.7", "Asymptotes and Holes", "Unit 8 Lesson 7"],
        ["9.8", "Cyclic Hyperbolas", "3/5", "Ch 8.8", "Cyclic Hyperbolas", "Unit 8 Lesson 8"],
      ],
      checkpoints: [
        ["quiz", "Quiz 9A", "3/1", "9.4"],
        ["quiz", "Quiz 9B", "3/8", "9.8"],
        ["project", "Solar Oven Conic Construction", "3/9", "9.8"],
        ["test", "Unit 9 Test", "3/10", "9.8"],
      ],
    },
    {
      title: "Unit 10: Trigonometry",
      sections: [
        ["10.1", "Steep Steps", "3/12", "Ch 12.1", "Steep Steps", "Unit 12 Lesson 1"],
        ["10.2", "Oblique Triangles", "3/15", "Ch 12.2", "Oblique Triangles", "Unit 12 Lesson 2"],
        ["10.3", "Around the Corner", "3/16", "Ch 12.3", "Around the Corner", "Unit 12 Lesson 3"],
        ["10.4", "Extending Trig Functions", "3/17", "Ch 12.4", "Extending Trig Functions", "Unit 12 Lesson 4"],
        ["10.5", "Vector Addition", "3/19", "Ch 12.5", "Vector Add / Sub", "Unit 12 Lesson 5"],
        ["10.6", "Parametric Walk", "3/22", "Ch 12.6", "Parametric Walk", "Unit 12 Lesson 6"],
      ],
      checkpoints: [
        ["quiz", "Trigonometry Quiz", "3/18", "10.4"],
        ["test", "Unit 10 Test", "3/25", "10.6"],
      ],
    },
    {
      title: "Unit 11: Trigonometric Functions",
      sections: [
        ["11.1", "Paddle Wheel", "4/7", "Ch 13.1", "Paddle Wheel", "Unit 13 Lesson 1"],
        ["11.2", "Radian Protractor", "4/8", "Ch 13.2", "Radian Protractor", "Unit 13 Lesson 2"],
        ["11.3", "Tracing Parent Graphs", "4/9", "Ch 13.3", "Tracing Parent Graphs", "Unit 13 Lesson 3"],
        ["11.4", "Exploring the Inverse", "4/13", "Ch 13.4", "Exploring the Inverse", "Unit 13 Lesson 4"],
        ["11.5", "Bouncing Spring", "4/14", "Ch 13.5", "Bouncing Spring / Sunrise, Sunset", "Unit 13 Lesson 5"],
        ["11.6", "Pythagorean Identities", "4/15", "Ch 13.6", "Pythagorean Identities", "Unit 13 Lesson 6"],
        ["11.7", "Sound Waves", "4/16", "Ch 13.7", "Sound Wave", "Unit 13 Lesson 7"],
      ],
      checkpoints: [
        ["quiz", "Quiz 11A", "4/12", "11.3"],
        ["project", "Rose Curves", "4/19", "11.7"],
        ["test", "Unit 11 Test", "4/22", "11.7"],
      ],
    },
  ],
};

const AP_PRECALCULUS: CourseTemplate = {
  id: "ap-precalculus",
  name: "AP Precalculus",
  summary:
    "The four CED units, aligned to the textbook chapters and The Algebros guided notes.",
  tracks: [
    { kind: "textbook", label: "Textbook" },
    { kind: "apclassroom", label: "AP Classroom" },
    { kind: "guided", label: "Guided Notes (The Algebros)" },
  ],
  units: [
    {
      title: "Unit 1: Polynomial and Rational Functions",
      sections: [
        ["1.1", "Change in Tandem", "9/3", "Ch 1.1 Modeling and Solving", "Topic 1.1", "Lesson 1.1"],
        ["1.2", "Rates of Change", "9/8", "Ch 1.2 Function Behavior", "Topic 1.2", "Lesson 1.2"],
        ["1.3", "Linear and Quadratic Functions", "9/10", "Ch 1.3 Twelve Basic Functions", "Topic 1.3", "Lesson 1.3"],
        ["1.4", "Polynomial Functions and Rates of Change", "9/14", "Ch 1.4 Building Functions", "Topic 1.4", "Lesson 1.4"],
        ["1.5", "Polynomial Functions and Complex Zeros", "9/16", "Ch 1.5 Parametric and Inverse", "Topic 1.5", "Lesson 1.5"],
        ["1.6", "Polynomial Functions and End Behavior", "9/22", "Ch 1.6 Transformations", "Topic 1.6", "Lesson 1.6"],
        ["1.7", "Rational Functions and End Behavior", "9/28", "Ch 1.7 Modeling", "Topic 1.7", "Lesson 1.7"],
        ["1.8", "Rational Functions and Zeros", "10/1", "Ch 2.2 Quadratic", "Topic 1.8", "Lesson 1.8"],
        ["1.9", "Rational Functions and Vertical Asymptotes", "10/5", "Ch 2.3 Polynomial Modeling", "Topic 1.9", "Lesson 1.9"],
        ["1.10", "Rational Functions and Holes", "10/8", "Ch 2.4 Real Zeros", "Topic 1.10", "Lesson 1.10"],
        ["1.11", "Equivalent Representations", "10/13", "Ch 2.5 Complex Zeros and Theorems", "Topic 1.11", "Lesson 1.11"],
        ["1.12", "Transformations of Functions", "10/15", "Ch 2.6 Rational Function", "Topic 1.12", "Lesson 1.12"],
        ["1.13", "Function Model Selection and Assumptions", "10/21", "Ch 2.7 Equations, Inequalities and Modeling", "Topic 1.13", "Lesson 1.13"],
        ["1.14", "Function Model Construction and Application", "10/23", "Ch 2 Key Ideas", "Topic 1.14", "Lesson 1.14"],
      ],
      checkpoints: [
        ["checkpoint", "Personal Progress Check 1A", "9/24", "1.5"],
        ["quiz", "Quick Quiz 2A", "10/6", "1.9"],
        ["checkpoint", "Personal Progress Check 1B", "10/27", "1.14"],
        ["test", "Unit 1 Assessment", "10/29", "1.14"],
      ],
    },
    {
      title: "Unit 2: Exponential and Logarithmic Functions",
      sections: [
        ["2.1", "Change in Arithmetic and Geometric Sequences", "11/9", "Ch 3.1 Sequences", "Topic 2.1", "Lesson 2.1"],
        ["2.2", "Change in Linear and Exponential Functions", "11/13", "Ch 3.2 Exponential Functions", "Topic 2.2", "Lesson 2.2"],
        ["2.3", "Exponential Functions", "11/18", "Ch 3.2 Exponential Functions", "Topic 2.3", "Lesson 2.3"],
        ["2.4", "Exponential Function Manipulation", "11/20", "Ch 3.3 Exponential Modeling", "Topic 2.4", "Lesson 2.4"],
        ["2.5", "Exponential Function Context and Data Modeling", "11/24", "Ch 3.3 Exponential Modeling", "Topic 2.5", "Lesson 2.5"],
        ["2.6", "Competing Function Model Validation", "12/1", "Ch 3.3 Exponential Modeling", "Topic 2.6", "Lesson 2.6"],
        ["2.7", "Composition of Functions", "12/3", "Ch 1.4 Building Functions", "Topic 2.7", "Lesson 2.7"],
        ["2.8", "Inverse Functions", "12/7", "Ch 1.5 Parametric and Inverse", "Topic 2.8", "Lesson 2.8"],
        ["2.9", "Logarithmic Expressions", "12/11", "Ch 3.4 Logarithmic Functions", "Topic 2.9", "Lesson 2.9"],
        ["2.10", "Inverses of Exponential Functions", "12/15", "Ch 3.4 Logarithmic Functions", "Topic 2.10", "Lesson 2.10"],
        ["2.11", "Logarithmic Functions", "12/17", "Ch 3.4 Logarithmic Functions", "Topic 2.11", "Lesson 2.11"],
        ["2.12", "Logarithmic Function Manipulation", "12/22", "Ch 3.5 Log Properties", "Topic 2.12", "Lesson 2.12"],
        ["2.13", "Exponential and Logarithmic Equations and Inequalities", "1/4", "Ch 3.5 Log Properties", "Topic 2.13", "Lesson 2.13"],
        ["2.14", "Logarithmic Function Context and Data Modeling", "1/6", "Ch 3.6 Scaling and Semi-Log Plots", "Topic 2.14", "Lesson 2.14"],
        ["2.15", "Semi-Log Plots", "1/8", "Ch 3.6 Scaling and Semi-Log Plots", "Topic 2.15", "Lesson 2.15"],
      ],
      checkpoints: [
        ["quiz", "Quick Quiz 3A", "11/16", "2.2"],
        ["quiz", "Quick Quiz 3B", "11/30", "2.5"],
        ["checkpoint", "Personal Progress Check 2A", "12/9", "2.8"],
        ["checkpoint", "Personal Progress Check 2B", "1/13", "2.15"],
        ["test", "Unit 2 Assessment", "1/15", "2.15"],
      ],
    },
    {
      title: "Unit 3: Trigonometric and Polar Functions",
      sections: [
        ["3.1", "Periodic Phenomena", "1/20", "Ch 4.1 Angles and Measures", "Topic 3.1", "Lesson 3.1"],
        ["3.2", "Sine, Cosine and Tangent", "1/22", "Ch 4.2 Acute Angles", "Topic 3.2", "Lesson 3.2"],
        ["3.3", "Sine and Cosine Function Values", "1/27", "Ch 4.3 16-Point Circle", "Topic 3.3", "Lesson 3.3"],
        ["3.4", "Sine and Cosine Function Graphs", "1/29", "Ch 4.4 Sine and Cosine Graphs", "Topic 3.4", "Lesson 3.4"],
        ["3.5", "Sinusoidal Functions", "2/4", "Ch 4.4 Sine and Cosine Graphs", "Topic 3.5", "Lesson 3.5"],
        ["3.6", "Sinusoidal Function Transformations", "2/8", "Ch 4.4 Sine and Cosine Graphs", "Topic 3.6", "Lesson 3.6"],
        ["3.7", "Sinusoidal Function Context and Data Modeling", "2/12", "Ch 4.5 Tangent and Reciprocal", "Topic 3.7", "Lesson 3.7"],
        ["3.8", "The Tangent Function", "2/22", "Ch 4.5 Tangent and Reciprocal", "Topic 3.8", "Lesson 3.8"],
        ["3.9", "Inverse Trigonometric Functions", "2/24", "Ch 4.7 Inverse Functions", "Topic 3.9", "Lesson 3.9"],
        ["3.10", "Trigonometric Equations and Inequalities", "3/2", "Ch 5.1 Fundamental Identities", "Topic 3.10", "Lesson 3.10"],
        ["3.11", "The Secant, Cosecant and Cotangent Functions", "3/8", "Ch 5.2 Verify", "Topic 3.11", "Lesson 3.11"],
        ["3.12", "Equivalent Representations of Trigonometric Functions", "3/12", "Ch 5.3 Sum and Difference", "Topic 3.12", "Lesson 3.12"],
        ["3.13", "Trigonometry and Polar Coordinates", "3/17", "Ch 5.5 Polar and Complex", "Topic 3.13", "Lesson 3.13"],
        ["3.14", "Polar Function Graphs", "3/19", "Ch 5.6 Polar Graphs", "Topic 3.14", "Lesson 3.14"],
        ["3.15", "Rates of Change in Polar Functions", "3/25", "Ch 5.6 Polar Graphs", "Topic 3.15", "Lesson 3.15"],
      ],
      checkpoints: [
        ["quiz", "Quick Quiz 4A", "1/28", "3.2"],
        ["quiz", "Quick Quiz 4B", "2/18", "3.7"],
        ["checkpoint", "Personal Progress Check 3A", "2/18", "3.7"],
        ["quiz", "Quick Quiz 4C", "3/1", "3.9"],
        ["checkpoint", "Personal Progress Check 3B", "4/7", "3.15"],
        ["test", "Unit 3 Assessment", "4/9", "3.15"],
      ],
    },
    {
      title: "Unit 4: Functions Involving Parameters, Vectors and Matrices",
      sections: [
        ["4.1", "Parametric Functions", "4/13", "Ch 6.2 Parametric and Implicit", "Topic 4.1", "Lesson 4.1"],
        ["4.2", "Parametric Functions Modeling Planar Motion", "4/15", "Ch 6.2 Parametric and Implicit", "Topic 4.2", "Lesson 4.2"],
        ["4.3", "Parametric Functions and Rates of Change", "4/20", "Ch 6.2 Parametric and Implicit", "Topic 4.3", "Lesson 4.3"],
        ["4.4", "Parametrically Defined Circles and Lines", "4/22", "Ch 6.4 Circles and Ellipse", "Topic 4.4", "Lesson 4.4"],
        ["4.5", "Implicitly Defined Functions", "4/27", "Ch 6.2 Parametric and Implicit", "Topic 4.5", "Lesson 4.5"],
        ["4.6", "Conic Sections", "4/30", "Ch 6.3 Conic Sections", "Topic 4.6", "Lesson 4.6"],
        ["4.7", "Parametrization of Implicitly Defined Functions", "5/4", "Ch 6.5 Hyperbolas", "Topic 4.7", "Lesson 4.7"],
        ["4.8", "Vectors", "5/10", "Ch 6.1 Vectors", "Topic 4.8", "Lesson 4.8"],
        ["4.9", "Vector-Valued Functions", "5/12", "Ch 6.1 Vectors", "Topic 4.9", "Lesson 4.9"],
        ["4.10", "Matrices", "5/14", "Ch 7.1 Matrix Algebra", "Topic 4.10", "Lesson 4.10"],
        ["4.11", "The Inverse and Determinant of a Matrix", "5/18", "Ch 7.1 Matrix Algebra", "Topic 4.11", "Lesson 4.11"],
        ["4.12", "Linear Transformations and Matrices", "5/20", "Ch 7.2 Linear Transformations", "Topic 4.12", "Lesson 4.12"],
        ["4.13", "Matrices as Functions", "5/24", "Ch 7.3 Geometric Transformations", "Topic 4.13", "Lesson 4.13"],
        ["4.14", "Matrices Modeling Contexts", "5/27", "Ch 7.4 Modeling", "Topic 4.14", "Lesson 4.14"],
      ],
      checkpoints: [
        ["checkpoint", "Personal Progress Check 4A", "5/6", "4.7"],
        ["quiz", "Quick Quiz 6A", "5/7", "4.7"],
        ["quiz", "Quick Quiz 6B", "5/17", "4.11"],
        ["checkpoint", "Personal Progress Check 4B", "5/28", "4.14"],
      ],
    },
  ],
};

const AP_STATISTICS: CourseTemplate = {
  id: "ap-statistics",
  name: "AP Statistics",
  summary:
    "The CED topic sequence with Stats: Modeling the World readings and Goldie's guided notes.",
  tracks: [
    { kind: "textbook", label: "Stats: Modeling the World" },
    { kind: "apclassroom", label: "AP Classroom" },
    { kind: "guided", label: "Guided Notes (Goldie's)" },
  ],
  units: [
    {
      title: "Unit 1: Exploring Data and Collecting Data",
      sections: [
        ["1.1", "Introducing Statistics", "9/3", "Ch 1, pp. 1–10", "Topic 1.1", "Notes on Topic 1.1"],
        ["1.2", "Variables", "9/8", "Ch 2, pp. 14–25", "Topic 1.2", "Notes on Topic 1.2"],
        ["1.3", "One-Variable Categorical Data — Tabular", "9/10", "Ch 2, pp. 14–26", "Topic 1.3", "Notes on Topic 1.3"],
        ["1.4", "One-Variable Categorical Data — Graphical", "9/14", "Ch 3, pp. 43–52", "Topic 1.4", "Notes on Topic 1.4"],
        ["1.5", "One-Variable Quantitative Data — Graphical", "9/16", "Ch 3, pp. 52–63 (5-number summary)", "Topic 1.5", "Notes on Topic 1.5"],
        ["1.6", "Describing Quantitative Distributions", "9/18", "Ch 3, pp. 63–71", "Topic 1.6", "Notes on Topic 1.6"],
        ["1.7", "Summary Statistics", "9/23", "Ch 4, pp. 82–87", "Topic 1.7", "Notes on Topic 1.7"],
        ["1.8", "Graphical Representations of Summary Statistics", "9/25", "Ch 5, pp. 100–105", "Topic 1.8", "Notes on Topic 1.8"],
        ["1.9", "Comparing Distributions", "9/29", "Ch 5, pp. 106–113", "Topic 1.9", "Notes on Topic 1.9"],
        ["1.10", "The Normal Distribution", "10/1", "Ch 5, pp. 113–118 (z-scores)", "Topic 1.10", "Notes on Topic 1.10"],
        ["1.11", "Random Sampling and Data Collection", "10/5", "Ch 6, pp. 142–151", "Topic 1.11", "Notes on Topic 1.11"],
        ["1.12", "Potential Problems with Sampling", "10/7", "Ch 6, pp. 151–158", "Topic 1.12", "Notes on Topic 1.12"],
        ["1.13", "Experimental Design", "10/9", "Ch 7, pp. 164–184", "Topic 1.13", "Notes on Topic 1.13"],
      ],
      checkpoints: [
        ["quiz", "Unit 1 Quiz 1 (1.1 – 1.5)", "9/17", "1.5"],
        ["project", "Misleading Graphs Project", "9/30", "1.9"],
        ["test", "Unit 1 Part 1 Test (1.1 – 1.9)", "10/5", "1.9"],
        ["quiz", "Unit 1 Quiz 2 (1.10 – 1.12)", "10/13", "1.12"],
        ["project", "Sample Survey Project", "10/20", "1.13"],
        ["test", "Unit 1 Part 2 Test (1.10 – 1.13)", "10/22", "1.13"],
      ],
    },
    {
      title: "Unit 2: Two-Variable Data and Probability",
      sections: [
        ["2.1", "Two-Variable Categorical Data — Tabular and Graphical", "10/12", "Ch 6, pp. 142–147", "Topic 2.1", "Notes on Topic 2.1"],
        ["2.2", "Summary Statistics for Two-Variable Data", "10/14", "Ch 6, pp. 147–151", "Topic 2.2", "Notes on Topic 2.2"],
        ["2.3", "Estimating Probabilities with Simulation", "10/15", "Ch 8, pp. 181–195", "Topic 2.3", "Notes on Topic 2.3"],
        ["2.4", "Introducing Probability", "10/21", "Ch 8, pp. 195–201", "Topic 2.4", "Notes on Topic 2.4"],
        ["2.5", "Mutually Exclusive Events", "10/23", "Ch 9, pp. 214–218", "Topic 2.5", "Notes on Topic 2.5"],
        ["2.6", "Conditional Probability", "10/27", "Ch 9, pp. 218–224", "Topic 2.6", "Notes on Topic 2.6"],
        ["2.7", "Independent Events and Unions", "10/29", "Ch 10, pp. 234–246", "Topic 2.7", "Notes on Topic 2.7"],
        ["2.8", "Random Variables and Probability Distributions", "11/9", "Ch 11, pp. 262–264", "Topic 2.8", "Notes on Topic 2.8"],
        ["2.9", "Parameters for a Probability Distribution", "11/11", "Ch 11, pp. 265–268", "Topic 2.9", "Notes on Topic 2.9"],
        ["2.10", "The Binomial Distribution", "11/13", "Ch 11, pp. 274–280", "Topic 2.10", "Notes on Topic 2.10"],
        ["2.11", "The Normal Distribution Revisited", "11/17", "Ch 11, pp. 280–285", "Topic 2.11", "Notes on Topic 2.11"],
        ["2.12", "Sampling Distributions and the Central Limit Theorem", "11/19", "Ch 12, pp. 300–309", "Topic 2.12", "Notes on Topic 2.12"],
      ],
      checkpoints: [
        ["quiz", "Unit 2 Quiz 1", "11/9", "2.4"],
        ["project", "Casino Lab", "11/17", "2.7"],
        ["test", "Unit 2 Part 1 Test (2.1 – 2.7)", "11/19", "2.7"],
        ["quiz", "Unit 2 Quiz 2", "12/2", "2.10"],
        ["project", "Make Your Own Casino", "12/14", "2.12"],
        ["test", "Unit 2 Part 2 Test", "12/16", "2.12"],
      ],
    },
    {
      title: "Unit 3: Inference for Proportions and Chi-Square",
      sections: [
        ["3.1", "Estimators", "11/24", "Ch 12, pp. 305–309", "Topic 3.1", "Notes on Topic 3.1"],
        ["3.2", "Sampling Distributions for Proportions", "11/30", "Ch 12, pp. 309–316", "Topic 3.2", "Notes on Topic 3.2"],
        ["3.3", "Confidence Intervals for Proportions", "12/2", "Ch 13, pp. 328–331", "Topic 3.3", "Notes on Topic 3.3"],
        ["3.4", "Justifying a Claim", "12/4", "Ch 13, pp. 331–335", "Topic 3.4", "Notes on Topic 3.4"],
        ["3.5", "Setting Up a Test for a Proportion", "12/8", "Ch 14, pp. 351–355", "Topic 3.5", "Notes on Topic 3.5"],
        ["3.6", "p-Values", "12/10", "Ch 14, pp. 355–361", "Topic 3.6", "Notes on Topic 3.6"],
        ["3.7", "Carrying Out a Test — State, Plan, Do, Conclude", "12/14", "Ch 14, pp. 362–367", "Topic 3.7", "Notes on Topic 3.7"],
        ["3.8", "Potential Errors and Power", "12/16", "Ch 15, pp. 383–391", "Topic 3.8", "Notes on Topic 3.8"],
        ["3.9", "Sampling Distribution of a Difference in Proportions", "12/18", "Ch 16, pp. 401–407", "Topic 3.9", "Notes on Topic 3.9"],
        ["3.10", "Confidence Intervals for a Difference of Proportions", "12/22", "Ch 16, pp. 407–412", "Topic 3.10", "Notes on Topic 3.10"],
        ["3.11", "Justifying a Claim about Two Proportions", "1/4", "Ch 16, pp. 413–415", "Topic 3.11", "Notes on Topic 3.11"],
        ["3.12", "Setting Up a Test for Two Proportions", "1/6", "Ch 16, pp. 401–415", "Topic 3.12", "Notes on Topic 3.12"],
        ["3.13", "Carrying Out a Two-Proportion Test", "1/8", "Ch 16, pp. 401–415", "Topic 3.13", "Notes on Topic 3.13"],
        ["3.14", "Setting Up a Chi-Square Test", "1/12", "Ch 17, pp. 421–427", "Topic 3.14", "Notes on Topic 3.14"],
        ["3.15", "Carrying Out a Chi-Square Test", "1/15", "Ch 17, pp. 427–437", "Topic 3.15", "Notes on Topic 3.15"],
      ],
      checkpoints: [
        ["quiz", "Unit 3 Quiz 1", "1/8", "3.7"],
        ["project", "Simulation Project", "1/22", "3.8"],
        ["test", "Unit 3 Part 1 Test (3.1 – 3.8)", "1/26", "3.8"],
        ["quiz", "Unit 3 Quiz 2 (3.9 – 3.13)", "2/5", "3.13"],
        ["project", "Chi-Square Survey Analysis", "2/12", "3.15"],
        ["test", "Unit 3 Part 2 Test (3.9 – 3.15)", "2/18", "3.15"],
      ],
    },
    {
      title: "Unit 4: Inference for Means",
      sections: [
        ["4.1", "Sampling Distributions for Means", "1/20", "Ch 18, pp. 457–461", "Topic 4.1", "Notes on Topic 4.1"],
        ["4.2", "Confidence Intervals for a Mean", "1/22", "Ch 18, pp. 461–466", "Topic 4.2", "Notes on Topic 4.2"],
        ["4.3", "Justifying a Claim about a Mean", "1/27", "Ch 18, pp. 466–475", "Topic 4.3", "Notes on Topic 4.3"],
        ["4.4", "Setting Up a Test for a Mean", "1/28", "Ch 18, pp. 476–479", "Topic 4.4", "Notes on Topic 4.4"],
        ["4.5", "Carrying Out a t-Test", "2/1", "Ch 19, pp. 488–491", "Topic 4.5", "Notes on Topic 4.5"],
        ["4.6", "Sampling Distribution for Two Sample Means", "2/3", "Ch 19, pp. 492–497", "Topic 4.6", "Notes on Topic 4.6"],
        ["4.7", "Confidence Intervals for Two Sample Means", "2/5", "Ch 19, pp. 497–501", "Topic 4.7", "Notes on Topic 4.7"],
        ["4.8", "Justifying a Claim about Two Means", "2/9", "Ch 19, pp. 502–504", "Topic 4.8", "Notes on Topic 4.8"],
        ["4.9", "Setting Up a Test for Two Means", "2/11", "Ch 20, pp. 514–520", "Topic 4.9", "Notes on Topic 4.9"],
        ["4.10", "Carrying Out a Two-Sample Test", "2/16", "Ch 20, pp. 520–528", "Topic 4.10", "Notes on Topic 4.10"],
      ],
      checkpoints: [
        ["quiz", "Unit 4 Quiz (4.1 – 4.3)", "2/26", "4.3"],
        ["project", "Taste Test Comparison", "3/12", "4.10"],
        ["test", "Unit 4 Test", "3/16", "4.10"],
      ],
    },
    {
      title: "Unit 5: Inference for Slopes",
      sections: [
        ["5.1", "Graphical Relationships Between Two Variables", "2/17", "Ch 21, pp. 549–556", "Topic 5.1", "Notes on Topic 5.1"],
        ["5.2", "Correlation", "2/19", "Ch 21, pp. 556–565", "Topic 5.2", "Notes on Topic 5.2"],
        ["5.3", "Linear Regression Models", "2/23", "Ch 22, pp. 573–578", "Topic 5.3", "Notes on Topic 5.3"],
        ["5.4", "Residuals", "2/25", "Ch 22, pp. 578–585", "Topic 5.4", "Notes on Topic 5.4"],
        ["5.5", "Least-Squares Regression and Inference for Slopes", "3/1", "Ch 23, pp. 601–622", "Topic 5.5", "Notes on Topic 5.5"],
      ],
      checkpoints: [
        ["quiz", "Unit 5 Quiz", "3/24", "5.3"],
        ["project", "Addition vs Multiplication Facts", "4/7", "5.5"],
        ["test", "Unit 5 Test", "4/9", "5.5"],
      ],
    },
  ],
};

export const COURSE_TEMPLATES: CourseTemplate[] = [
  ALGEBRA_2,
  AP_PRECALCULUS,
  AP_STATISTICS,
];

export function getCourseTemplate(id: string): CourseTemplate | undefined {
  return COURSE_TEMPLATES.find((t) => t.id === id);
}

function templateTrack(
  sectionId: string,
  kind: TrackKind,
  label: string,
  reference: string
): ResourceTrack {
  const id = stableTrackId(sectionId, kind);
  const blocks: ContentBlock[] = [
    {
      id: `${id}::learn::0`,
      type: "learn",
      title: reference,
      description: "",
      attachments: [],
    },
    {
      id: `${id}::practice::0`,
      type: "practice",
      title: "Practice",
      description: `Assigned practice for ${reference}.`,
      attachments: [],
    },
  ];

  return { id, kind, label, reference, objectives: [], blocks };
}

export function instantiateTemplate(template: CourseTemplate): CurriculumUnit[] {
  return template.units.map((unit) => {
    const subunits: Section[] = unit.sections.map(
      ([id, title, date, textbook, second, guided]) => {
        const refs = [textbook, second, guided];
        return {
          id,
          title,
          date,
          objectives: [],
          tracks: template.tracks.map((track, i) =>
            templateTrack(id, track.kind, track.label, refs[i] ?? "")
          ),
        };
      }
    );

    const checkpoints: Checkpoint[] = unit.checkpoints.map(
      ([kind, title, date, after, note]) => ({
        id: uuidv4(),
        kind,
        title,
        date,
        afterSectionId: after,
        note,
      })
    );

    return { id: uuidv4(), title: unit.title, subunits, checkpoints };
  });
}
