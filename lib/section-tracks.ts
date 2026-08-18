import { v4 as uuidv4 } from "uuid";
import type {
  BlockAttachment,
  ContentBlock,
  ResourceTrack,
  Section,
  TrackKind,
  TrackStep,
} from "./types";

export const TRACK_KIND_LABELS: Record<TrackKind, string> = {
  textbook: "Textbook",
  apclassroom: "AP Classroom",
  guided: "Guided Notes",
  extra: "Extra Material",
  custom: "Resource",
};

/** Order tracks always render in, so a section looks the same everywhere. */
export const TRACK_KIND_ORDER: TrackKind[] = [
  "textbook",
  "apclassroom",
  "guided",
  "custom",
  "extra",
];

/** Short badge text for dense grids. */
export const TRACK_KIND_ABBR: Record<TrackKind, string> = {
  textbook: "T",
  apclassroom: "AP",
  guided: "GN",
  extra: "EX",
  custom: "R",
};

/**
 * Two characters for a grid chip. Named resources ("Discovery Activity") get
 * their own initials — a row of identical "R"s would tell the teacher nothing.
 */
export function trackAbbr(track: { kind: TrackKind; label?: string }): string {
  if (track.kind !== "custom") return TRACK_KIND_ABBR[track.kind];

  const initials = (track.label ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return initials || TRACK_KIND_ABBR.custom;
}

/**
 * Category identity per resource. The hue lives on the icon glyph, the editor
 * badge and the objective dot — never on the chrome and never on a status,
 * which keeps one brand blue and one status vocabulary in charge of meaning.
 * Attachments share a single neutral treatment for the same reason.
 */
export const TRACK_KIND_COLORS: Record<
  TrackKind,
  { badge: string; border: string; icon: string; dot: string }
> = {
  textbook: {
    badge: "bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-900",
    icon: "text-indigo-600 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  apclassroom: {
    badge: "bg-white dark:bg-slate-900 border border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-900",
    icon: "text-violet-600 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  guided: {
    badge: "bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-900",
    icon: "text-teal-600 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  extra: {
    badge: "bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-900",
    icon: "text-amber-600 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  custom: {
    badge: "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
    icon: "text-slate-600 dark:text-slate-300",
    dot: "bg-slate-400",
  },
};

/** Every resource link/file looks the same — the resource is named above it. */
export const ATTACHMENT_CLASS =
  "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-primary/50 hover:text-primary dark:hover:text-primary-glow";

export const STEP_LABELS: Record<TrackStep, string> = {
  learn: "Learn",
  practice: "Practice",
};

/**
 * Track ids must be stable across reloads — student progress is keyed on them
 * and legacy curricula are re-migrated on every read, so migration can never
 * mint fresh uuids.
 */
export function stableTrackId(sectionId: string, kind: TrackKind): string {
  return sectionId + "::" + kind;
}

function migratedBlockId(trackId: string, step: TrackStep, index: number): string {
  return trackId + "::" + step + "::" + index;
}

export function emptyBlock(type: TrackStep): ContentBlock {
  return {
    id: uuidv4(),
    type,
    title: "",
    description: "",
    attachments: [],
  };
}

export function emptyAttachment(kind: "link" | "file"): BlockAttachment {
  return {
    id: uuidv4(),
    kind,
    label: "",
    url: kind === "link" ? "https://" : "",
  };
}

export function emptyTrack(kind: TrackKind, label?: string): ResourceTrack {
  return {
    id: uuidv4(),
    kind,
    label: label ?? TRACK_KIND_LABELS[kind],
    reference: "",
    objectives: [],
    blocks: [],
    ...(kind === "extra" ? { optional: true } : {}),
  };
}

/** The three resources every course is built on. Extras get added as needed. */
export function defaultTracks(): ResourceTrack[] {
  return [emptyTrack("textbook"), emptyTrack("apclassroom"), emptyTrack("guided")];
}

interface LegacyBlockish {
  type: string;
  title: string;
  description?: string;
  attachments: BlockAttachment[];
}

function legacyBlocksToTrack(
  sectionId: string,
  kind: TrackKind,
  sourceBlocks: LegacyBlockish[],
  opts: { label?: string; optional?: boolean } = {}
): ResourceTrack | null {
  if (sourceBlocks.length === 0) return null;
  const id = stableTrackId(sectionId, kind);
  let learnCount = 0;
  let practiceCount = 0;

  const blocks: ContentBlock[] = sourceBlocks.map((block) => {
    const step: TrackStep = block.type === "practice" ? "practice" : "learn";
    const index = step === "practice" ? practiceCount++ : learnCount++;
    return {
      id: migratedBlockId(id, step, index),
      type: step,
      title: block.title,
      description: block.description,
      attachments: block.attachments ?? [],
    };
  });

  return {
    id,
    kind,
    label: opts.label ?? TRACK_KIND_LABELS[kind],
    reference: "",
    objectives: [],
    blocks,
    ...(opts.optional ? { optional: true } : {}),
  };
}

/**
 * Bring any stored section up to the track shape. Handles both the flat
 * learnResources/practiceDescription/extraMaterials fields and the
 * learn|practice|extra `blocks` array that replaced them.
 */
export function normalizeSection(section: Section): Section {
  const base: Section = {
    ...section,
    objectives: section.objectives ?? [],
    tracks: section.tracks ?? [],
  };

  if (base.tracks.length > 0) {
    return {
      ...base,
      tracks: base.tracks.map((track) => ({
        ...track,
        objectives: track.objectives ?? [],
        blocks: track.blocks ?? [],
      })),
    };
  }

  const tracks: ResourceTrack[] = [];
  const legacyBlocks = section.blocks ?? [];

  if (legacyBlocks.length > 0) {
    const coursework = legacyBlocks.filter((b) => b.type !== "extra");
    const extras = legacyBlocks
      .filter((b) => b.type === "extra")
      .map((b) => ({ ...b, type: "learn" }));

    const courseworkTrack = legacyBlocksToTrack(section.id, "custom", coursework, {
      label: "Coursework",
    });
    if (courseworkTrack) tracks.push(courseworkTrack);

    const extraTrack = legacyBlocksToTrack(section.id, "extra", extras, {
      optional: true,
    });
    if (extraTrack) tracks.push(extraTrack);

    return { ...base, tracks };
  }

  // Oldest shape: flat resource lists.
  const flat: LegacyBlockish[] = [];

  for (const resource of section.learnResources ?? []) {
    flat.push({
      type: "learn",
      title: resource.label,
      attachments: [
        { id: uuidv4(), kind: "link", label: resource.label, url: resource.url },
      ],
    });
  }

  if (section.practiceDescription?.trim()) {
    flat.push({
      type: "practice",
      title: "Practice",
      description: section.practiceDescription,
      attachments: [],
    });
  }

  const courseworkTrack = legacyBlocksToTrack(section.id, "custom", flat, {
    label: "Coursework",
  });
  if (courseworkTrack) tracks.push(courseworkTrack);

  const extraTrack = legacyBlocksToTrack(
    section.id,
    "extra",
    (section.extraMaterials ?? []).map((material) => ({
      type: "learn",
      title: material.label,
      attachments: [
        { id: uuidv4(), kind: "link" as const, label: material.label, url: material.url },
      ],
    })),
    { optional: true }
  );
  if (extraTrack) tracks.push(extraTrack);

  return { ...base, tracks };
}

export function getTracks(section: Section): ResourceTrack[] {
  return normalizeSection(section).tracks;
}

export function getTrackBlocks(track: ResourceTrack, step: TrackStep): ContentBlock[] {
  return (track.blocks ?? []).filter((b) => b.type === step);
}

/**
 * Which steps this track actually asks of a student. A textbook track with
 * nothing but reading has no Practice step, and an empty track has none at all.
 */
export function getActiveSteps(track: ResourceTrack): TrackStep[] {
  const steps: TrackStep[] = [];
  if (getTrackBlocks(track, "learn").length > 0) steps.push("learn");
  if (getTrackBlocks(track, "practice").length > 0) steps.push("practice");
  return steps;
}

/** A track with no content asks nothing and is skipped everywhere. */
export function isTrackEmpty(track: ResourceTrack): boolean {
  return getActiveSteps(track).length === 0;
}

/** Required tracks gate the section; optional ones (Extra Material) never do. */
export function isTrackRequired(track: ResourceTrack): boolean {
  return track.optional !== true && !isTrackEmpty(track);
}

/** Tracks a student is actually shown — anything with content in it. */
export function getVisibleTracks(section: Section): ResourceTrack[] {
  return getTracks(section).filter((t) => !isTrackEmpty(t));
}

export function getRequiredTracks(section: Section): ResourceTrack[] {
  return getTracks(section).filter(isTrackRequired);
}

export function sortTracks(tracks: ResourceTrack[]): ResourceTrack[] {
  return [...tracks].sort(
    (a, b) => TRACK_KIND_ORDER.indexOf(a.kind) - TRACK_KIND_ORDER.indexOf(b.kind)
  );
}
