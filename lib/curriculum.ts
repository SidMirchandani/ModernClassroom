import type { Section } from "./types";
import { defaultTracks } from "./section-tracks";

export function emptySection(id: string, title: string): Section {
  return {
    id,
    title,
    objectives: [],
    tracks: defaultTracks(),
  };
}

/**
 * "Unit 3: Central Tendency and Dot Plots" → "Unit 3". The navigator has room
 * for the number and nothing else; the full title stays in the sidebar.
 */
export function shortUnitLabel(title: string, index: number): string {
  const match = title.match(/^\s*unit\s*(\d+)/i);
  return match ? `Unit ${match[1]}` : `Unit ${index + 1}`;
}
