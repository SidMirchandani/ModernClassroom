"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Section } from "@/lib/types";
import {
  findDemoSubunit,
  loadDemoCurriculum,
  saveDemoCurriculum,
  updateDemoSubunit,
} from "@/lib/demo-curriculum-store";

type BlockType = "learn" | "practice" | "extra";

export function DemoSubunitEditor({ subunitId }: { subunitId: string }) {
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const units = loadDemoCurriculum();
    const found = findDemoSubunit(units, subunitId);
    setSection(
      found
        ? units
            .flatMap((u) => u.subunits)
            .find((s) => s.id === decodeURIComponent(subunitId)) ?? null
        : null
    );
    setLoading(false);
  }, [subunitId]);

  const saveSection = useCallback(
    (updated: Section) => {
      setSaving(true);
      const units = loadDemoCurriculum();
      const next = updateDemoSubunit(units, updated.id, updated);
      saveDemoCurriculum(next);
      setSection(updated);
      setSaving(false);
    },
    []
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
          href="/demo/teacher"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to demo
        </Link>
        <ThemeToggle />
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

        <BlockSection title="Learn" color="blue">
          {section.learnResources.map((r, i) => (
            <ResourceRow
              key={i}
              label={r.label}
              url={r.url}
              onChange={(label, url) => {
                const learnResources = [...section.learnResources];
                learnResources[i] = { label, url };
                const next = { ...section, learnResources };
                setSection(next);
              }}
              onBlur={() => saveSection(section)}
              onRemove={() => {
                saveSection({
                  ...section,
                  learnResources: section.learnResources.filter((_, j) => j !== i),
                });
              }}
            />
          ))}
          <AddBlockButton label="Learn" onClick={() => addBlock("learn")} color="blue" />
        </BlockSection>

        <BlockSection title="Practice" color="amber">
          <textarea
            value={section.practiceDescription}
            onChange={(e) => setSection({ ...section, practiceDescription: e.target.value })}
            onBlur={() => saveSection(section)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border text-sm mb-3"
          />
          <AddBlockButton label="Practice" onClick={() => addBlock("practice")} color="amber" />
        </BlockSection>

        <BlockSection title="Extra Material" color="violet">
          {section.extraMaterials.map((r, i) => (
            <ResourceRow
              key={i}
              label={r.label}
              url={r.url}
              onChange={(label, url) => {
                const extraMaterials = [...section.extraMaterials];
                extraMaterials[i] = { label, url };
                setSection({ ...section, extraMaterials });
              }}
              onBlur={() => saveSection(section)}
              onRemove={() => {
                saveSection({
                  ...section,
                  extraMaterials: section.extraMaterials.filter((_, j) => j !== i),
                });
              }}
            />
          ))}
          <AddBlockButton label="Extra Material" onClick={() => addBlock("extra")} color="violet" />
        </BlockSection>
      </main>
    </div>
  );
}

function BlockSection({
  title,
  color,
  children,
}: {
  title: string;
  color: "blue" | "amber" | "violet";
  children: React.ReactNode;
}) {
  const titleColor = {
    blue: "text-blue-600",
    amber: "text-amber-600",
    violet: "text-violet-600",
  }[color];
  return (
    <section className="rounded-xl border bg-white dark:bg-slate-900 p-5">
      <h2 className={`font-semibold mb-3 ${titleColor}`}>{title}</h2>
      {children}
    </section>
  );
}

function ResourceRow({
  label,
  url,
  onChange,
  onBlur,
  onRemove,
}: {
  label: string;
  url: string;
  onChange: (label: string, url: string) => void;
  onBlur: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-2 mb-2">
      <input
        type="text"
        value={label}
        onChange={(e) => onChange(e.target.value, url)}
        onBlur={onBlur}
        className="flex-1 px-2 py-1.5 rounded border text-sm"
        placeholder="Label"
      />
      <input
        type="url"
        value={url}
        onChange={(e) => onChange(label, e.target.value)}
        onBlur={onBlur}
        className="flex-[2] px-2 py-1.5 rounded border text-sm"
        placeholder="URL"
      />
      <button type="button" onClick={onRemove} className="p-1.5 text-red-400">
        <Trash2 className="w-4 h-4" />
      </button>
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
