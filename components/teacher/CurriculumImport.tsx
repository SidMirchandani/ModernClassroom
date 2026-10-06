"use client";

import { useRef, useState } from "react";
import {
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import type { CurriculumUnit } from "@/lib/db/types";
import { cn } from "@/lib/utils";

interface CurriculumImportProps {
  units: CurriculumUnit[];
  demo: boolean;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  onInstructionsCommit: () => void;
  onGenerate: (files: File[]) => void;
  onCancel: () => void;
  busy: boolean;
  error: string;
  /** A proposal is already on screen; a second one would fight with it. */
  reviewing: boolean;
}

const ACCEPTED = ".xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.md,.pdf,.png,.jpg,.jpeg,.webp";

/**
 * A sample built from this very class, with a few deliberate edits: two dates
 * moved, one subunit retitled, one inserted. The model still does the real
 * work of reading it, so the demo shows what a real import shows — including
 * that everything untouched stays untouched.
 */
function sampleTimeline(units: CurriculumUnit[]): File {
  const rows: string[] = ["Unit,Subunit,Title,Date,Textbook"];
  const shifted = new Set<string>();

  units.slice(0, 3).forEach((unit) => {
    (unit.subunits ?? []).forEach((section, index) => {
      const textbook = section.tracks?.find((t) => t.kind === "textbook")?.reference ?? "";
      let title = section.title;
      let date = section.date ?? "";

      // One retitle and two nudged dates, so the diff has something honest in it.
      if (index === 0 && shifted.size === 0 && title) {
        title = `${title} (Review)`;
        shifted.add("title");
      } else if (date && shifted.size < 3) {
        const bumped = date.replace(/(\d+)\/(\d+)/, (_, m, d) => `${m}/${Number(d) + 1}`);
        if (bumped !== date) {
          date = bumped;
          shifted.add(`date-${section.id}`);
        }
      }

      rows.push(
        [unit.title, section.id, title, date, textbook]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
    });
  });

  const first = units[0];
  if (first && first.subunits.length > 0) {
    const last = first.subunits[first.subunits.length - 1];
    const [major, minor] = last.id.split(".");
    rows.push(
      [
        first.title,
        `${major}.${Number(minor) + 1}`,
        "Review and Practice Day",
        "",
        "",
      ]
        .map((v) => `"${v}"`)
        .join(",")
    );
  }

  return new File([rows.join("\n")], "Sample Time Line.csv", { type: "text/csv" });
}

export function CurriculumImport({
  units,
  demo,
  instructions,
  onInstructionsChange,
  onInstructionsCommit,
  onGenerate,
  onCancel,
  busy,
  error,
  reviewing,
}: CurriculumImportProps) {
  const [open, setOpen] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    setFiles((current) => [...current, ...Array.from(incoming)].slice(0, 10));
  };

  const totalMb = files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024;
  const locked = busy || reviewing;

  return (
    <div className="card mb-4" data-tour="curriculum-import">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
      >
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Build this from your own files
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Attach a time line, a syllabus or a scanned plan. Nothing is saved until you
            approve it.
          </span>
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!locked) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!locked) add(e.dataTransfer.files);
            }}
            className={cn(
              "rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-slate-300 dark:border-slate-700",
              locked && "opacity-60"
            )}
          >
            <FileSpreadsheet className="w-6 h-6 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Drop files here, or{" "}
              <button
                type="button"
                disabled={locked}
                onClick={() => inputRef.current?.click()}
                className="text-primary dark:text-primary-glow font-medium hover:underline disabled:no-underline"
              >
                choose them
              </button>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Spreadsheets, CSVs, PDFs and photos · up to {demo ? "6" : "15"} MB
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => {
                add(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <span className="truncate max-w-[14rem]">{file.name}</span>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setFiles((c) => c.filter((_, i) => i !== index))}
                    className="text-slate-400 hover:text-rose-500"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <label
              htmlFor="import-instructions"
              className="eyebrow-muted block mb-1.5"
            >
              Anything it should know
            </label>
            <textarea
              id="import-instructions"
              rows={2}
              value={instructions}
              disabled={locked}
              onChange={(e) => onInstructionsChange(e.target.value)}
              onBlur={onInstructionsCommit}
              placeholder="Column F is the AP Classroom topic, not a due date. Ignore the second tab — it is last year's."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm resize-y focus:outline-none focus:border-primary/60"
            />
          </div>

          {error && (
            <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={locked || files.length === 0}
              onClick={() => onGenerate(files)}
              className="btn btn-md btn-primary"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {busy ? "Reading your files…" : "Suggest changes"}
            </button>

            {/* Reading a year of curriculum takes a few seconds. Waiting with no
                way out is the part that feels broken, not the waiting. */}
            {busy && (
              <button type="button" onClick={onCancel} className="btn btn-md btn-secondary">
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            )}

            {demo && (
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  const sample = sampleTimeline(units);
                  setFiles([sample]);
                  onGenerate([sample]);
                }}
                className="btn btn-md btn-secondary"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Try it with a sample
              </button>
            )}

            {files.length > 0 && (
              <span className="text-xs text-slate-400">
                {files.length} file{files.length === 1 ? "" : "s"} · {totalMb.toFixed(1)} MB
              </span>
            )}
          </div>

          {reviewing && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Finish reviewing the suggestions below first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
