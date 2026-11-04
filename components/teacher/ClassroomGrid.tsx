"use client";

import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Loader2, RefreshCw } from "lucide-react";
import type { CurriculumUnit } from "@/lib/db/types";
import { getInitialsFromName } from "@/lib/avatar";
import { externalColumns, visibleColumns } from "@/lib/classroom/edits";
import { DEFAULT_POINTS, isUnreturned, markOf, parseMark, parsePoints, unreturnedIn } from "@/lib/classroom/grades";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
 * in each cell a mark and a plain word for where that stands. A mark stays
 * private to the teacher until its column's grades are returned (ADR-011).
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
  const [returning, setReturning] = useState<{ itemKey: string; title: string; count: number } | null>(null);

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
          <WorkTable
            columns={columns}
            students={grid.students}
            links={grid.links}
            submissions={grid.submissions}
            onMark={grid.saveMark}
            onPoints={grid.savePoints}
            onReturn={(itemKey, title, count) => setReturning({ itemKey, title, count })}
          />
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

      <ConfirmDialog
        open={returning !== null}
        onClose={() => setReturning(null)}
        onConfirm={() => {
          if (returning) void grid.returnColumn(returning.itemKey);
        }}
        title="Return these grades to students?"
        confirmLabel="Return grades"
        body={
          <>
            {returning?.count === 1 ? "1 student" : `${returning?.count} students`} will see their mark for{" "}
            <strong>{returning?.title}</strong>{" "}
            in Google Classroom, and their work goes back to them. Students with no mark aren&apos;t affected.
          </>
        }
      />
    </div>
  );
}

/** Saves when the teacher leaves the box or presses Enter, never mid-typing. */
function NumberBox({
  value,
  label,
  parse,
  onSave,
  className,
}: {
  value: number | null;
  label: string;
  /** The value to save, or undefined if what was typed can't be saved. */
  parse: (raw: string) => number | null | undefined;
  onSave: (next: number | null) => void;
  className?: string;
}) {
  const shown = value === null ? "" : String(value);
  const [text, setText] = useState(shown);
  // A mark changed in Classroom, or refused by it, shows here when it arrives.
  useEffect(() => setText(shown), [shown]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      aria-label={label}
      title={label}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={() => {
        const next = parse(text);
        if (next === undefined) setText(shown);
        else if (next !== value) onSave(next);
      }}
      className={cn(
        "h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center text-xs tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
        className
      )}
    />
  );
}

function WorkTable({
  columns,
  students,
  links,
  submissions,
  onMark,
  onPoints,
  onReturn,
}: {
  columns: GridColumn[];
  students: GridStudent[];
  links: GridLink[];
  submissions: CachedSubmission[];
  /** Left out for work the teacher posted by hand, which only Classroom can change. */
  onMark?: (itemKey: string, userId: string, mark: number | null) => void;
  onPoints?: (itemKey: string, points: number) => void;
  onReturn?: (itemKey: string, title: string, count: number) => void;
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
                <th key={column.key} className="min-w-[8.5rem] px-2 py-3 text-center align-bottom font-semibold text-slate-500">
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
                  {linkFor.has(column.key) && (
                    <ColumnGrading
                      column={column}
                      points={linkFor.get(column.key)!.classroom?.maxPoints ?? DEFAULT_POINTS}
                      unreturned={unreturnedIn(column.key, submissions).length}
                      onPoints={onPoints}
                      onReturn={onReturn}
                    />
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
                  {columns.map((column, i) => {
                    const work = workFor.get(`${student.userId} ${column.key}`);
                    const points = linkFor.get(column.key)?.classroom?.maxPoints ?? DEFAULT_POINTS;
                    return (
                      <td key={column.key} className="px-2 py-3 text-center text-xs">
                        {statuses[i] !== "scheduled" && work && (
                          <div className="mb-1 flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400">
                            {onMark ? (
                              <NumberBox
                                value={markOf(work)}
                                label={`Mark for ${student.name}, ${column.head}`}
                                parse={(raw) => {
                                  const parsed = parseMark(raw);
                                  return parsed.ok ? parsed.mark : undefined;
                                }}
                                onSave={(mark) => onMark(column.key, student.userId, mark)}
                                className="w-11"
                              />
                            ) : (
                              <span className="tabular-nums text-slate-900 dark:text-slate-100">
                                {markOf(work) ?? "–"}
                              </span>
                            )}
                            <span className="tabular-nums">/ {points}</span>
                          </div>
                        )}
                        <div className={CELL_CLASS[statuses[i]]}>{CELL_LABEL[statuses[i]]}</div>
                        {isUnreturned(work) && (
                          <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                            {work?.state === "RETURNED" ? "New mark not returned" : "Not returned yet"}
                          </div>
                        )}
                      </td>
                    );
                  })}
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

/** A column's total, and the button that gives its marks to students. */
function ColumnGrading({
  column,
  points,
  unreturned,
  onPoints,
  onReturn,
}: {
  column: GridColumn;
  points: number;
  unreturned: number;
  onPoints?: (itemKey: string, points: number) => void;
  onReturn?: (itemKey: string, title: string, count: number) => void;
}) {
  if (!onPoints) {
    return <div className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">Out of {points}</div>;
  }
  return (
    <div className="mt-1.5 flex flex-col items-center gap-1.5">
      <label className="flex items-center gap-1 text-xs font-normal text-slate-500 dark:text-slate-400">
        Out of
        <NumberBox
          value={points}
          label={`Total points for ${column.head}`}
          parse={(raw) => parsePoints(raw) ?? undefined}
          onSave={(next) => {
            if (next !== null) onPoints(column.key, next);
          }}
          className="w-11"
        />
      </label>
      {unreturned > 0 && (
        <button
          type="button"
          onClick={() => onReturn?.(column.key, column.detail ?? column.head, unreturned)}
          className="btn btn-sm btn-secondary"
        >
          Return grades ({unreturned})
        </button>
      )}
    </div>
  );
}
