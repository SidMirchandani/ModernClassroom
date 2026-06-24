"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Unit, StudentProgress, Section } from "@/lib/types";
import type { DbClass } from "@/lib/db/types";
import {
  canAccessSection,
  isSectionComplete,
  normalizeProgress,
  resolveSectionProgress,
  isBeyondBlock,
} from "@/lib/class-progress";
import { DEMO_PROOF_PLACEHOLDER } from "@/lib/demo-proof";
import { SectionSidebar, SectionSidebarContent } from "./SectionSidebar";
import { SectionView } from "./SectionView";
import { BottomAlert } from "./BottomAlert";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { Logo } from "@/components/Logo";
import { ArrowLeft, ChevronUp, List, X, Loader2 } from "lucide-react";

interface ClassStudentViewProps {
  classId: string;
  studentId: string;
  studentName: string;
  studentAvatar: string;
}

function buildUnit(cls: DbClass): Unit {
  const sections: Section[] = cls.units.flatMap((u) => u.subunits);
  return {
    id: 1,
    title: cls.units.map((u) => u.title).join(" · ") || cls.name,
    sections,
    quizzes: [],
    testDate: "",
  };
}

function firstAccessibleSection(
  progress: StudentProgress,
  sectionIds: string[],
  blockSectionId: string | null
): string {
  const sections = sectionIds;
  const current = sections.find(
    (id) =>
      canAccessSection(progress, id, sectionIds, blockSectionId) &&
      !isSectionComplete(progress.sections[id])
  );
  if (current) return current;

  const lastAccessible = [...sections]
    .reverse()
    .find((id) => canAccessSection(progress, id, sectionIds, blockSectionId));
  return lastAccessible ?? sections[0] ?? "";
}

