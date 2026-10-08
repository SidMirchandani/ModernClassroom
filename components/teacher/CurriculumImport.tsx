"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileUp, Loader2, TriangleAlert } from "lucide-react";
import type { CurriculumUnit } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { MAX_UPLOAD_MB, MaterialsPicker, totalMegabytes } from "./MaterialsPicker";

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
  /** Files handed over by the new-class page, shown as already attached. */
  initialFiles?: File[];
}

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
  initialFiles,
}: CurriculumImportProps) {
  const [open, setOpen] = useState(true);
  const [files, setFiles] = useState<File[]>([]);

  // Files the new-class page handed over arrive after mount.
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) setFiles(initialFiles);
  }, [initialFiles]);

  const tooLarge = totalMegabytes(files) > MAX_UPLOAD_MB;
  const locked = busy || reviewing;
  // A class with nothing in it yet is being built, not updated.
  const empty = units.length === 0;

  return (
    // No card: a section of the page, set off from the curriculum below it by
    // one hairline and the space around it. The one surface in it is the
    // composer, because that is the thing you type into.
    <section
      className="mb-8 pb-8 border-b border-slate-200 dark:border-slate-800"
      data-tour="curriculum-import"
    >
      <div className="flex items-start gap-3">
        <FileUp className="w-4 h-4 mt-1 shrink-0 text-slate-400" />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100">
            {empty ? "Build from files" : "Update from files"}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="shrink-0 h-6 inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          {open ? "Hide" : "Show"}
          <ChevronDown
            className={cn("w-3.5 h-3.5 transition-transform duration-300", open && "rotate-180")}
          />
        </button>
      </div>

      {/* Stays mounted so it can animate shut; `inert` takes the closed
          contents out of the tab order and away from screen readers. */}
      <div className={cn("collapse-grid", open && "is-open")} inert={!open}>
        <div>
          {/* Full width, lined up with the heading's icon. A pixel of room on
              every side so the composer's focus halo is never clipped. */}
          <div className="pt-4 pb-1 px-1">
            <MaterialsPicker
              files={files}
              onFilesChange={setFiles}
              notes={instructions}
              onNotesChange={onInstructionsChange}
              onNotesBlur={onInstructionsCommit}
              disabled={locked}
              busy={busy}
              actions={
                <>
                  {/* Reading a year of curriculum takes a few seconds. Waiting
                      with no way out is the part that feels broken. */}
                  {busy && (
                    <button type="button" onClick={onCancel} className="btn btn-sm btn-ghost">
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={locked || files.length === 0 || tooLarge}
                    onClick={() => onGenerate(files)}
                    // Still pressed-off while it reads, but at full strength:
                    // work in progress should not look switched off.
                    aria-busy={busy}
                    className="btn btn-sm btn-primary"
                  >
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {busy ? "Reading…" : empty ? "Build the curriculum" : "Suggest changes"}
                  </button>
                </>
              }
            />

            {error && (
              <p className="fade-in mt-3 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
                {error}
              </p>
            )}

            {demo && !empty && !busy && !reviewing && files.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  const sample = sampleTimeline(units);
                  setFiles([sample]);
                  onGenerate([sample]);
                }}
                className="mt-3 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                Try a sample →
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
