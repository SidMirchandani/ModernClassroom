"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppNavbar } from "@/components/AppNavbar";
import { SectionView } from "@/components/student/SectionView";
import { SubunitContentEditor } from "@/components/teacher/SubunitContentEditor";
import { SubunitObjectivesEditor } from "@/components/teacher/SubunitObjectivesEditor";
import {
  SubunitViewToggle,
  type SubunitViewMode,
} from "@/components/teacher/SubunitViewToggle";
import type { Section, SectionActivityStatus } from "@/lib/types";
import { findDemoSubunit, loadDemoCurriculum } from "@/lib/demo-curriculum-store";
import { normalizeSection } from "@/lib/section-blocks";
import { useDemoNotice } from "@/components/demo/DemoProvider";

const PREVIEW_PROGRESS: SectionActivityStatus = {
  learn: "available",
  practice: "available",
  extra: "available",
};

export function DemoSubunitEditor({ subunitId }: { subunitId: string }) {
  const notifyDemo = useDemoNotice();
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section | null>(null);
  const [viewMode, setViewMode] = useState<SubunitViewMode>("edit");

  useEffect(() => {
    const units = loadDemoCurriculum();
    const found = findDemoSubunit(units, subunitId);
    const subunit = found
      ? units
          .flatMap((u) => u.subunits)
          .find((s) => s.id === decodeURIComponent(subunitId))
      : undefined;
    setSection(subunit ? normalizeSection(subunit) : null);
    setLoading(false);
  }, [subunitId]);

  const applySection = useCallback((updated: Section) => {
    setSection(normalizeSection(updated));
  }, []);

  const saveSection = useCallback(
    (updated: Section) => {
      applySection(updated);
      notifyDemo();
    },
    [applySection, notifyDemo]
  );

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
      <AppNavbar
        left={
          <Link
            href="/demo/teacher"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to demo</span>
          </Link>
        }
        right={<ThemeToggle />}
      />

      <main className="max-w-3xl mx-auto w-full px-5 py-8 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">
              {section.id}
            </span>
            {viewMode === "edit" ? (
              <input
                type="text"
                value={section.title}
                onChange={(e) => setSection({ ...section, title: e.target.value })}
                onBlur={() => notifyDemo()}
                className="block w-full text-2xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 focus:outline-none mt-1"
              />
            ) : (
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {section.title}
              </h1>
            )}
          </div>
          <SubunitViewToggle mode={viewMode} onChange={setViewMode} />
        </div>

        {viewMode === "student" ? (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400 -mt-4">
              Previewing as a student — all sections are shown unlocked. Progress controls are
              hidden.
            </p>
            <SectionView
              section={section}
              sectionProgress={PREVIEW_PROGRESS}
              sectionComplete={false}
              onUpdateActivity={() => {}}
              readOnly
            />
          </>
        ) : (
          <>
            <SubunitObjectivesEditor
              section={section}
              onChange={applySection}
              onSave={saveSection}
            />

            <SubunitContentEditor
              section={section}
              onChange={applySection}
              onSave={saveSection}
            />
          </>
        )}
      </main>
    </div>
  );
}
