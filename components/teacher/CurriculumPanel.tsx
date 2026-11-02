"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloudUpload, Loader2, RotateCcw, X } from "lucide-react";
import type { CurriculumUnit } from "@/lib/db/types";
import type { SectionRemap } from "@/lib/store";
import type { Section } from "@/lib/types";
import type { CurriculumImporter } from "@/lib/use-curriculum-import";
import { insertSubunit, removeSubunit, shiftUnit } from "@/lib/curriculum-edit";
import { CurriculumReview } from "./CurriculumReview";
import { CurriculumTable } from "./CurriculumTable";
import { SubunitEditDialog } from "./SubunitEditDialog";

interface CurriculumPanelProps {
  classId: string;
  units: CurriculumUnit[];
  importer: CurriculumImporter;
  /** A plain save: names, dates, references. */
  onUpdate: (units: CurriculumUnit[]) => void;
  /** A save that renumbers: the work under the moved subunits moves with them. */
  onApply: (units: CurriculumUnit[], remaps: SectionRemap[]) => Promise<void>;
  getSubunitHref?: (subunitId: string) => string;
}

function MenuItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-10 px-3 rounded-lg text-left text-[15px] text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

function withSection(units: CurriculumUnit[], next: Section): CurriculumUnit[] {
  return units.map((unit) => ({
    ...unit,
    subunits: unit.subunits.map((s) => (s.id === next.id ? next : s)),
  }));
}

/**
 * The Curriculum tab, for teachers who do not live in software.
 *
 * At the top, always, one large panel says what reading a file does and has
 * one button that says "Upload a file" — the curriculum's one use of AI. The
 * table below is edited by hand, and every action is a labelled button: click
 * a subunit to open its form, "Add a subunit" at the end of each unit, "Move
 * dates" under each unit's name. Nothing is behind an icon-only menu.
 *
 * A file's changes come back written over this same table, reviewed row by
 * row; once saved, a banner offers Undo for as long as nothing has changed
 * since.
 */
export function CurriculumPanel({
  classId,
  units,
  importer,
  onUpdate,
  onApply,
  getSubunitHref,
}: CurriculumPanelProps) {
  const { review } = importer;
  const [editingId, setEditingId] = useState<string | null>(null);
  // The subunit just added, whose name opens ready to type.
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [undoHidden, setUndoHidden] = useState(false);

  const href = (id: string) =>
    getSubunitHref?.(id) ?? `/dashboard/class/${classId}/subunit/${encodeURIComponent(id)}`;

  const editing = (() => {
    for (const unit of units) {
      const section = unit.subunits.find((s) => s.id === editingId);
      if (section) return { unit, section };
    }
    return null;
  })();

  // A subunit removed or renumbered away is no longer open — but one just
  // added is opened before the class has re-rendered with it.
  const arriving = useRef<string | null>(null);
  useEffect(() => {
    if (editing && arriving.current === editingId) arriving.current = null;
    if (editingId && !editing && arriving.current !== editingId) setEditingId(null);
  }, [editingId, editing]);

  // A new import's Undo shows again.
  useEffect(() => {
    if (importer.undo) setUndoHidden(false);
  }, [importer.lastAppliedCount, importer.undo]);

  /** A new subunit after `afterId`, opened straight away so it can be named. */
  async function addAfter(unitId: string, afterId: string | null, edited: Section | null = null) {
    setError("");
    const base = edited ? withSection(units, edited) : units;
    const result = insertSubunit(base, unitId, afterId, { title: "New subunit" });
    if (!result) return;
    try {
      arriving.current = result.id;
      setAdded(result.id);
      setEditingId(result.id);
      if (result.remaps.length > 0) await onApply(result.units, result.remaps);
      else onUpdate(result.units);
    } catch {
      arriving.current = null;
      setEditingId(null);
      setError("That subunit could not be added — reload the page and try again.");
    }
  }

  if (review) return <CurriculumReview review={review} />;

  const empty = units.length === 0;

  return (
    <div className="space-y-5">
      {/* The one place a file comes in: big, worded, never missed. */}
      <section className="card px-5 py-5 cq-sm:px-6 flex flex-col cq-sm:flex-row cq-sm:items-center gap-4">
        <CloudUpload className="w-10 h-10 shrink-0 text-primary dark:text-primary-glow" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            {empty ? "Build your curriculum from a file" : "Update your curriculum from a file"}
          </h3>
          <p className="mt-1 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            {empty
              ? "Upload your pacing guide, calendar or syllabus and we'll set up your units and subunits. You'll check everything before it's saved."
              : "Have a new pacing guide or calendar? Upload it and we'll show you what's different. Nothing changes until you say yes."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => importer.setDialogOpen(true)}
          className="btn btn-lg btn-primary shrink-0"
        >
          {importer.running ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Reading your file…
            </>
          ) : (
            <>
              <CloudUpload className="w-5 h-5" />
              Upload a file
            </>
          )}
        </button>
      </section>

      {importer.undo && !undoHidden && (
        <div className="fade-in flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/20 px-4 py-3">
          <span className="flex-1 min-w-[12rem] text-[15px] text-emerald-900 dark:text-emerald-100">
            Saved {importer.lastAppliedCount} change{importer.lastAppliedCount === 1 ? "" : "s"} from your file.
          </span>
          <button
            type="button"
            disabled={importer.applying}
            onClick={() => void importer.undo?.()}
            className="btn btn-md btn-secondary"
          >
            <RotateCcw className="w-4 h-4" />
            Undo these changes
          </button>
          <button
            type="button"
            onClick={() => setUndoHidden(true)}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-emerald-800/60 hover:text-emerald-900 dark:text-emerald-200/60 dark:hover:text-emerald-100 transition-colors"
            aria-label="Hide this message"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {(error || importer.applyError) && (
        <p className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-[15px] text-rose-800 dark:text-rose-200">
          {error || importer.applyError}
        </p>
      )}

      <CurriculumTable
        classId={classId}
        units={units}
        onUpdate={onUpdate}
        getSubunitHref={getSubunitHref}
        hint={empty ? undefined : "Click any subunit to change its name, date or references."}
        onSelect={(id) => {
          setAdded(null);
          setEditingId(id);
        }}
        onAddSubunit={(unitId) => {
          const unit = units.find((u) => u.id === unitId);
          void addAfter(unitId, unit?.subunits.at(-1)?.id ?? null);
        }}
        unitMenu={(unit, close) => {
          const move = (days: number) => () => {
            close();
            onUpdate(shiftUnit(units, unit.id, days));
          };
          return (
            <div className="p-2">
              <p className="px-3 pt-1 pb-2 text-sm text-slate-500 dark:text-slate-400">
                Move every date in {unit.title} — its subunits, quizzes and tests. Weekends are skipped.
              </p>
              <MenuItem onClick={move(-1)}>1 school day earlier</MenuItem>
              <MenuItem onClick={move(1)}>1 school day later</MenuItem>
              <MenuItem onClick={move(-5)}>1 week earlier</MenuItem>
              <MenuItem onClick={move(5)}>1 week later</MenuItem>
            </div>
          );
        }}
      />

      <SubunitEditDialog
        section={editing?.section ?? null}
        href={editing ? href(editing.section.id) : ""}
        fresh={editing !== null && added === editing.section.id}
        onSave={(next) => onUpdate(withSection(units, next))}
        onAddAfter={(edited) => {
          if (editing) void addAfter(editing.unit.id, editing.section.id, edited);
        }}
        onRemove={() => {
          if (editing) onUpdate(removeSubunit(units, editing.section.id));
          setEditingId(null);
        }}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}
