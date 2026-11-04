"use client";

import { useMemo } from "react";
import { GraduationCap, Loader2, RefreshCw } from "lucide-react";
import type { CurriculumUnit } from "@/lib/db/types";
import { getInitialsFromName } from "@/lib/avatar";
import { externalColumns, visibleColumns } from "@/lib/classroom/edits";
import {
  CELL_LABEL,
  cellStatus,
  gridColumns,
  studentOverall,
  type CachedSubmission,
  type CellStatus,
  type GridColumn,
  type GridLink,
} from "@/lib/classroom/grid";
import type { ClassroomConnection } from "@/lib/use-classroom";
import { useClassroomGrid, type GridStudent } from "@/lib/use-classroom-grid";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { ActionCard } from "./ActionCard";

const CELL_CLASS: Record<CellStatus, string> = {
  scheduled: "text-slate-400 dark:text-slate-500",
  returned: "text-emerald-700 dark:text-emerald-400",
  "turned-in": "text-emerald-700 dark:text-emerald-400 font-medium",
  late: "text-amber-700 dark:text-amber-400 font-medium",
  missing: "text-rose-700 dark:text-rose-400 font-medium",
  "not-yet": "text-slate-500 dark:text-slate-400",
};

function Notice({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <ActionCard icon={GraduationCap} action={action}>
      {children}
    </ActionCard>
  );
}

/**
 * The Classroom tab of a class that lives in Google Classroom: its students
 * down the side, what they can turn in across the top, one unit at a time, and
 * in each cell a plain word for where that stands.
 */
export function ClassroomGrid({
  classId,
  unit,
  classroom,
  onOpenCurriculum,
}: {
  classId: string;
  unit: CurriculumUnit | undefined;
  classroom: ClassroomConnection;
  onOpenCurriculum: () => void;
}) {
  const { status } = classroom;
  const linked = status.state === "connected" && status.courseId !== null;
  const grid = useClassroomGrid(classId, linked, classroom.syncCount);
  const columns = useMemo(() => (unit ? visibleColumns(gridColumns(unit), grid.links) : []), [unit, grid.links]);
  const byHand = useMemo(() => externalColumns(grid.links), [grid.links]);

  if (status.state === "loading") {
    return (
      <p className="flex items-center gap-2 text-[15px] text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
        Checking Google Classroom…
      </p>
    );
  }
  if (status.state === "unavailable") {
    return (
      <Notice
        action={
          <button type="button" onClick={() => void classroom.refresh()} className="btn btn-lg btn-secondary shrink-0">
            Try again
          </button>
        }
      >
        We couldn&apos;t reach Google Classroom just now.
      </Notice>
    );
  }
  if (status.state === "disconnected" || grid.needsReconnect) {
    return (
      <Notice
        action={
          <a href={classroom.connectHref()} className="btn btn-lg btn-primary shrink-0">
            {status.state === "disconnected" ? "Connect Google Classroom" : "Reconnect Google Classroom"}
          </a>
        }
      >
        {status.state === "disconnected"
          ? "Connect Google Classroom to see your students and what they've turned in."
          : "To show your students, we need one more permission from Google. Reconnect once and tick every box."}
      </Notice>
    );
  }
  if (!linked) {
    return (
      <Notice
        action={
          <button type="button" onClick={onOpenCurriculum} className="btn btn-lg btn-primary shrink-0">
            Go to Curriculum
          </button>
        }
      >
        Choose which Google Classroom class this is, on the Curriculum tab, to see your students here.
      </Notice>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-slate-600 dark:text-slate-300">
          {grid.students.length} {grid.students.length === 1 ? "student" : "students"} in Google Classroom
        </p>
        <div className="flex items-center gap-3">
          {grid.pulledAt && !grid.pulling && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Updated {grid.pulledAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void grid.refresh()}
            disabled={grid.pulling}
            aria-busy={grid.pulling}
            className="btn btn-md btn-secondary"
          >
            <RefreshCw className={cn("w-4 h-4", grid.pulling && "animate-spin")} aria-hidden />
            {grid.pulling ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {grid.error && (
        <p className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-[15px] text-rose-800 dark:text-rose-200">
          {grid.error}
        </p>
      )}

      {grid.students.length === 0 ? (
        <div className="card px-5 py-10 text-center text-[15px] text-slate-500 dark:text-slate-400">
          {grid.loaded && !grid.pulling
            ? "No students in this Google Classroom class yet. Once they join it there, they'll appear here."
            : "Looking for your students…"}
        </div>
      ) : (
        <>
          <div data-tour="progress-table">
            <WorkTable columns={columns} students={grid.students} links={grid.links} submissions={grid.submissions} />
          </div>
          {byHand.length > 0 && (
            <div className="space-y-3 pt-5">
              <div>
                <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">
                  Also in Google Classroom
                </h3>
                <p className="mt-0.5 text-[15px] text-slate-600 dark:text-slate-300">
                  Assignments you posted there yourself. To change them, use Google Classroom.
                </p>
              </div>
              <WorkTable columns={byHand} students={grid.students} links={grid.links} submissions={grid.submissions} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WorkTable({
  columns,
  students,
  links,
  submissions,
}: {
  columns: GridColumn[];
  students: GridStudent[];
  links: GridLink[];
  submissions: CachedSubmission[];
}) {
  const linkFor = new Map(links.map((l) => [l.itemKey, l]));
  const workFor = new Map(submissions.map((s) => [`${s.userId} ${s.itemKey}`, s]));
  const now = new Date();

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="text-left px-4 py-3 font-semibold text-slate-500 min-w-[12rem] sticky left-0 z-10 float-pane-sticky">
                Student
              </th>
              {columns.map((column) => (
                <th key={column.key} className="min-w-[7rem] px-2 py-3 text-center align-bottom font-semibold text-slate-500">
                  <div className={cn(column.kind === "checkpoint" && "text-slate-900 dark:text-slate-100")}>
                    {column.head}
                  </div>
                  {column.detail && (
                    <div className="mt-0.5 text-xs font-normal leading-snug text-slate-500 dark:text-slate-400">
                      {column.detail}
                    </div>
                  )}
                  {column.date && (
                    <div className="mt-0.5 text-xs font-normal text-slate-400 dark:text-slate-500">{column.date}</div>
                  )}
                </th>
              ))}
              <th className="min-w-[5rem] px-3 py-3 text-center font-semibold text-slate-500">Overall</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const statuses = columns.map((column) =>
                cellStatus(column, linkFor.get(column.key), workFor.get(`${student.userId} ${column.key}`), now)
              );
              const overall = studentOverall(statuses);
              return (
                <tr key={student.userId} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                  <td className="px-4 py-3 sticky left-0 z-10 float-pane-sticky">
                    <div className="flex items-center gap-2">
                      <UserAvatar initials={getInitialsFromName(student.name)} size="sm" />
                      <span className="font-medium whitespace-nowrap">{student.name}</span>
                    </div>
                  </td>
                  {columns.map((column, i) => (
                    <td key={column.key} className={cn("px-2 py-3 text-center text-xs", CELL_CLASS[statuses[i]])}>
                      {CELL_LABEL[statuses[i]]}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center text-xs font-semibold">
                    {overall === null ? "—" : `${overall}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
