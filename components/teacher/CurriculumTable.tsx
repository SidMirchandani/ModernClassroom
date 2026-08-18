"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ChevronRight, CalendarDays } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { CurriculumUnit } from "@/lib/db/types";
import type { Checkpoint, CheckpointKind } from "@/lib/types";
import { emptySection } from "@/lib/curriculum";
import { Select } from "@/components/Select";
import { cn } from "@/lib/utils";

interface CurriculumTableProps {
  classId: string;
  units: CurriculumUnit[];
  onUpdate: (units: CurriculumUnit[]) => void;
  getSubunitHref?: (subunitId: string) => string;
  onEdit?: () => void;
}

const CHECKPOINT_KINDS: CheckpointKind[] = ["quiz", "test", "checkpoint", "project"];

const CHECKPOINT_KIND_LABELS: Record<CheckpointKind, string> = {
  quiz: "Quiz",
  test: "Test",
  checkpoint: "Checkpoint",
  project: "Project",
};

const CHECKPOINT_CHIP: Record<CheckpointKind, string> = {
  quiz: "border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300",
  test: "border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300",
  checkpoint: "border-primary/30 text-primary dark:text-primary-glow",
  project: "border-violet-200 dark:border-violet-900 text-violet-700 dark:text-violet-300",
};

