import type { Section, SectionActivityStatus } from "@/lib/types";
import { getVisibleTracks, sortTracks, trackAbbr } from "@/lib/section-tracks";
import { getTeacherTrackStatus, getTrackProgress } from "@/lib/class-progress";
import { STATUS_CHIP, STATUS_LABEL, type ProgressStatus } from "@/lib/status-styles";
import { Tooltip } from "@/components/Tooltip";
import { cn } from "@/lib/utils";

/**
 * The two states that are waiting on the teacher say so, loudly. Everything
 * else is just where the student is.
 */
const NEEDS_ACTION: Partial<Record<ProgressStatus, { label: string; tone: string }>> = {
  review: {
    label: "Needs Review",
    tone: "font-bold text-amber-600 dark:text-amber-400",
  },
  help: {
    label: "Help!",
    tone: "font-bold text-rose-600 dark:text-rose-400",
  },
};

/**
 * One chip per resource in a section — the compact form of the three buttons,
 * so a grid row shows at a glance who is behind on which resource.
 */
export function TrackStatusDots({
  section,
  sectionProgress,
  accessible,
  size = "sm",
  onTrackClick,
}: {
  section: Section;
  sectionProgress: SectionActivityStatus | undefined;
  accessible: boolean;
  size?: "sm" | "xs";
  onTrackClick?: (trackId: string) => void;
}) {
  const tracks = sortTracks(getVisibleTracks(section));
  if (tracks.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {tracks.map((track) => {
        const status = getTeacherTrackStatus(
          track,
          getTrackProgress(sectionProgress, track.id),
          accessible
        );
        const chip = (
          <span
            className={cn(
              "inline-flex items-center justify-center rounded font-bold leading-none tracking-wide",
              size === "xs" ? "w-5 h-4 text-[9px]" : "w-6 h-5 text-[10px]",
              STATUS_CHIP[status]
            )}
          >
            {trackAbbr(track)}
          </span>
        );

        const action = NEEDS_ACTION[status];
        const tip = (
          <>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {track.label}
            </span>
            {" — "}
            <span className={action?.tone}>{action?.label ?? STATUS_LABEL[status]}</span>
          </>
        );

        return (
          <Tooltip key={track.id} label={tip} className="inline-flex">
            {onTrackClick ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTrackClick(track.id);
                }}
                className="rounded transition-opacity hover:opacity-70"
              >
                {chip}
              </button>
            ) : (
              chip
            )}
          </Tooltip>
        );
      })}
    </div>
  );
}
