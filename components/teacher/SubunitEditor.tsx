"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { AppNavbar } from "@/components/AppNavbar";
import { SectionView } from "@/components/student/SectionView";
import { SubunitTracksEditor } from "@/components/teacher/SubunitTracksEditor";
import { SubunitObjectivesEditor } from "@/components/teacher/SubunitObjectivesEditor";
import { SubunitScheduleEditor } from "@/components/teacher/SubunitScheduleEditor";
import {
  SubunitViewToggle,
  type SubunitViewMode,
} from "@/components/teacher/SubunitViewToggle";
import type { Section, SectionActivityStatus } from "@/lib/types";
import type { DbClass } from "@/lib/db/types";
import { getCurrentUser } from "@/lib/auth-client";
import { store } from "@/lib/store";
import { normalizeSection } from "@/lib/section-tracks";
import { useClassTheme } from "@/lib/use-class-theme";

const PREVIEW_PROGRESS: SectionActivityStatus = { tracks: {} };

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
  const [viewMode, setViewMode] = useState<SubunitViewMode>("edit");

  const loadData = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) {
      router.replace("/?auth=login");
      return;
    }
    // As on the class page: a class that cannot be loaded sends the teacher
    // back to the dashboard, not to an error screen.
    const data = await store.getClassDetail(classId, user.id).catch((err) => {
      console.warn("Could not open this class", err);
      return null;
    });
    if (!data) {
      router.replace("/dashboard");
      return;
    }
    if (data.role !== "teacher") {
      router.replace(`/dashboard/class/${classId}`);
      return;
    }
    setCls(data.class);
    const found = data.class.units
      .flatMap((u) => u.subunits)
      .find((s) => s.id === decodeURIComponent(subunitId));
    setSection(found ? normalizeSection(found) : null);
    setLoading(false);
  }, [classId, subunitId, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useClassTheme(cls?.color);

  const saveSection = useCallback(
    async (updated: Section) => {
      if (!cls) return;
      setSaving(true);
      const normalized = normalizeSection(updated);
      const units = cls.units.map((u) => ({
        ...u,
        subunits: u.subunits.map((s) => (s.id === normalized.id ? normalized : s)),
      }));
      const updatedClass = await store.updateClass(classId, { units });
      if (updatedClass) {
        setCls(updatedClass);
        const found = updatedClass.units
          .flatMap((u) => u.subunits)
          .find((s) => s.id === normalized.id);
        setSection(found ? normalizeSection(found) : normalized);
      }
      setSaving(false);
    },
    [cls, classId]
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
    <div className="min-h-screen flex flex-col">
      <AppNavbar
        left={
          <Link
            href={`/dashboard/class/${classId}`}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to class</span>
          </Link>
        }
        right={
          <>
            <ThemeToggle />
            <ProfileMenu />
          </>
        }
      />

      <main className="page-in max-w-3xl mx-auto w-full px-5 py-8 space-y-8">
        <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-primary uppercase tracking-widest">
              {section.id}
            </span>
            {viewMode === "edit" ? (
              <>
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => setSection({ ...section, title: e.target.value })}
                  onBlur={() => saveSection(section)}
                  className="block w-full text-2xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary focus:outline-none mt-1"
                />
                {saving && <p className="text-xs text-slate-400 mt-1">Saving…</p>}
              </>
            ) : (
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {section.title}
              </h1>
            )}
          </div>
          <div className="self-start shrink-0">
            <SubunitViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
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
            <SubunitScheduleEditor
              section={section}
              onChange={setSection}
              onSave={saveSection}
            />

            <SubunitObjectivesEditor
              section={section}
              onChange={setSection}
              onSave={saveSection}
            />

            <SubunitTracksEditor
              section={section}
              onChange={setSection}
              onSave={saveSection}
            />
          </>
        )}
      </main>
    </div>
  );
}
