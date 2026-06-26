import type { Student } from "./types";

export const STUDENTS: Student[] = [
  { id: "s1", name: "Dutt", avatar: "D" },
  { id: "s2", name: "Julian", avatar: "J" },
  { id: "s3", name: "Carson", avatar: "C" },
  { id: "s4", name: "Maya", avatar: "M" },
  { id: "s5", name: "Priya", avatar: "P" },
  { id: "s6", name: "Ethan", avatar: "E" },
  { id: "s7", name: "Sofia", avatar: "S" },
  { id: "s8", name: "Liam", avatar: "L" },
];

export {
  UNIT,
  DEMO_PROGRESS,
  DEMO_UNITS,
  DEMO_CLASS_NAME,
  DEMO_CLASS_CODE,
  DEMO_UNIT_3_PROGRESS,
  getDemoProgressForUnit,
  demoUnitsToCurriculum,
  DEMO_DEFAULT_UNIT_INDEX,
} from "./demo-units";
