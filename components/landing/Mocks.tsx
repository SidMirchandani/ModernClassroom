import { Check, FileText, X } from "lucide-react";
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
  { name: "Ava Thompson", initials: "AT", cells: [{ mark: 18, word: "turned-in" }, { mark: 95, word: "returned" }, { mark: null, word: "not-yet" }] },
  { name: "Ben Carter", initials: "BC", cells: [{ mark: 20, word: "turned-in" }, { mark: 88, word: "returned" }, { mark: null, word: "not-yet" }] },
  { name: "Chloe Nguyen", initials: "CN", cells: [{ mark: null, word: "missing" }, { mark: 90, word: "late" }, { mark: null, word: "not-yet" }] },
] as const;

const WORDS = {
  "turned-in": { label: "Turned in", tone: "text-emerald-700 dark:text-emerald-400" },
  returned: { label: "Returned", tone: "text-emerald-700 dark:text-emerald-400" },
  late: { label: "Turned in late", tone: "text-amber-700 dark:text-amber-400" },
  missing: { label: "Missing", tone: "text-rose-700 dark:text-rose-400" },
  "not-yet": { label: "Not yet", tone: "text-slate-500 dark:text-slate-400" },
} as const;

const COLUMNS = [
  { head: "Quiz 3A", total: 20 },
  { head: "3.1 Slope", total: 100 },
  { head: "3.2 Lines", total: 100 },
];

/** The teacher's grid: who turned in what, and the mark on it. */
export function GridMock() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="py-2.5 pl-4 pr-2 text-[11px] font-semibold text-slate-500">Student</th>
            {COLUMNS.map((c) => (
              <th key={c.head} className="py-2.5 px-2 text-center text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STUDENTS.map((s, rowIndex) => (
            <tr key={s.name} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <td className="py-2.5 pl-4 pr-2">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-primary text-[9px] font-semibold text-white flex items-center justify-center">
                    {s.initials}
                  </span>
                  <span className="hidden sm:inline text-[12px] font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                    {s.name}
                  </span>
                </span>
              </td>
              {s.cells.map((cell, i) => (
                <td key={i} className="py-2.5 px-2 text-center">
                  <span className="chip-in block" style={{ "--i": rowIndex + i } as React.CSSProperties}>
                    {cell.mark !== null && (
                      <span className="block text-[12px] font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {cell.mark} / {COLUMNS[i].total}
                      </span>
                    )}
                    <span className={cn("block text-[10px] leading-tight", WORDS[cell.word].tone)}>
                      {WORDS[cell.word].label}
                    </span>
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Where lessons stand in Google Classroom, with nothing to press. */
export function PostMock() {
  const lessons = [
    { title: "3.1 Slope & Recursive Formulas", when: "Posted", done: true },
    { title: "3.2 Linear Equations as Models", when: "Posted", done: true },
    { title: "3.3 Line of Best Fit", when: "Oct 14, 7:00 AM", done: false },
    { title: "Quiz 3A", when: "Oct 15, 7:00 AM", done: false },
  ];
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
        {lessons.map((l, i) => (
          <li
            key={l.title}
            className="chip-in flex items-center justify-between gap-3 px-4 py-2.5"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="min-w-0 truncate text-[13px] text-slate-800 dark:text-slate-100">{l.title}</span>
            <span
              className={cn(
                "shrink-0 text-[11px]",
                l.done ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
              )}
            >
              {l.when}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-2 border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 text-[12px] text-emerald-700 dark:text-emerald-400">
        <Check className="w-3.5 h-3.5" />
        Up to date
      </p>
    </div>
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
    <div aria-hidden="true">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          Curriculum
        </span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg border border-primary/30 text-primary dark:text-primary-glow">
          2 changes
        </span>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {rows.map((r) => (
          <div key={r.num} className="py-3">
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
              <div className="mt-1.5 flex items-center gap-2">
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

      <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
        <span className="flex-1 text-[10px] text-slate-400">2 changes to check</span>
        <span className="btn btn-sm btn-secondary pointer-events-none !h-6 !text-[10px] !px-2">
          Reject all
        </span>
        <span className="btn btn-sm btn-primary pointer-events-none !h-6 !text-[10px] !px-2">
          Accept all
        </span>
      </div>
    </div>
  );
}


/**
 * Starting a class: the teacher's own files and a note go in, a drafted
 * curriculum comes out. Open — rows split by hairlines, no frame — like the
 * new-class page it pictures.
 */
export function CreateMock() {
  const files = [
    { name: "Algebra II Time Line 2026.xlsx", size: "48 KB" },
    { name: "Course Syllabus.pdf", size: "212 KB" },
    { name: "Unit 3 plan (photo).jpg", size: "1.4 MB" },
  ];
  const units = [
    { title: "Unit 1 · Sequences", count: "6 subunits · 2 quizzes" },
    { title: "Unit 2 · Central Tendency and Dot Plots", count: "5 subunits · 1 test" },
    { title: "Unit 3 · Linear Models and Systems", count: "7 subunits · 2 quizzes · 1 test" },
  ];

  return (
    <div aria-hidden="true">
      <p className="text-xs font-medium text-slate-400">Your materials</p>
      <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800/70">
        {files.map((f) => (
          <li key={f.name} className="flex items-center gap-2.5 py-2 text-[13px]">
            <FileText className="w-4 h-4 shrink-0 text-slate-400" />
            <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-200">{f.name}</span>
            <span className="text-[11px] text-slate-400">{f.size}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 pb-2 border-b border-slate-200 dark:border-slate-700 text-[13px] text-slate-500 dark:text-slate-400">
        Column F is the AP Classroom topic. Quizzes are every other Friday.
      </p>

      <p className="mt-6 flex items-center gap-2 text-[13px] font-medium text-primary dark:text-primary-glow">
        <Check className="w-4 h-4" />
        5 units, 31 subunits and 9 checkpoints, ready to review
      </p>
      <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800/70">
        {units.map((u, i) => (
          <li
            key={u.title}
            className="chip-in py-2.5 flex items-baseline justify-between gap-3"
            style={{ "--i": i * 2 } as React.CSSProperties}
          >
            <span className="text-[13px] text-slate-800 dark:text-slate-100 truncate">{u.title}</span>
            <span className="text-[11px] text-slate-400 whitespace-nowrap">{u.count}</span>
          </li>
        ))}
        <li className="py-2.5 text-[12px] text-slate-400">+ 2 more units, waiting for your approval</li>
      </ul>
    </div>
  );
}
