import type { Section } from "./types";

export function emptySection(id: string, title: string): Section {
  return {
    id,
    title,
    objectives: [],
    learnResources: [],
    practiceDescription: "",
    extraMaterials: [],
  };
}
