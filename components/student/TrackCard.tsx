"use client";

import type { ResourceTrack, TrackProgress, TrackStep } from "@/lib/types";
import {
  getTrackBlocks,
  getActiveSteps,
  TRACK_KIND_COLORS,
} from "@/lib/section-tracks";
import {
  isActivityFinished,
  isTrackComplete,
  trackHasHelp,
  trackHasRevisionNotice,
  trackNeedsReview,
} from "@/lib/class-progress";
import { StepPanel } from "./StepPanel";
import {
  AlertCircle,
  BookMarked,
  ChevronDown,
  CheckCircle2,
  Clock,
  GraduationCap,
  HelpCircle,
  Layers,
  Lock,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { STATUS_CHIP, STATUS_LABEL, type ProgressStatus } from "@/lib/status-styles";
import { cn } from "@/lib/utils";
import { Collapse } from "@/components/Collapse";

const TRACK_ICONS = {
  textbook: BookMarked,
  apclassroom: GraduationCap,
  guided: NotebookPen,
  extra: Sparkles,
  custom: Layers,
} as const;

type Summary = ProgressStatus;

const SUMMARY_ICONS: Record<Summary, typeof Lock> = {
  locked: Lock,
  "not-started": Clock,
  "in-progress": Clock,
  review: Clock,
  help: HelpCircle,
  complete: CheckCircle2,
};

export function getTrackSummary(
  track: ResourceTrack,
  progress: TrackProgress | undefined,
  accessible: boolean
): Summary {
  if (!accessible) return "locked";
  if (trackHasHelp(track, progress)) return "help";
  if (isTrackComplete(track, progress)) {
    return trackNeedsReview(track, progress) ? "review" : "complete";
  }
  if (trackNeedsReview(track, progress)) return "review";
  const started = getActiveSteps(track).some((step) =>
    isActivityFinished(progress?.[step])
  );
  return started ? "in-progress" : "not-started";
}

export function TrackSummaryBadge({
  summary,
  compact = false,
}: {
  summary: Summary;
  compact?: boolean;
}) {
  const Icon = SUMMARY_ICONS[summary];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        STATUS_CHIP[summary]
      )}
    >
      <Icon className="w-3 h-3" />
      {STATUS_LABEL[summary]}
    </span>
  );
}

interface Props {
  track: ResourceTrack;
  progress: TrackProgress | undefined;
  accessible: boolean;
  expanded: boolean;
  onToggle: () => void;
  onStepChange: (
    trackId: string,
    step: TrackStep,
    status: "done" | "help",
    proofUrl?: string
  ) => void;
  readOnly?: boolean;
}

/**
 * One resource inside a section — the button a student presses to open the
 * textbook, AP Classroom or guided-notes path, with its own Learn → Practice
 * sequence and its own status.
 */
export function TrackCard({
  track,
  progress,
  accessible,
  expanded,
  onToggle,
  onStepChange,
  readOnly = false,
}: Props) {
  const colors = TRACK_KIND_COLORS[track.kind];
  const Icon = TRACK_ICONS[track.kind];
  const steps = getActiveSteps(track);
  const summary = getTrackSummary(track, progress, accessible || readOnly);
  const sentBack = trackHasRevisionNotice(progress);

  const learnStatus = readOnly ? "available" : progress?.learn ?? "locked";
  const practiceStatus = readOnly ? "available" : progress?.practice ?? "locked";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden transition-colors",
        expanded
          ? colors.border
          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-start sm:items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        {/* A bare glyph, not a tile: a bordered box inside a bordered card made
            every resource read as somebody else's logo. */}
        <Icon className={cn("w-5 h-5 shrink-0 mt-0.5 sm:mt-0", colors.icon)} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {track.label}
            </span>
            {track.optional && (
              <span className="eyebrow-muted shrink-0">
                Optional
              </span>
            )}
            {sentBack && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 shrink-0"
                title="Sent back for review"
              >
                <AlertCircle className="w-3 h-3" />
              </span>
            )}
          </div>
          {track.reference?.trim() && (
            <div className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {track.reference}
            </div>
          )}
          {/* On a phone the status sits under the name — squeezed onto the
              same row it truncates labels like "Extra Material". */}
          <div className="mt-2 sm:hidden">
            <TrackSummaryBadge summary={summary} compact />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <span className="hidden sm:inline-flex">
            <TrackSummaryBadge summary={summary} />
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-slate-400 transition-transform duration-500 ease-[cubic-bezier(0.34,1.36,0.64,1)]",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      <Collapse open={expanded} className="px-4 sm:px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-5">
        {track.objectives.length > 0 && (
          <div className="pt-4">
            <p className="eyebrow-muted mb-2">
              Learning Targets
            </p>
            <ul className="space-y-1.5">
              {track.objectives.map((obj) => (
                <li
                  key={obj.id}
                  className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400"
                >
                  <div
                    className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", colors.dot)}
                  />
                  <span>{obj.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {steps.length === 0 && (
          <p className="pt-4 text-sm text-slate-400 italic">No content added yet.</p>
        )}

        {steps.includes("learn") && (
          <div className={cn(track.objectives.length === 0 && "pt-4")}>
            <StepPanel
              step="learn"
              status={learnStatus}
              blocks={getTrackBlocks(track, "learn")}
              locked={!accessible}
              lockedMessage="Finish the previous section to unlock"
              onStatusChange={(status) => onStepChange(track.id, "learn", status)}
              readOnly={readOnly}
            />
          </div>
        )}

        {steps.includes("practice") && (
          <div
            className={cn(
              steps.includes("learn") &&
                "pt-5 border-t border-slate-100 dark:border-slate-800"
            )}
          >
            <StepPanel
              step="practice"
              status={practiceStatus}
              blocks={getTrackBlocks(track, "practice")}
              locked={!accessible || practiceStatus === "locked"}
              lockedMessage={
                !accessible
                  ? "Finish the previous section to unlock"
                  : `Finish the ${track.label} reading to unlock Practice`
              }
              requiresProof
              proofUrl={progress?.practiceProofUrl}
              onStatusChange={(status, proofUrl) =>
                onStepChange(track.id, "practice", status, proofUrl)
              }
              readOnly={readOnly}
            />
          </div>
        )}
      </Collapse>
    </div>
  );
}
