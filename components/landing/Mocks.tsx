import { Check, HelpCircle, X } from "lucide-react";
import { STATUS_CHIP, STATUS_DOT } from "@/lib/status-styles";
import { cn } from "@/lib/utils";

/**
 * The product, drawn in the product's own parts.
 *
 * A landing page that only describes software asks to be taken on trust. These
 * are small, honest miniatures built from the same tokens the real screens use
 * — the same status vocabulary, the same chips, the same borders — so what a
 * visitor sees here is what they get. They are decorative in the sense that
 * nothing is clickable, and marked `aria-hidden` for that reason; the prose
 * beside each one carries the meaning for anyone not seeing them.
 */

const STUDENTS = [
  { name: "Dutt P.", initials: "DP", row: ["complete", "complete", "in-progress", "not-started"] },
  { name: "Carson W.", initials: "CW", row: ["complete", "help", "not-started", "not-started"] },
  { name: "Maya I.", initials: "MI", row: ["complete", "complete", "complete", "review"] },
  { name: "Priya N.", initials: "PN", row: ["complete", "in-progress", "not-started", "not-started"] },
] as const;

const COLUMNS = ["3.1", "3.2", "3.3", "3.4"];

/** The teacher's grid: one row per student, one column per subunit. */
export function GridMock() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
        <span className="w-2 h-2 rounded-full bg-rose-400" />
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="ml-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Unit 3 · Linear Models and Systems
        </span>
      </div>

      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800">
            <th className="py-2 pl-3 sm:pl-4 pr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Student
            </th>
            {COLUMNS.map((c) => (
              <th
                key={c}
                className="py-2 px-1 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STUDENTS.map((s, rowIndex) => (
            <tr
              key={s.name}
              className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
            >
              <td className="py-2 pl-3 sm:pl-4 pr-2">
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center">
                    {s.initials}
                  </span>
                  <span className="hidden sm:inline text-[12px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {s.name}
                  </span>
                </span>
              </td>
              {s.row.map((status, i) => (
                <td key={i} className="py-2 px-1">
                  <span className="flex justify-center">
                    {/* Fills in on a diagonal, so the grid reads as a class
                        working through the unit rather than a static table. */}
                    <span
                      className={cn(
                        "chip-in w-6 sm:w-11 h-5 rounded-md border flex items-center justify-center",
                        STATUS_CHIP[status]
                      )}
                      style={{ "--i": rowIndex + i } as React.CSSProperties}
                    >
                      {status === "help" ? (
                        <HelpCircle className="w-3 h-3" />
                      ) : status === "complete" ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status])} />
                      )}
                    </span>
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 sm:px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
        {(["complete", "in-progress", "review", "help", "not-started"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[k])} />
            <span className="text-[10px] text-slate-400 capitalize">
              {k === "in-progress" ? "Active" : k === "not-started" ? "Not started" : k}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** One subunit, split by resource rather than by lesson. */
export function TracksMock() {
  const tracks = [
    { label: "Textbook", ref: "Ch 3.3", learn: true, practice: true, tone: "indigo" },
    { label: "AP Classroom", ref: "Topic 2.7", learn: true, practice: false, tone: "violet" },
    { label: "Guided Notes", ref: "Unit 3.3", learn: false, practice: false, tone: "teal" },
  ];

  return (
    <div className="card p-4 sm:p-5 space-y-2.5" aria-hidden="true">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-slate-400">3.3</span>
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Line of Best Fit
        </span>
        <span className="ml-auto text-[10px] text-slate-400">due 10/14</span>
      </div>

      {tracks.map((t) => (
        <div key={t.label} className="panel-inset p-3 flex items-center gap-3">
          <span
            className={cn(
              "w-1 self-stretch rounded-full",
              t.tone === "indigo" && "bg-indigo-400",
              t.tone === "violet" && "bg-violet-400",
              t.tone === "teal" && "bg-teal-400"
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-medium text-slate-700 dark:text-slate-200">
              {t.label}
            </span>
            <span className="block text-[10px] text-slate-400">{t.ref}</span>
          </span>
          <span className="flex gap-1 shrink-0">
            <Pill done={t.learn}>Learn</Pill>
            <Pill done={t.practice}>Practice</Pill>
          </span>
        </div>
      ))}
    </div>
  );
}

function Pill({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-5 px-1.5 rounded-md border text-[10px] font-medium",
        done
          ? "border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400"
          : "border-slate-200 dark:border-slate-700 text-slate-400"
      )}
    >
      {done && <Check className="w-2.5 h-2.5" />}
      {children}
    </span>
  );
}

/** The import's review: old beside new, a tick and a cross on each. */
export function DiffMock() {
  const rows = [
    { num: "3.3", title: "Line of Best Fit", field: "Date", before: "10/14", after: "10/16" },
    { num: "3.4", title: "Median-Median Line", field: null, before: null, after: null },
    { num: "3.5", title: "Residuals & RMSE", field: "Number", before: "3.5", after: "3.6" },
  ];

  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          Curriculum
        </span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg border border-primary/30 text-primary dark:text-primary-glow">
          2 suggestions
        </span>
      </div>

      <div className="p-3 space-y-2">
        {rows.map((r) => (
          <div
            key={r.num}
            className={cn(
              "rounded-lg border px-2.5 py-2",
              r.field
                ? "border-slate-200 dark:border-slate-700"
                : "border-slate-100 dark:border-slate-800/60"
            )}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] text-slate-400">{r.num}</span>
              <span
                className={cn(
                  "text-[12px]",
                  r.field
                    ? "text-slate-700 dark:text-slate-200"
                    : "text-slate-400 dark:text-slate-500"
                )}
              >
                {r.title}
              </span>
            </div>

            {r.field && (
              <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <span className="flex-1 min-w-0 text-[11px]">
                  <span className="text-slate-400">{r.field} </span>
                  <span className="text-slate-500 line-through">{r.before}</span>
                  <span className="text-slate-300 dark:text-slate-600"> → </span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {r.after}
                  </span>
                </span>
                <span className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                  <span className="p-0.5 bg-emerald-500 text-white">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  <span className="p-0.5 border-l border-slate-200 dark:border-slate-700 text-slate-400">
                    <X className="w-2.5 h-2.5" />
                  </span>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800">
        <span className="flex-1 text-[10px] text-slate-400">1 of 2 approved</span>
        <span className="btn btn-sm btn-secondary pointer-events-none !h-6 !text-[10px] !px-2">
          Deny all
        </span>
        <span className="btn btn-sm btn-primary pointer-events-none !h-6 !text-[10px] !px-2">
          Apply 1
        </span>
      </div>
    </div>
  );
}
