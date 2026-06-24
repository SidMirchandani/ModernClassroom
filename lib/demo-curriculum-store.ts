import type { CurriculumUnit } from "./db/types";
import { demoUnitsToCurriculum } from "./demo-units";

const STORAGE_KEY = "modern-classroom-demo-curriculum";
const STORAGE_VERSION_KEY = "modern-classroom-demo-curriculum-version";
const CURRICULUM_VERSION = "2";

export function getDefaultDemoCurriculum(): CurriculumUnit[] {
  return demoUnitsToCurriculum();
}

export function loadDemoCurriculum(): CurriculumUnit[] {
  if (typeof window === "undefined") return getDefaultDemoCurriculum();
  try {
    const version = localStorage.getItem(STORAGE_VERSION_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (version === CURRICULUM_VERSION && raw) {
      return JSON.parse(raw) as CurriculumUnit[];
    }
  } catch {
    /* use default */
  }
  const initial = getDefaultDemoCurriculum();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  localStorage.setItem(STORAGE_VERSION_KEY, CURRICULUM_VERSION);
  return initial;
}

export function saveDemoCurriculum(units: CurriculumUnit[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(units));
  localStorage.setItem(STORAGE_VERSION_KEY, CURRICULUM_VERSION);
}

export function findDemoSubunit(
  units: CurriculumUnit[],
  subunitId: string
): { units: CurriculumUnit[]; subunitIndex: { unitId: string; subunitId: string } } | null {
  const decoded = decodeURIComponent(subunitId);
  for (const unit of units) {
    const subunit = unit.subunits.find((s) => s.id === decoded);
    if (subunit) {
      return { units, subunitIndex: { unitId: unit.id, subunitId: decoded } };
    }
  }
  return null;
}

export function updateDemoSubunit(
  units: CurriculumUnit[],
  subunitId: string,
  updated: CurriculumUnit["subunits"][number]
): CurriculumUnit[] {
  return units.map((u) => ({
    ...u,
    subunits: u.subunits.map((s) => (s.id === subunitId ? updated : s)),
  }));
}
