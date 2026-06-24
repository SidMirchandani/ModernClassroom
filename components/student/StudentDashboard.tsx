"use client";

import { useState, useCallback, useEffect } from "react";
import { UNIT, STUDENTS } from "@/lib/data";
import type { StudentProgress } from "@/lib/types";
import {
  canAccessSection,
  isSectionComplete,
  normalizeProgress,
  resolveSectionProgress,
} from "@/lib/progress";
import { loadStudentProgress, upsertStudentProgress } from "@/lib/progress-store";
import {
  getProgressBlockSectionId,
  isBeyondProgressBlock,
  PROGRESS_BLOCK_CHANGE_EVENT,
} from "@/lib/progress-block-store";
import { DEMO_PROOF_PLACEHOLDER } from "@/lib/demo-proof";
import { SectionSidebar, SectionSidebarContent } from "./SectionSidebar";
import { SectionView } from "./SectionView";
import { BottomAlert } from "./BottomAlert";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, List, X } from "lucide-react";

const DEMO_STUDENT = STUDENTS[0];

function loadProgress(studentId: string): StudentProgress {
  return normalizeProgress(loadStudentProgress(studentId));
}

function firstAccessibleSection(progress: StudentProgress): string {
  const current = UNIT.sections.find(
    (s) => canAccessSection(progress, s.id) && !isSectionComplete(progress.sections[s.id])
  );
  if (current) return current.id;

  const lastAccessible = [...UNIT.sections]
    .reverse()
    .find((s) => canAccessSection(progress, s.id));
  return lastAccessible?.id ?? UNIT.sections[0].id;
}

export function StudentDashboard() {
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [activeSectionId, setActiveSectionId] = useState(UNIT.sections[0].id);
  const [studentDropdown, setStudentDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(DEMO_STUDENT);
  const [blockSectionId, setBlockSectionId] = useState(
    () => UNIT.sections[UNIT.sections.length - 1].id
  );
  const [teacherLockAlert, setTeacherLockAlert] = useState(false);

  const showTeacherLockAlert = useCallback(() => {
    setTeacherLockAlert(true);
  }, []);

  useEffect(() => {
    const loaded = loadProgress(DEMO_STUDENT.id);
    setProgress(loaded);
    setActiveSectionId(firstAccessibleSection(loaded));
    setBlockSectionId(getProgressBlockSectionId());
  }, []);

  useEffect(() => {
    const refreshBlock = () => setBlockSectionId(getProgressBlockSectionId());
    window.addEventListener("focus", refreshBlock);
    window.addEventListener(PROGRESS_BLOCK_CHANGE_EVENT, refreshBlock);
    return () => {
      window.removeEventListener("focus", refreshBlock);
      window.removeEventListener(PROGRESS_BLOCK_CHANGE_EVENT, refreshBlock);
    };
  }, []);

  useEffect(() => {
    if (!progress) return;
    if (!canAccessSection(progress, activeSectionId)) {
      setActiveSectionId(firstAccessibleSection(progress));
    }
  }, [progress, activeSectionId, blockSectionId]);

  useEffect(() => {
    if (!sidebarOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [sidebarOpen]);

  const handleStudentChange = useCallback((studentId: string) => {
    const student = STUDENTS.find((s) => s.id === studentId)!;
    const loaded = loadProgress(studentId);
    setSelectedStudent(student);
    setProgress(loaded);
    setActiveSectionId(firstAccessibleSection(loaded));
    setBlockSectionId(getProgressBlockSectionId());
    setStudentDropdown(false);
  }, []);

  const handleSectionSelect = useCallback(
    (sectionId: string) => {
      if (isBeyondProgressBlock(sectionId)) {
        showTeacherLockAlert();
        return;
      }
      if (progress && canAccessSection(progress, sectionId)) {
        setActiveSectionId(sectionId);
        setSidebarOpen(false);
      }
    },
    [progress, showTeacherLockAlert]
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
        const current = resolveSectionProgress(prev, sectionId);
        const updated: typeof current = { ...current, [activity]: status };

        if (proofUrl) updated.practiceProofUrl = proofUrl;

        if (activity === "practice" && status === "done") {
          updated.practiceApproved = false;
          if (!updated.practiceProofUrl) {
            updated.practiceProofUrl = proofUrl ?? DEMO_PROOF_PLACEHOLDER;
          }
        }

        // Done or help unlocks the next step
        if (activity === "learn" && (status === "done" || status === "help")) {
          if (updated.practice === "locked") updated.practice = "available";
        }
        if (activity === "practice" && (status === "done" || status === "help")) {
          if (updated.extra === "locked") updated.extra = "available";
        }

        const next = normalizeProgress({
          ...prev,
          sections: { ...prev.sections, [sectionId]: updated },
        });

        upsertStudentProgress(next);
        return next;
      });
    },
    []
  );

  const activeSection = UNIT.sections.find((s) => s.id === activeSectionId)!;

  if (!progress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0e]">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  const sectionProgress = resolveSectionProgress(progress, activeSectionId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0a0a0e]">
      {/* Sticky top: nav + unit banner */}
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-950">
        <header className="border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <Logo size={24} showText={false} />
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                Student View
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setStudentDropdown((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                  {selectedStudent.avatar}
                </div>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {selectedStudent.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {studentDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden z-50">
                  {STUDENTS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleStudentChange(s.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-left transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                        {s.avatar}
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">{s.name}</span>
                      {s.id === selectedStudent.id && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ThemeToggle />
          </div>
        </header>

      <div className="px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Unit {UNIT.id}
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {UNIT.title}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile: minimized section picker */}
      <div className="md:hidden sticky top-[97px] z-10 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
          aria-expanded={sidebarOpen}
          aria-haspopup="dialog"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
            <List className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600">
              Current section
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {activeSection.id} · {activeSection.title}
            </div>
          </div>
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      </div>

      {/* Mobile: sections modal (bottom sheet) */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 dark:bg-black/60"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sections menu"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sections-sheet-title"
            className="relative w-full max-h-[85vh] rounded-t-2xl border border-slate-200 dark:border-slate-700 border-b-0 bg-white dark:bg-slate-900 flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h2
                id="sections-sheet-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                Sections
              </h2>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto py-4">
              <SectionSidebarContent
                unit={UNIT}
                progress={progress}
                activeSectionId={activeSectionId}
                onSelect={handleSectionSelect}
                onTeacherBlocked={showTeacherLockAlert}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex w-full">
        <SectionSidebar
          unit={UNIT}
          progress={progress}
          activeSectionId={activeSectionId}
          onSelect={handleSectionSelect}
          onTeacherBlocked={showTeacherLockAlert}
          className="hidden md:block"
        />

        <main className="flex-1 min-w-0 flex justify-center px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="w-full max-w-3xl">
            {!canAccessSection(progress, activeSectionId) ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  {isBeyondProgressBlock(activeSectionId) ? (
                    <>
                      This section is locked by your teacher. Students can currently progress
                      through section{" "}
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {blockSectionId}
                      </span>{" "}
                      only.
                    </>
                  ) : (
                    <>
                      This section is locked. Complete all activities in the previous section
                      before moving forward.
                    </>
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
