"use client";

import { Check, Loader2, Minus, Plus, X } from "lucide-react";
import type {
  Change,
  ChangeSet,
  PlannedCheckpoint,
  PlannedSection,
  PlannedUnit,
} from "@/lib/curriculum-diff";
import { cn } from "@/lib/utils";

interface CurriculumDiffProps {
  set: ChangeSet;
  approved: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onApproveAll: () => void;
  onDenyAll: () => void;
  onApply: () => void;
  onDiscard: () => void;
  applying: boolean;
  notes?: string[];
}

/**
 * The same curriculum table, with the proposal written over it in place: every
 * cell that would change shows what it says now and what it would say, and
 * carries its own yes and no. Nothing here writes anything — the teacher's
 * decisions are a set of ticks until they press Apply.
 */

function ChangeRow({
  change,
  approved,
  onToggle,
}: {
  change: Change;
  approved: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <div className="flex-1 min-w-0">
        <span className="text-slate-400">{change.field}</span>{" "}
        {change.before !== null && (
          <span
            className={cn(
              "text-slate-500 dark:text-slate-400",
              change.after !== null && "line-through decoration-slate-300"
            )}
          >
            {change.before}
          </span>
        )}
        {change.before !== null && change.after !== null && (
          <span className="text-slate-300 dark:text-slate-600"> → </span>
        )}
        {change.after !== null && (
          <span
            className={cn(
              "font-medium",
              approved
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-slate-700 dark:text-slate-200"
            )}
          >
            {change.after}
          </span>
        )}
      </div>
      <Decision id={change.id} approved={approved} onToggle={onToggle} />
    </div>
  );
}