export function CurriculumTable({
  classId,
  units,
  onUpdate,
  getSubunitHref,
  onEdit,
}: CurriculumTableProps) {
  const [editing, setEditing] = useState(false);

  function subunitHref(subunitId: string) {
    return (
      getSubunitHref?.(subunitId) ??
      `/dashboard/class/${classId}/subunit/${encodeURIComponent(subunitId)}`
    );
  }

  function patchUnit(unitId: string, patch: Partial<CurriculumUnit>) {
    onUpdate(units.map((u) => (u.id === unitId ? { ...u, ...patch } : u)));
  }

  function addUnit() {
    const unitNum = units.length + 1;
    onUpdate([
      ...units,
      {
        id: uuidv4(),
        title: `Unit ${unitNum}`,
        subunits: [emptySection(`${unitNum}.1`, `Subunit ${unitNum}.1`)],
        checkpoints: [],
      },
    ]);
    onEdit?.();
  }

  function addSubunit(unitId: string) {
    onUpdate(
      units.map((u) => {
        if (u.id !== unitId) return u;
        const num = u.subunits.length + 1;
        const unitNum = units.findIndex((x) => x.id === unitId) + 1;
        return {
          ...u,
          subunits: [
            ...u.subunits,
            emptySection(`${unitNum}.${num}`, `Subunit ${unitNum}.${num}`),
          ],
        };
      })
    );
    onEdit?.();
  }

  function updateSubunitTitle(unitId: string, subunitId: string, title: string) {
    onUpdate(
      units.map((u) =>
        u.id === unitId
          ? {
              ...u,
              subunits: u.subunits.map((s) =>
                s.id === subunitId ? { ...s, title } : s
              ),
            }
          : u
      )
    );
  }

  function removeSubunit(unitId: string, subunitId: string) {
    onUpdate(
      units
        .map((u) =>
          u.id === unitId
            ? {
                ...u,
                subunits: u.subunits.filter((s) => s.id !== subunitId),
                checkpoints: (u.checkpoints ?? []).filter(
                  (c) => c.afterSectionId !== subunitId
                ),
              }
            : u
        )
        .filter((u) => u.subunits.length > 0)
    );
    onEdit?.();
  }

  function addCheckpoint(unit: CurriculumUnit) {
    const checkpoint: Checkpoint = {
      id: uuidv4(),
      kind: "quiz",
      title: `Quiz ${(unit.checkpoints ?? []).length + 1}`,
      date: "",
      afterSectionId: unit.subunits.at(-1)?.id ?? null,
    };
    patchUnit(unit.id, { checkpoints: [...(unit.checkpoints ?? []), checkpoint] });
    onEdit?.();
  }

  function updateCheckpoint(
    unit: CurriculumUnit,
    checkpointId: string,
    patch: Partial<Checkpoint>
  ) {
    patchUnit(unit.id, {
      checkpoints: (unit.checkpoints ?? []).map((c) =>
        c.id === checkpointId ? { ...c, ...patch } : c
      ),
    });
  }

  function removeCheckpoint(unit: CurriculumUnit, checkpointId: string) {
    patchUnit(unit.id, {
      checkpoints: (unit.checkpoints ?? []).filter((c) => c.id !== checkpointId),
    });
    onEdit?.();
  }

  /** Shared between the phone card list and the table — one source of markup. */
  function renderUnitTitle(unit: CurriculumUnit) {
    return editing ? (
      <input
        type="text"
        value={unit.title}
        onChange={(e) => patchUnit(unit.id, { title: e.target.value })}
        onBlur={() => onEdit?.()}
        className="w-full font-semibold bg-transparent border-b border-primary/50 focus:outline-none"
      />
    ) : (
      <span className="font-semibold text-primary dark:text-primary-glow">
        {unit.title}
      </span>
    );
  }

  function renderSubunits(unit: CurriculumUnit) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {unit.subunits.map((subunit) =>
          editing ? (
            <div
              key={subunit.id}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
            >
              <span className="text-xs text-slate-400 font-mono shrink-0">
                {subunit.id}
              </span>
              <input
                type="text"
                value={subunit.title}
                onChange={(e) => updateSubunitTitle(unit.id, subunit.id, e.target.value)}
                onBlur={() => onEdit?.()}
                className="w-28 sm:w-36 bg-transparent border-b border-slate-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeSubunit(unit.id, subunit.id)}
                className="p-0.5 text-rose-400 hover:text-rose-600 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              key={subunit.id}
              href={subunitHref(subunit.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 group hover:border-primary/60 hover:text-primary dark:hover:text-primary-glow transition-colors"
            >
              <span className="font-mono text-xs text-slate-400">{subunit.id}</span>
              {subunit.title}
              {subunit.date && (
                <span className="text-[10px] text-slate-400">{subunit.date}</span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary" />
            </Link>
          )
        )}
        <button
          type="button"
          onClick={() => addSubunit(unit.id)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600"
          title="Add Subunit"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  function renderCheckpoints(unit: CurriculumUnit) {
    if (!editing) {
      if ((unit.checkpoints ?? []).length === 0) {
        return <span className="text-xs text-slate-400 italic">None</span>;
      }
      return (
        <div className="flex flex-wrap gap-1.5">
          {(unit.checkpoints ?? []).map((checkpoint) => (
            <span
              key={checkpoint.id}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs",
                CHECKPOINT_CHIP[checkpoint.kind]
              )}
              title={
                checkpoint.afterSectionId
                  ? `After ${checkpoint.afterSectionId}`
                  : "End of unit"
              }
            >
              {checkpoint.title}
              {checkpoint.date && (
                <span className="inline-flex items-center gap-0.5 opacity-75">
                  <CalendarDays className="w-3 h-3" />
                  {checkpoint.date}
                </span>
              )}
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {(unit.checkpoints ?? []).map((checkpoint) => (
          <div key={checkpoint.id} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={checkpoint.title}
                onChange={(e) =>
                  updateCheckpoint(unit, checkpoint.id, { title: e.target.value })
                }
                onBlur={() => onEdit?.()}
                placeholder="Quiz 3A"
                className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={() => removeCheckpoint(unit, checkpoint.id)}
                className="p-0.5 text-rose-400 hover:text-rose-600 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <Select
                size="sm"
                className="w-28 shrink-0"
                value={checkpoint.kind}
                options={CHECKPOINT_KINDS.map((kind) => ({
                  value: kind,
                  label: CHECKPOINT_KIND_LABELS[kind],
                }))}
                onChange={(next) => {
                  updateCheckpoint(unit, checkpoint.id, {
                    kind: next as CheckpointKind,
                  });
                  onEdit?.();
                }}
              />
              <input
                type="text"
                value={checkpoint.date ?? ""}
                onChange={(e) =>
                  updateCheckpoint(unit, checkpoint.id, { date: e.target.value })
                }
                onBlur={() => onEdit?.()}
                placeholder="10/12"
                className="w-20 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900"
              />
              <Select
                size="sm"
                className="flex-1 min-w-0"
                title="Sits after this subunit"
                value={checkpoint.afterSectionId ?? ""}
                options={[
                  { value: "", label: "End of unit" },
                  ...unit.subunits.map((sub) => ({
                    value: sub.id,
                    label: `After ${sub.id}`,
                  })),
                ]}
                onChange={(next) => {
                  updateCheckpoint(unit, checkpoint.id, {
                    afterSectionId: next || null,
                  });
                  onEdit?.();
                }}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => addCheckpoint(unit)}
          className="flex items-center gap-1 text-xs text-primary dark:text-primary-glow hover:underline"
        >
          <Plus className="w-3 h-3" />
          Add Checkpoint
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Curriculum
        </h2>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0",
            editing
              ? "border-primary bg-white dark:bg-slate-900 border border-primary/30 text-primary dark:text-primary-glow"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
          )}
        >
          <Pencil className="w-3 h-3" />
          {editing ? "Done Editing" : "Edit"}
        </button>
      </div>

      <div className="card overflow-hidden">
        {/* Phone: one card per unit. Three columns fighting over 375px is
            unreadable, so the same content stacks instead. */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {units.map((unit) => (
            <div key={unit.id} className="px-4 py-4 space-y-3">
              <div>{renderUnitTitle(unit)}</div>

              <div>
                <p className="eyebrow-muted mb-2">
                  Subunits
                </p>
                {renderSubunits(unit)}
              </div>

              <div>
                <p className="eyebrow-muted mb-2">
                  Checkpoints
                </p>
                {renderCheckpoints(unit)}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-semibold text-slate-500 w-32">
                  Unit
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500">
                  Subunits
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 w-64">
                  Checkpoints
                </th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr
                  key={unit.id}
                  className="border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                >
                  <td className="px-4 py-3 align-top border-r border-slate-100 dark:border-slate-800/50">
                    {renderUnitTitle(unit)}
                  </td>
                  <td className="px-4 py-3 align-top">{renderSubunits(unit)}</td>
                  <td className="px-4 py-3 align-top border-l border-slate-100 dark:border-slate-800/50">
                    {renderCheckpoints(unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-dashed border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={addUnit}
            className="flex items-center gap-1.5 text-sm text-primary dark:text-primary-glow hover:underline"
          >
            <Plus className="w-4 h-4" />
            Add Unit
          </button>
        </div>
      </div>
    </div>
  );
}
