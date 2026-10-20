"use client";

import { PanelRightOpen } from "lucide-react";
import type { CurriculumUnit } from "@/lib/db/types";
import type { AgentReview } from "@/lib/use-curriculum-agent";
import { CurriculumReview } from "./CurriculumReview";
import { CurriculumTable } from "./CurriculumTable";

interface CurriculumPanelProps {
  classId: string;
  units: CurriculumUnit[];
  /** A draft from the chat, waiting for the teacher's decisions. */
  review: AgentReview | null;
  chatOpen: boolean;
  onOpenChat: () => void;
  onUpdate: (units: CurriculumUnit[]) => void;
  getSubunitHref?: (subunitId: string) => string;
}

/**
 * The Curriculum tab: the curriculum, or — while the chat has a draft out —
 * that draft written over it, row by row, until the teacher has accepted or
 * rejected each part. The table is the one place changes are reviewed, so
 * there is never a second version of the truth on screen to compare against.
 * The conversation that makes drafts is the chat beside it.
 */
export function CurriculumPanel({
  classId,
  units,
  review,
  chatOpen,
  onOpenChat,
  onUpdate,
  getSubunitHref,
}: CurriculumPanelProps) {
  if (review) return <CurriculumReview review={review} />;

  return (
    <div>
      {units.length === 0 && !chatOpen && (
        <button
          type="button"
          onClick={onOpenChat}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <PanelRightOpen className="w-4 h-4" />
          Build it from your files in the chat
        </button>
      )}
      <CurriculumTable
        classId={classId}
        units={units}
        onUpdate={onUpdate}
        getSubunitHref={getSubunitHref}
      />
    </div>
  );
}
