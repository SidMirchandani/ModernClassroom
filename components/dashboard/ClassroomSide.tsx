import { ArrowUpRight, GraduationCap, Loader2, MoreVertical, Plus, Unlink } from "lucide-react";
import { Popover } from "@/components/Popover";
import type { AccentId } from "@/lib/class-appearance";
import { ColorPicker } from "./ColorPicker";

export interface DashboardCourse {
  name: string;
  section?: string;
  alternateLink?: string;
  students: number;
  /** Our banner's colour. Google doesn't share or take a class's real theme. */
  color?: AccentId;
}

const FIELD =
  "slash-right flex items-center justify-center min-h-[9.5rem] border-t border-slate-200 dark:border-slate-700 sm:border-t-0 bg-slate-100 dark:bg-slate-800";

/**
 * The right half of a dashboard row: the Google Classroom class this one is
 * connected to, or a plain field with a plus to connect one.
 *
 * `course === undefined` means still finding out, which says so: left blank it
 * read as a class that had no Google Classroom. Classroom's API doesn't give out
 * a class's banner, so a connected class gets a banner of our own.
 */
export function ClassroomSide({
  course,
  connectHref,
  className,
  onUnlink,
  onColor,
}: {
  course: DashboardCourse | null | undefined;
  connectHref: string;
  className: string;
  onUnlink: () => void;
  onColor: (color: AccentId) => void;
}) {
  if (course === undefined) {
    return (
      <div role="status" className={`${FIELD} gap-2 text-sm text-slate-500 dark:text-slate-400`}>
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        Fetching Google Classroom…
      </div>
    );
  }

  if (course === null) {
    return (
      <a
        href={connectHref}
        aria-label={`Connect ${className} to Google Classroom`}
        title="Connect to Google Classroom"
        className={`${FIELD} text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300`}
      >
        <Plus className="w-7 h-7" aria-hidden />
      </a>
    );
  }

  const body = (
    <>
      <div className="relative overflow-hidden flex-1 bg-primary px-5 sm:pl-12 pt-5 pb-6 pr-24 text-white transition-[filter] duration-150 group-hover/course:brightness-110">
        <GraduationCap aria-hidden className="absolute -right-3 -bottom-5 w-28 h-28 text-white/10" />
        <p className="relative text-xs text-white/70">Google Classroom</p>
        <p className="relative mt-0.5 text-xl font-medium leading-snug truncate group-hover/course:underline underline-offset-2">
          {course.name}
        </p>
        {course.section && <p className="relative text-sm text-white/80 truncate">{course.section}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 px-5 sm:pl-8 py-3 text-sm text-slate-500 dark:text-slate-400">
        {course.students > 0 ? `${course.students} student${course.students === 1 ? "" : "s"}` : "Connected"}
        {course.alternateLink && (
          <ArrowUpRight
            aria-hidden
            className="w-4 h-4 shrink-0 transition-colors group-hover/course:text-primary dark:group-hover/course:text-primary-glow"
          />
        )}
      </div>
    </>
  );
  const card = "group/course flex flex-col h-full min-h-[9.5rem]";
  const color = course.color ?? "slate";

  return (
    <div
      className="slash-right relative min-w-0 border-t border-slate-200 dark:border-slate-700 sm:border-t-0"
      data-accent={color}
    >
      {course.alternateLink ? (
        <a
          href={course.alternateLink}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${course.name} in Google Classroom (opens in a new tab)`}
          className={card}
        >
          {body}
        </a>
      ) : (
        <div className={card}>{body}</div>
      )}

      {/* Outside the link, so these can't open Google Classroom. */}
      <div className="absolute right-2.5 top-2.5 flex items-center">
        <ColorPicker value={color} title="Change color" onPick={onColor} />
        <Popover
          width={224}
          align="right"
          triggerTitle="Google Classroom options"
          triggerClassName={(open) =>
            `w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors hover:bg-white/20 ${open ? "bg-white/20" : ""}`
          }
          label={<MoreVertical className="w-5 h-5" />}
          panelClassName="p-1.5"
        >
          {(close) => (
            <button
              type="button"
              onClick={() => {
                close();
                onUnlink();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Unlink className="w-4 h-4" />
              Unlink
            </button>
          )}
        </Popover>
      </div>
    </div>
  );
}