function Decision({
  id,
  approved,
  onToggle,
  label,
}: {
  id: string;
  approved: boolean;
  onToggle: (id: string) => void;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => !approved && onToggle(id)}
        title={label ? `Approve ${label}` : "Approve"}
        aria-pressed={approved}
        className={cn(
          "p-1 transition-colors",
          approved
            ? "bg-emerald-500 text-white"
            : "text-slate-400 hover:text-emerald-600"
        )}
      >
        <Check className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={() => approved && onToggle(id)}
        title={label ? `Leave ${label} as it is` : "Leave as it is"}
        aria-pressed={!approved}
        className={cn(
          "p-1 border-l border-slate-200 dark:border-slate-700 transition-colors",
          !approved ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200" : "text-slate-400 hover:text-rose-500"
        )}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function sectionLabel(section: PlannedSection): string {
  return section.existing?.id ?? section.proposed?.number ?? "";
}

export function CurriculumDiff({
  set,
  approved,
  onToggle,
  onApproveAll,
  onDenyAll,
  onApply,
  onDiscard,
  applying,
  notes,
}: CurriculumDiffProps) {
  const unitChanges = new Map<string, Change[]>();
  const sectionChanges = new Map<string, Change[]>();
  const checkpointChanges = new Map<string, Change[]>();

  for (const change of set.changes) {
    const target = change.sectionKey
      ? sectionChanges
      : change.checkpointKey
        ? checkpointChanges
        : unitChanges;
    const key = change.sectionKey
      ? `${change.unitKey}::${change.sectionKey}`
      : change.checkpointKey
        ? `${change.unitKey}::${change.checkpointKey}`
        : change.unitKey;
    target.set(key, [...(target.get(key) ?? []), change]);
  }

  const approvedCount = set.changes.filter((c) => approved.has(c.id)).length;
  const destructiveApproved = set.changes.filter(
    (c) => c.destructive && approved.has(c.id)
  ).length;

  function renderUnitTitle(unit: PlannedUnit) {
    const changes = unitChanges.get(unit.key) ?? [];
    const added = changes.find((c) => c.kind === "unit-add");
    const removed = changes.find((c) => c.kind === "unit-remove");
    const retitled = changes.find((c) => c.kind === "unit-title");

    return (
      <div className="space-y-1.5">
        <span
          className={cn(
            "font-semibold block",
            removed && approved.has(removed.id)
              ? "text-rose-600 dark:text-rose-400 line-through"
              : "text-primary dark:text-primary-glow"
          )}
        >
          {retitled && approved.has(retitled.id)
            ? retitled.after
            : (unit.existing?.title ?? unit.proposed?.title)}
        </span>

        {added && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <Plus className="w-3 h-3" /> New unit
            </span>
            <Decision id={added.id} approved={approved.has(added.id)} onToggle={onToggle} />
          </div>
        )}
        {removed && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 dark:text-rose-400">
              <Minus className="w-3 h-3" /> Not in your files
            </span>
            <Decision id={removed.id} approved={approved.has(removed.id)} onToggle={onToggle} />
          </div>
        )}
        {retitled && (
          <ChangeRow
            change={retitled}
            approved={approved.has(retitled.id)}
            onToggle={onToggle}
          />
        )}
      </div>
    );
  }

  function renderSections(unit: PlannedUnit) {
    return (
      <div className="space-y-1.5">
        {unit.sections.map((section) => {
          const key = `${unit.key}::${section.key}`;
          const changes = sectionChanges.get(key) ?? [];
          const added = changes.find((c) => c.kind === "section-add");
          const removed = changes.find((c) => c.kind === "section-remove");
          const renumber = changes.find((c) => c.kind === "section-renumber");
          const fields = changes.filter(
            (c) =>
              c.kind !== "section-add" &&
              c.kind !== "section-remove" &&
              c.kind !== "section-renumber"
          );
          const quiet = changes.length === 0;

          return (
            <div
              key={key}
              className={cn(
                "rounded-lg border px-2.5 py-2",
                quiet && "border-slate-100 dark:border-slate-800/60",
                added && "border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20",
                removed && "border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20",
                !quiet && !added && !removed && "border-slate-200 dark:border-slate-700"
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-slate-400">
                    {renumber && approved.has(renumber.id) ? (
                      <>
                        <span className="line-through">{renumber.before}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {" "}
                          → {renumber.after}
                        </span>
                      </>
                    ) : (
                      sectionLabel(section)
                    )}
                  </span>{" "}
                  <span
                    className={cn(
                      "text-sm",
                      removed && approved.has(removed.id) && "line-through text-rose-600 dark:text-rose-400",
                      quiet && "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    {section.existing?.title ?? section.proposed?.title}
                  </span>
                  {section.existing?.date && (
                    <span className="text-[10px] text-slate-400 ml-1.5">
                      {section.existing.date}
                    </span>
                  )}
                </div>

                {added && (
                  <Decision
                    id={added.id}
                    approved={approved.has(added.id)}
                    onToggle={onToggle}
                    label="this new subunit"
                  />
                )}
                {removed && (
                  <Decision
                    id={removed.id}
                    approved={approved.has(removed.id)}
                    onToggle={onToggle}
                    label="removing this subunit"
                  />
                )}
              </div>

              {added && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                  New — {added.after}
                </p>
              )}
              {removed && (
                <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1">
                  Not in your files. Approving removes it from the table; anything students
                  did under it stays filed, and comes back if it returns.
                </p>
              )}

              {(renumber || fields.length > 0) && (
                <div className="mt-1.5 space-y-1 border-t border-dashed border-slate-200 dark:border-slate-700 pt-1.5">
                  {renumber && (
                    <ChangeRow
                      change={renumber}
                      approved={approved.has(renumber.id)}
                      onToggle={onToggle}
                    />
                  )}
                  {fields.map((change) => (
                    <ChangeRow
                      key={change.id}
                      change={change}
                      approved={approved.has(change.id)}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderCheckpoints(unit: PlannedUnit) {
    if (unit.checkpoints.length === 0) {
      return <span className="text-xs text-slate-400 italic">None</span>;
    }

    return (
      <div className="space-y-1.5">
        {unit.checkpoints.map((checkpoint: PlannedCheckpoint) => {
          const key = `${unit.key}::${checkpoint.key}`;
          const changes = checkpointChanges.get(key) ?? [];
          const added = changes.find((c) => c.kind === "checkpoint-add");
          const removed = changes.find((c) => c.kind === "checkpoint-remove");
          const fields = changes.filter((c) => c.kind === "checkpoint-field");

          return (
            <div
              key={key}
              className={cn(
                "rounded-lg border px-2.5 py-1.5",
                changes.length === 0
                  ? "border-slate-100 dark:border-slate-800/60"
                  : "border-slate-200 dark:border-slate-700",
                added && "border-emerald-200 dark:border-emerald-900",
                removed && "border-rose-200 dark:border-rose-900"
              )}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "flex-1 min-w-0 text-xs",
                    changes.length === 0 && "text-slate-500 dark:text-slate-400"
                  )}
                >
                  {checkpoint.existing?.title ?? checkpoint.proposed?.title}
                  {checkpoint.existing?.date && (
                    <span className="text-slate-400"> · {checkpoint.existing.date}</span>
                  )}
                </span>
                {added && (
                  <Decision
                    id={added.id}
                    approved={approved.has(added.id)}
                    onToggle={onToggle}
                    label="this checkpoint"
                  />
                )}
                {removed && (
                  <Decision
                    id={removed.id}
                    approved={approved.has(removed.id)}
                    onToggle={onToggle}
                    label="removing this checkpoint"
                  />
                )}
              </div>
              {added && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                  New — {added.after}
                </p>
              )}
              {fields.length > 0 && (
                <div className="mt-1 space-y-1">
                  {fields.map((change) => (
                    <ChangeRow
                      key={change.id}
                      change={change}
                      approved={approved.has(change.id)}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Curriculum
        </h2>
        <span className="text-xs font-medium px-2.5 py-1 rounded-lg border border-primary/30 text-primary dark:text-primary-glow">
          {set.changes.length === 0
            ? "Nothing to change"
            : `${set.changes.length} suggestion${set.changes.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {set.changes.length === 0 && (
        <p className="panel-inset px-4 py-3 mb-3 text-sm text-slate-600 dark:text-slate-300">
          Your files match the curriculum you already have. Nothing would change.
        </p>
      )}

      {notes && notes.length > 0 && (
        <ul className="panel-inset px-4 py-3 mb-3 space-y-1 text-xs text-slate-600 dark:text-slate-300 list-disc list-inside">
          {notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}

      <div className="card overflow-hidden">
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {set.plan.units.map((unit) => (
            <div key={unit.key} className="px-4 py-4 space-y-3">
              <div>{renderUnitTitle(unit)}</div>
              <div>
                <p className="eyebrow-muted mb-2">Subunits</p>
                {renderSections(unit)}
              </div>
              <div>
                <p className="eyebrow-muted mb-2">Checkpoints</p>
                {renderCheckpoints(unit)}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-semibold text-slate-500 w-40">
                  Unit
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500">
                  Subunits
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 w-72">
                  Checkpoints
                </th>
              </tr>
            </thead>
            <tbody>
              {set.plan.units.map((unit) => (
                <tr
                  key={unit.key}
                  className="border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                >
                  <td className="px-4 py-3 align-top border-r border-slate-100 dark:border-slate-800/50">
                    {renderUnitTitle(unit)}
                  </td>
                  <td className="px-4 py-3 align-top">{renderSections(unit)}</td>
                  <td className="px-4 py-3 align-top border-l border-slate-100 dark:border-slate-800/50">
                    {renderCheckpoints(unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 mt-3 -mx-1 px-1">
        <div className="float-pane-raised rounded-2xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 flex flex-wrap items-center gap-2 shadow-lg">
          <span className="text-xs text-slate-600 dark:text-slate-300 flex-1 min-w-[10rem]">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {approvedCount}
            </span>{" "}
            of {set.changes.length} approved
            {destructiveApproved > 0 && (
              <span className="text-rose-600 dark:text-rose-400">
                {" "}
                · {destructiveApproved} removes something
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={onApproveAll}
            className="btn btn-sm btn-secondary"
          >
            Approve all
          </button>
          <button
            type="button"
            onClick={onDenyAll}
            className="btn btn-sm btn-secondary"
          >
            Deny all
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="btn btn-sm btn-ghost"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={applying || approvedCount === 0}
            onClick={onApply}
            className="btn btn-sm btn-primary"
          >
            {applying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Apply {approvedCount > 0 ? approvedCount : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
