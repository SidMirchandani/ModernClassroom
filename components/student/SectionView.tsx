"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Checkpoint,
  Section,
  SectionActivityStatus,
  TrackStep,
} from "@/lib/types";
import { getVisibleTracks, sortTracks } from "@/lib/section-tracks";
import {
  getSectionCompletionRatio,
  getTrackProgress,
  hasRevisionNotice,
} from "@/lib/class-progress";
import { TrackCard, getTrackSummary } from "./TrackCard";
import { CheckCircle2, CalendarDays, AlertCircle } from "lucide-react";
import { CheckpointRow } from "@/components/CheckpointRow";
import { cn } from "@/lib/utils";

interface Props {
  section: Section;
  sectionProgress: SectionActivityStatus;
  sectionComplete: boolean;
  accessible?: boolean;
  /** Checkpoints anchored to this section — shown under the resource list. */
  checkpoints?: Checkpoint[];
  onUpdateActivity: (
    sectionId: string,
    trackId: string,
    step: TrackStep,
    status: "done" | "help",
    proofUrl?: string
  ) => void;
  readOnly?: boolean;
}

export function SectionView({
  section,
  sectionProgress,
  sectionComplete,
  accessible = true,
  checkpoints = [],
  onUpdateActivity,
  readOnly = false,
}: Props) {
  const [expandedObjectives, setExpandedObjectives] = useState(true);

  const tracks = useMemo(
    () => sortTracks(getVisibleTracks(section)),
    [section]
  );

  // Open the first track that still needs work, so the page lands on the
  // next thing to do rather than making the student hunt for it.
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);

  useEffect(() => {
    const next =
      tracks.find((track) => {
        const summary = getTrackSummary(
          track,
          getTrackProgress(sectionProgress, track.id),
          accessible || readOnly
        );
        return summary !== "complete" && summary !== "locked";
      }) ?? tracks[0];
    setExpandedTrackId(next?.id ?? null);
    // Re-pick only when the section changes, never on every status tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id]);

  const ratio = getSectionCompletionRatio(section, sectionProgress);
  const sentBackForReview = hasRevisionNotice(sectionProgress);

  return (
    <div className="w-full">
      {sentBackForReview && !readOnly && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Your teacher sent work in this section back for review. Update it and submit
            again when you&apos;re ready.
          </p>
        </div>
      )}

      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="eyebrow">
                Section {section.id}
              </span>
              {section.date && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <CalendarDays className="w-3 h-3" />
                  Due {section.date}
                </span>
              )}
              {sectionComplete && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Complete
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {section.title}
            </h1>
          </div>

          {!readOnly && ratio.total > 0 && (
            <div className="shrink-0 flex items-baseline gap-2 sm:block sm:pt-1 sm:text-right">
              <div className="eyebrow-muted">
                Required Work
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 sm:mt-0.5">
                {ratio.done} / {ratio.total} done
              </div>
            </div>
          )}
        </div>

        {section.objectives.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setExpandedObjectives((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-2"
            >
              <span>{expandedObjectives ? "▾" : "▸"}</span>
              Learning Objectives ({section.objectives.length})
            </button>

            {expandedObjectives && (
              <ul className="space-y-1.5">
                {section.objectives.map((obj) => (
                  <li
                    key={obj.id}
                    className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span>{obj.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="eyebrow-muted mb-2">
        Resources
      </p>

      <div className="space-y-3">
        {tracks.length === 0 && (
          <div className="card px-5 py-6 text-center">
            <p className="text-sm text-slate-400 italic">
              No resources have been added to this section yet.
            </p>
          </div>
        )}

        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            progress={getTrackProgress(sectionProgress, track.id)}
            accessible={accessible}
            expanded={expandedTrackId === track.id}
            onToggle={() =>
              setExpandedTrackId((id) => (id === track.id ? null : track.id))
            }
            onStepChange={(trackId, step, status, proofUrl) =>
              onUpdateActivity(section.id, trackId, step, status, proofUrl)
            }
            readOnly={readOnly}
          />
        ))}
      </div>

      {checkpoints.length > 0 && (
        <div className={cn("mt-6")}>
          <p className="eyebrow-muted mb-2">
            Coming Up After This Section
          </p>
          <div className="space-y-2">
            {checkpoints.map((checkpoint) => (
              <CheckpointRow key={checkpoint.id} checkpoint={checkpoint} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