export function ClassStudentView({
  classId,
  studentId,
  studentName,
  studentAvatar,
}: ClassStudentViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState<DbClass | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [blockSectionId, setBlockSectionId] = useState<string | null>(null);
  const [teacherLockAlert, setTeacherLockAlert] = useState(false);

  const unit = cls ? buildUnit(cls) : null;
  const sectionIds = unit?.sections.map((s) => s.id) ?? [];

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/classes/${classId}`);
      if (!res.ok) {
        router.replace("/dashboard");
        return;
      }
      const data = await res.json();
      setCls(data.class);
      setBlockSectionId(data.class.blockSectionId);

      const myProgress = (data.progress ?? []).find(
        (p: { studentId: string }) => p.studentId === studentId
      );
      const ids = data.class.units.flatMap((u: { subunits: Section[] }) =>
        u.subunits.map((s: Section) => s.id)
      );
      const initial: StudentProgress = {
        studentId,
        unitId: 1,
        sections: myProgress?.sections ?? {},
      };
      const normalized = normalizeProgress(initial, ids, data.class.blockSectionId);
      setProgress(normalized);
      setActiveSectionId(firstAccessibleSection(normalized, ids, data.class.blockSectionId));
      setLoading(false);
    }
    load();
  }, [classId, studentId, router]);

  const saveProgress = useCallback(
    async (updated: StudentProgress) => {
      await fetch(`/api/classes/${classId}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress: {
            classId,
            studentId,
            sections: updated.sections,
          },
        }),
      });
    },
    [classId, studentId]
  );

  const handleSectionSelect = useCallback(
    (sectionId: string) => {
      if (isBeyondBlock(sectionIds, sectionId, blockSectionId)) {
        setTeacherLockAlert(true);
        return;
      }
      if (progress && canAccessSection(progress, sectionId, sectionIds, blockSectionId)) {
        setActiveSectionId(sectionId);
        setSidebarOpen(false);
      }
    },
    [progress, sectionIds, blockSectionId]
  );

  const updateActivity = useCallback(
    (
      sectionId: string,
      activity: "learn" | "practice" | "extra",
      status: "done" | "help",
      proofUrl?: string
    ) => {
      setProgress((prev) => {
        if (!prev) return prev;
        const current = resolveSectionProgress(
          prev,
          sectionId,
          sectionIds,
          blockSectionId
        );
        const updated = { ...current, [activity]: status };
        if (proofUrl) updated.practiceProofUrl = proofUrl;
        if (activity === "practice" && status === "done") {
          updated.practiceApproved = false;
          if (!updated.practiceProofUrl) {
            updated.practiceProofUrl = proofUrl ?? DEMO_PROOF_PLACEHOLDER;
          }
        }
        if (activity === "learn" && (status === "done" || status === "help")) {
          if (updated.practice === "locked") updated.practice = "available";
        }
        if (activity === "practice" && (status === "done" || status === "help")) {
          if (updated.extra === "locked") updated.extra = "available";
        }
        const next = normalizeProgress(
          { ...prev, sections: { ...prev.sections, [sectionId]: updated } },
          sectionIds,
          blockSectionId
        );
        saveProgress(next);
        return next;
      });
    },
    [sectionIds, blockSectionId, saveProgress]
  );

  if (loading || !progress || !unit || !cls) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const activeSection = unit.sections.find((s) => s.id === activeSectionId);
  if (!activeSection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">No curriculum yet. Check back when your teacher adds subunits.</p>
      </div>
    );
  }

  const sectionProgress = resolveSectionProgress(
    progress,
    activeSectionId,
    sectionIds,
    blockSectionId
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0a0a0e]">
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-950">
        <header className="border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <span className="text-slate-300">|</span>
            <Logo size={24} showText={false} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm">
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                {studentAvatar}
              </div>
              <span className="font-medium">{studentName}</span>
            </div>
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </header>
        <div className="px-4 sm:px-6 border-b py-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cls.name}</span>
        </div>
      </div>

      <div className="md:hidden sticky top-[97px] z-10 bg-white dark:bg-slate-950 border-b px-4 py-2.5">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900 text-left"
        >
          <List className="w-4 h-4 text-blue-600" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase text-slate-400">Current section</div>
            <div className="text-sm font-semibold truncate">
              {activeSection.id} · {activeSection.title}
            </div>
          </div>
          <ChevronUp className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button type="button" className="absolute inset-0 bg-slate-900/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-full max-h-[85vh] rounded-t-2xl border bg-white dark:bg-slate-900 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Sections</h2>
              <button type="button" onClick={() => setSidebarOpen(false)} className="w-8 h-8 rounded-lg border flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto py-4">
              <SectionSidebarContent
                unit={unit}
                progress={progress}
                activeSectionId={activeSectionId}
                onSelect={handleSectionSelect}
                onTeacherBlocked={() => setTeacherLockAlert(true)}
                sectionIds={sectionIds}
                blockSectionId={blockSectionId}
                hideAssessments
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex w-full">
        <SectionSidebar
          unit={unit}
          progress={progress}
          activeSectionId={activeSectionId}
          onSelect={handleSectionSelect}
          onTeacherBlocked={() => setTeacherLockAlert(true)}
          sectionIds={sectionIds}
          blockSectionId={blockSectionId}
          hideAssessments
          className="hidden md:block"
        />

        <main className="flex-1 min-w-0 flex justify-center px-4 sm:px-6 py-6">
          <div className="w-full max-w-3xl">
            {!canAccessSection(progress, activeSectionId, sectionIds, blockSectionId) ? (
              <div className="rounded-2xl border bg-white dark:bg-slate-900 p-8 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  {isBeyondBlock(sectionIds, activeSectionId, blockSectionId) ? (
                    <>This section is locked by your teacher through section <strong>{blockSectionId}</strong>.</>
                  ) : (
                    <>Complete the previous section before moving forward.</>
                  )}
                </p>
              </div>
            ) : (
              <SectionView
                section={activeSection}
                sectionProgress={sectionProgress}
                sectionComplete={isSectionComplete(sectionProgress)}
                onUpdateActivity={updateActivity}
              />
            )}
          </div>
        </main>
      </div>

      <BottomAlert
        visible={teacherLockAlert}
        message="This section is locked by your teacher."
        onDismiss={() => setTeacherLockAlert(false)}
      />
    </div>
  );
}
