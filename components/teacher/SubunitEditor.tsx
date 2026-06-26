"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { AppNavbar } from "@/components/AppNavbar";
import { SectionView } from "@/components/student/SectionView";
import { SubunitContentEditor } from "@/components/teacher/SubunitContentEditor";
import { SubunitObjectivesEditor } from "@/components/teacher/SubunitObjectivesEditor";
import {
  SubunitViewToggle,
  type SubunitViewMode,
} from "@/components/teacher/SubunitViewToggle";
import type { Section, SectionActivityStatus } from "@/lib/types";
import type { DbClass } from "@/lib/db/types";
import { getCurrentUser } from "@/lib/auth-client";
import { getClassDetail, updateClass } from "@/lib/db/client";
import { normalizeSection } from "@/lib/section-blocks";

const PREVIEW_PROGRESS: SectionActivityStatus = {
  learn: "available",
  practice: "available",
  extra: "available",
};

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

  const loadData = useCallback(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/?auth=login");
      return;
    }
    const data = getClassDetail(classId, user.id);
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
    loadData();
  }, [loadData]);

  const saveSection = useCallback(
    (updated: Section) => {
      if (!cls) return;
      setSaving(true);
      const normalized = normalizeSection(updated);
      const units = cls.units.map((u) => ({
        ...u,
        subunits: u.subunits.map((s) => (s.id === normalized.id ? normalized : s)),
      }));
      const updatedClass = updateClass(classId, { units });
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
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0a0a0e]">
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

      <main className="max-w-3xl mx-auto w-full px-5 py-8 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">
              {section.id}
            </span>
            {viewMode === "edit" ? (
              <>
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => setSection({ ...section, title: e.target.value })}
                  onBlur={() => saveSection(section)}
                  className="block w-full text-2xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 focus:outline-none mt-1"
                />
                {saving && <p className="text-xs text-slate-400 mt-1">Saving…</p>}
              </>
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
              onChange={setSection}
              onSave={saveSection}
            />

            <SubunitContentEditor
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
