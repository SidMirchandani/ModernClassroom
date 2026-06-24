"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import type { Section } from "@/lib/types";
import type { DbClass } from "@/lib/db/types";

type BlockType = "learn" | "practice" | "extra";

interface SubunitEditorProps {
  classId: string;
  subunitId: string;
}

export function SubunitEditor({ classId, subunitId }: SubunitEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState<DbClass | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/classes/${classId}`);
    if (!res.ok) {
      router.replace("/dashboard");
      return;
    }
    const data = await res.json();
    if (data.role !== "teacher") {
      router.replace(`/dashboard/class/${classId}`);
      return;
    }
    setCls(data.class);
    const found = data.class.units
      .flatMap((u: { subunits: Section[] }) => u.subunits)
      .find((s: Section) => s.id === decodeURIComponent(subunitId));
    setSection(found ?? null);
    setLoading(false);
  }, [classId, subunitId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveSection = useCallback(
    async (updated: Section) => {
      if (!cls) return;
      setSaving(true);
      const units = cls.units.map((u) => ({
        ...u,
        subunits: u.subunits.map((s) => (s.id === updated.id ? updated : s)),
      }));
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units }),
      });
      const data = await res.json();
      if (data.class) {
        setCls(data.class);
        const found = data.class.units
          .flatMap((u: { subunits: Section[] }) => u.subunits)
          .find((s: Section) => s.id === updated.id);
        setSection(found ?? updated);
      }
      setSaving(false);
    },
    [cls, classId]
  );

  function addBlock(type: BlockType) {
    if (!section) return;
    const updated = { ...section };
    if (type === "learn") {
      updated.learnResources = [
        ...updated.learnResources,
        { label: "New resource", url: "https://" },
      ];
    } else if (type === "practice") {
      if (!updated.practiceDescription) {
        updated.practiceDescription = "Complete the assigned practice and upload proof.";
      } else {
        updated.practiceDescription += "\n\nAdditional practice item.";
      }
    } else {
      updated.extraMaterials = [
        ...updated.extraMaterials,
        { label: "New material", url: "https://" },
      ];
    }
    saveSection(updated);
  }

  function updateObjective(idx: number, text: string) {
    if (!section) return;
    const objectives = [...section.objectives];
    objectives[idx] = { ...objectives[idx], text };
    saveSection({ ...section, objectives });
  }

  function addObjective() {
    if (!section) return;
    saveSection({
      ...section,
      objectives: [
        ...section.objectives,
        { id: `${section.id}.${section.objectives.length + 1}`, text: "New objective" },
      ],
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!section) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Subunit not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0a0a0e]">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-5 py-3 flex items-center justify-between">
        <Link
          href={`/dashboard/class/${classId}`}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to class
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-5 py-8 space-y-8">
        <div>
          <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">
            {section.id}
          </span>
          <input
            type="text"
            value={section.title}
            onChange={(e) => setSection({ ...section, title: e.target.value })}
            onBlur={() => saveSection(section)}
            className="block w-full text-2xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 focus:outline-none mt-1"
          />
          {saving && <p className="text-xs text-slate-400 mt-1">Saving…</p>}
        </div>

        <section>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Learning objectives
          </h2>
          <ul className="space-y-2">
            {section.objectives.map((obj, i) => (
              <li key={obj.id} className="flex items-start gap-2">
                <input
                  type="text"
                  value={obj.text}
                  onChange={(e) => updateObjective(i, e.target.value)}
                  onBlur={() => saveSection(section)}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm bg-white dark:bg-slate-900"
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addObjective}
            className="mt-2 text-sm text-violet-600 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add objective
          </button>
        </section>

        <section className="rounded-xl border bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-blue-600">Learn</h2>
          </div>
          {section.learnResources.length === 0 ? (
            <p className="text-sm text-slate-400 mb-3">No learn resources yet.</p>
          ) : (
            <ul className="space-y-2 mb-3">
              {section.learnResources.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={r.label}
                    onChange={(e) => {
                      const learnResources = [...section.learnResources];
                      learnResources[i] = { ...r, label: e.target.value };
                      setSection({ ...section, learnResources });
                    }}
                    onBlur={() => saveSection(section)}
                    className="flex-1 px-2 py-1.5 rounded border text-sm"
                    placeholder="Label"
                  />
                  <input
                    type="url"
                    value={r.url}
                    onChange={(e) => {
                      const learnResources = [...section.learnResources];
                      learnResources[i] = { ...r, url: e.target.value };
                      setSection({ ...section, learnResources });
                    }}
                    onBlur={() => saveSection(section)}
                    className="flex-[2] px-2 py-1.5 rounded border text-sm"
                    placeholder="URL"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const learnResources = section.learnResources.filter((_, j) => j !== i);
                      saveSection({ ...section, learnResources });
                    }}
                    className="p-1.5 text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <AddBlockButton label="Learn" onClick={() => addBlock("learn")} color="blue" />
        </section>

        <section className="rounded-xl border bg-white dark:bg-slate-900 p-5">
          <h2 className="font-semibold text-amber-600 mb-3">Practice</h2>
          <textarea
            value={section.practiceDescription}
            onChange={(e) => setSection({ ...section, practiceDescription: e.target.value })}
            onBlur={() => saveSection(section)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border text-sm mb-3"
            placeholder="Describe the practice assignment…"
          />
          <AddBlockButton label="Practice" onClick={() => addBlock("practice")} color="amber" />
        </section>

        <section className="rounded-xl border bg-white dark:bg-slate-900 p-5">
          <h2 className="font-semibold text-violet-600 mb-3">Extra Material</h2>
          {section.extraMaterials.length === 0 ? (
            <p className="text-sm text-slate-400 mb-3">No extra materials yet.</p>
          ) : (
            <ul className="space-y-2 mb-3">
              {section.extraMaterials.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={r.label}
                    onChange={(e) => {
                      const extraMaterials = [...section.extraMaterials];
                      extraMaterials[i] = { ...r, label: e.target.value };
                      setSection({ ...section, extraMaterials });
                    }}
                    onBlur={() => saveSection(section)}
                    className="flex-1 px-2 py-1.5 rounded border text-sm"
                  />
                  <input
                    type="url"
                    value={r.url}
                    onChange={(e) => {
                      const extraMaterials = [...section.extraMaterials];
                      extraMaterials[i] = { ...r, url: e.target.value };
                      setSection({ ...section, extraMaterials });
                    }}
                    onBlur={() => saveSection(section)}
                    className="flex-[2] px-2 py-1.5 rounded border text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const extraMaterials = section.extraMaterials.filter((_, j) => j !== i);
                      saveSection({ ...section, extraMaterials });
                    }}
                    className="p-1.5 text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <AddBlockButton label="Extra Material" onClick={() => addBlock("extra")} color="violet" />
        </section>
      </main>
    </div>
  );
}

function AddBlockButton({
  label,
  onClick,
  color,
}: {
  label: string;
  onClick: () => void;
  color: "blue" | "amber" | "violet";
}) {
  const colors = {
    blue: "border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400",
    amber: "border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400",
    violet: "border-violet-200 text-violet-600 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed text-sm font-medium transition-colors ${colors[color]}`}
    >
      <Plus className="w-4 h-4" />
      Add {label}
    </button>
  );
}
