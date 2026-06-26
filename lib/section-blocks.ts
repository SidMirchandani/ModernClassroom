import { v4 as uuidv4 } from "uuid";
import type {
  BlockAttachment,
  ContentBlock,
  ContentBlockType,
  Section,
} from "./types";

export function emptyBlock(type: ContentBlockType): ContentBlock {
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

/** Migrate legacy learnResources / practiceDescription / extraMaterials into blocks. */
export function normalizeSection(section: Section): Section {
  const withObjectives = {
    ...section,
    objectives: section.objectives ?? [],
  };

  if (withObjectives.blocks?.length) {
    return { ...withObjectives, blocks: withObjectives.blocks };
  }

  const blocks: ContentBlock[] = [];

  for (const resource of section.learnResources ?? []) {
    blocks.push({
      id: uuidv4(),
      type: "learn",
      title: resource.label,
      attachments: [
        {
          id: uuidv4(),
          kind: "link",
          label: resource.label,
          url: resource.url,
        },
      ],
    });
  }

  if (section.practiceDescription?.trim()) {
    blocks.push({
      id: uuidv4(),
      type: "practice",
      title: "Practice",
      description: section.practiceDescription,
      attachments: [],
    });
  }

  for (const material of section.extraMaterials ?? []) {
    blocks.push({
      id: uuidv4(),
      type: "extra",
      title: material.label,
      attachments: [
        {
          id: uuidv4(),
          kind: "link",
          label: material.label,
          url: material.url,
        },
      ],
    });
  }

  return { ...withObjectives, blocks };
}

export function getBlocksByType(section: Section, type: ContentBlockType): ContentBlock[] {
  return normalizeSection(section).blocks.filter((b) => b.type === type);
}

export const BLOCK_TYPE_LABELS: Record<ContentBlockType, string> = {
  learn: "Learn",
  practice: "Practice",
  extra: "Extra Material",
};

export const BLOCK_TYPE_COLORS: Record<
  ContentBlockType,
  { badge: string; border: string }
> = {
  learn: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  practice: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  extra: {
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
  },
};
