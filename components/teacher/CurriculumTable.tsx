"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { CurriculumUnit } from "@/lib/db/types";
import { emptySection } from "@/lib/curriculum";
import { cn } from "@/lib/utils";

interface CurriculumTableProps {
  classId: string;
  units: CurriculumUnit[];
  onUpdate: (units: CurriculumUnit[]) => void;
  getSubunitHref?: (subunitId: string) => string;
}

export function CurriculumTable({
  classId,
  units,
  onUpdate,
  getSubunitHref,
}: CurriculumTableProps) {
  const [editing, setEditing] = useState(false);

  function subunitHref(subunitId: string) {
    return (
      getSubunitHref?.(subunitId) ??
      `/dashboard/class/${classId}/subunit/${encodeURIComponent(subunitId)}`
    );
  }

  function addUnit() {
    const unitNum = units.length + 1;
    onUpdate([
      ...units,
      {
        id: uuidv4(),
        title: `Unit ${unitNum}`,
        subunits: [emptySection(`${unitNum}.1`, `Subunit ${unitNum}.1`)],
      },
    ]);
  }

  function updateUnitTitle(unitId: string, title: string) {
    onUpdate(units.map((u) => (u.id === unitId ? { ...u, title } : u)));
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
      units.map((u) =>
        u.id === unitId
          ? { ...u, subunits: u.subunits.filter((s) => s.id !== subunitId) }
          : u
      ).filter((u) => u.subunits.length > 0)
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Curriculum
        </h2>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            editing
              ? "border-violet-500 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
          )}
        >
          <Pencil className="w-3 h-3" />
          {editing ? "Done editing" : "Edit"}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left px-4 py-3 font-semibold text-slate-500 w-32">Unit</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-500">Subunit</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {units.map((unit) =>
              unit.subunits.map((subunit, sIdx) => (
                <tr
                  key={`${unit.id}-${subunit.id}`}
                  className="border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                >
                  {sIdx === 0 && (
                    <td
                      rowSpan={unit.subunits.length}
                      className="px-4 py-3 align-top border-r border-slate-100 dark:border-slate-800/50"
                    >
                      {editing ? (
                        <input
                          type="text"
                          value={unit.title}
                          onChange={(e) => updateUnitTitle(unit.id, e.target.value)}
                          className="w-full font-semibold bg-transparent border-b border-violet-300 focus:outline-none"
                        />
                      ) : (
                        <span className="font-semibold text-violet-600 dark:text-violet-400">
                          {unit.title}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">{subunit.id}</span>
                        <input
                          type="text"
                          value={subunit.title}
                          onChange={(e) =>
                            updateSubunitTitle(unit.id, subunit.id, e.target.value)
                          }
                          className="flex-1 bg-transparent border-b border-slate-300 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeSubunit(unit.id, subunit.id)}
                          className="p-1 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <Link
                        href={subunitHref(subunit.id)}
                        className="flex items-center justify-between group hover:text-violet-600 dark:hover:text-violet-400"
                      >
                        <span>
                          <span className="font-mono text-xs text-slate-400 mr-2">
                            {subunit.id}
                          </span>
                          {subunit.title}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500" />
                      </Link>
                    )}
                  </td>
                  <td className="px-2">
                    {editing && sIdx === unit.subunits.length - 1 && (
                      <button
                        type="button"
                        onClick={() => addSubunit(unit.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950"
                        title="Add subunit"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {editing && (
          <div className="px-4 py-3 border-t border-dashed border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={addUnit}
              className="flex items-center gap-1.5 text-sm text-violet-600 dark:text-violet-400 hover:underline"
            >
              <Plus className="w-4 h-4" />
              Add unit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
