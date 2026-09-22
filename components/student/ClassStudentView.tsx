"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type {
  Checkpoint,
  Section,
  StudentProgress,
  TrackStep,
} from "@/lib/types";
import { store } from "@/lib/store";
import type { DbClass } from "@/lib/db/types";
import {
  applyStepStatus,
  canAccessSection,
  isSectionComplete,
  normalizeProgress,
  resolveSectionProgress,
  isBeyondBlock,
} from "@/lib/class-progress";
import { DEMO_PROOF_PLACEHOLDER } from "@/lib/demo-proof";
import { referenceToday } from "@/lib/demo-seed";
import { useOverlayTransition } from "@/lib/use-overlay-transition";
import { shortUnitLabel } from "@/lib/curriculum";
import { classIcon, type AccentId } from "@/lib/class-appearance";
import { useClassTheme } from "@/lib/use-class-theme";
import { buildClassTodos } from "@/lib/todos";
import { TodoButton } from "@/components/TodoButton";
import { SectionSidebar, SectionSidebarContent } from "./SectionSidebar";
import { SectionView } from "./SectionView";
import { CourseOverview } from "./CourseOverview";
import { BottomAlert } from "./BottomAlert";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { Logo } from "@/components/Logo";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { AppNavbar } from "@/components/AppNavbar";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LayoutGrid,
  List,
  X,
  Loader2,
} from "lucide-react";

interface ClassStudentViewProps {
  classId: string;
  studentId: string;
  studentName: string;
  studentAvatar: string;
  /** The student's own colour — theirs, not the class's. */
  studentAccent?: AccentId;
}

function firstAccessibleSection(
  progress: StudentProgress,
  sections: Section[],
  blockSectionId: string | null,
): string {
  const current = sections.find(
    (section) =>
      canAccessSection(progress, section.id, sections, blockSectionId) &&
      !isSectionComplete(section, progress.sections[section.id]),
  );
  if (current) return current.id;

  const lastAccessible = [...sections]
    .reverse()
    .find((section) =>
      canAccessSection(progress, section.id, sections, blockSectionId),
    );
  return lastAccessible?.id ?? sections[0]?.id ?? "";
}

export function ClassStudentView({
  classId,
  studentId,
  studentName,
  studentAvatar,
  studentAccent,
}: ClassStudentViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState<DbClass | null>(null);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [view, setView] = useState<"overview" | "section">("overview");
  // The sidebar shows one unit at a time; the strip's arrows move between them.
  const [unitIndex, setUnitIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sheet = useOverlayTransition(sidebarOpen, 340);

  // Same page blur the centred popups use.
  useEffect(() => {
    if (!sheet.shown) return;
    document.body.classList.add("overlay-open");
    return () => document.body.classList.remove("overlay-open");
  }, [sheet.shown]);
  const [blockSectionId, setBlockSectionId] = useState<string | null>(null);
  const [teacherLockAlert, setTeacherLockAlert] = useState(false);

  const units = useMemo(() => cls?.units ?? [], [cls]);
  const sections: Section[] = useMemo(
    () => units.flatMap((u) => u.subunits),
    [units],
  );
  const checkpoints: Checkpoint[] = useMemo(
    () => units.flatMap((u) => u.checkpoints ?? []),
    [units],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
    // Ask for the student role explicitly: a teacher enrolled in their own
    // class would otherwise get the teacher payload, which strips their own
    // progress row.
    const data = await store.getClassDetail(classId, studentId, "student");
    if (!alive) return;
    if (!data) {
      router.replace("/dashboard");
      return;
    }
    setCls(data.class);
    setBlockSectionId(data.class.blockSectionId);

    const myProgress = data.progress.find((p) => p.studentId === studentId);
    const allSections = data.class.units.flatMap((u) => u.subunits);
    const initial: StudentProgress = {
      studentId,
      unitId: 1,
      sections: myProgress?.sections ?? {},
      checkpoints: myProgress?.checkpoints,
    };
    const normalized = normalizeProgress(
      initial,
      allSections,
      data.class.blockSectionId,
    );
    setProgress(normalized);
    const startSection = firstAccessibleSection(
      normalized,
      allSections,
      data.class.blockSectionId,
    );
    setActiveSectionId(startSection);
    setUnitIndex(
      Math.max(
        0,
        data.class.units.findIndex((u) =>
          u.subunits.some((s) => s.id === startSection),
        ),
      ),
    );
    setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [classId, studentId, router]);

  const saveProgress = useCallback(
    (updated: StudentProgress) => {
      // The whole row is replaced, so the teacher's checkpoint grades have to
      // ride along or marking a step done would wipe them.
      void store.saveStudentProgress({
        classId,
        studentId,
        sections: updated.sections,
        checkpoints: updated.checkpoints,
      });
    },
    [classId, studentId],
  );

  const handleSectionSelect = useCallback(
    (sectionId: string) => {
      if (isBeyondBlock(sections, sectionId, blockSectionId)) {
        setTeacherLockAlert(true);
        return;
      }
      if (
        progress &&
        canAccessSection(progress, sectionId, sections, blockSectionId)
      ) {
        setActiveSectionId(sectionId);
        setView("section");
        setSidebarOpen(false);
        const owner = units.findIndex((u) =>
          u.subunits.some((s) => s.id === sectionId),
        );
        if (owner >= 0) setUnitIndex(owner);
      }
    },
    [progress, sections, blockSectionId, units],
  );

  const updateActivity = useCallback(
    (
      sectionId: string,
      trackId: string,
      step: TrackStep,
      status: "done" | "help",
      proofUrl?: string,
    ) => {
      setProgress((prev) => {
        if (!prev) return prev;
        const current = resolveSectionProgress(
          prev,
          sectionId,
          sections,
          blockSectionId,
        );
        const updated = applyStepStatus(
          current,
          trackId,
          step,
          status,
          step === "practice" && status === "done"
            ? (proofUrl ??
                current.tracks[trackId]?.practiceProofUrl ??
                DEMO_PROOF_PLACEHOLDER)
            : proofUrl,
        );
        const next = normalizeProgress(
          { ...prev, sections: { ...prev.sections, [sectionId]: updated } },
          sections,
          blockSectionId,
        );
        saveProgress(next);
        return next;
      });
    },
    [sections, blockSectionId, saveProgress],
  );

  useClassTheme(cls?.color);

  if (loading || !progress || !cls) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // The teacher's Customize choices, which reach the student only here. The
  // colour is not read as a class name — `useClassTheme` re-points `primary`.
  const ClassGlyph = classIcon(cls.icon, "student");

  const activeSection = sections.find((s) => s.id === activeSectionId);
  if (sections.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">
          No curriculum yet. Check back when your teacher adds subunits.
        </p>
      </div>
    );
  }

  const sectionProgress = activeSection
    ? resolveSectionProgress(
        progress,
        activeSectionId,
        sections,
        blockSectionId,
      )
    : { tracks: {} };
  const sectionAccessible = activeSection
    ? canAccessSection(progress, activeSectionId, sections, blockSectionId)
    : false;

  const openOverview = () => {
    setView("overview");
    setSidebarOpen(false);
  };

  const sidebarProps = {
    units: cls.units,
    unitIndex,
    progress,
    activeSectionId: view === "section" ? activeSectionId : "",
    onSelect: handleSectionSelect,
    onTeacherBlocked: () => setTeacherLockAlert(true),
    blockSectionId,
  };

  const todos = buildClassTodos(
    {
      classId,
      className: cls.name,
      units: cls.units,
      progress,
      blockSectionId,
    },
    referenceToday(),
  );

  const unitLabel = shortUnitLabel(
    cls.units[unitIndex]?.title ?? "",
    unitIndex,
  );
  const unitNav = (
    <div className="flex items-center rounded-lg bg-white/10 shrink-0">
      <button
        type="button"
        onClick={() => setUnitIndex((i) => Math.max(0, i - 1))}
        disabled={unitIndex === 0}
        aria-label="Previous unit"
        className="h-8 w-7 flex items-center justify-center rounded-l-lg text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="px-1.5 text-xs font-semibold text-white whitespace-nowrap tabular-nums">
        {unitLabel}
      </span>
      <button
        type="button"
        onClick={() =>
          setUnitIndex((i) => Math.min(cls.units.length - 1, i + 1))
        }
        disabled={unitIndex >= cls.units.length - 1}
        aria-label="Next unit"
        className="h-8 w-7 flex items-center justify-center rounded-r-lg text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0b0f16]">
      <div className="sticky top-0 z-20">
        <AppNavbar
          left={
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/dashboard?tab=enrolled"
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">
                |
              </span>
              <Logo size={24} showText={false} />
            </div>
          }
          right={
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
                <UserAvatar initials={studentAvatar} size="xs" accent={studentAccent} />
                <span className="font-medium hidden sm:inline">
                  {studentName}
                </span>
              </div>
              <ThemeToggle />
              <ProfileMenu />
            </>
          }
        />
        {/* The class strip: which room you are in, and the two controls that
            move you around it — the dashboard and the unit you are reading. */}
        <div
          data-tour="class-strip"
          className="h-11 px-4 sm:px-6 bg-primary/[0.85] dark:bg-primary-900/[0.85] backdrop-blur-md flex items-center gap-2 sm:gap-3"
        >
          <ClassGlyph className="w-4 h-4 text-white shrink-0" />
          <span className="text-sm font-semibold text-white truncate">
            {cls.name}
          </span>

          <div className="hidden md:flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={openOverview}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors shrink-0",
                // Light mode's strip is bright enough that a white pill reads
                // as selected; on the dark navy strip the same white shouts,
                // so the active state is a lift of the strip itself.
                view === "overview"
                  ? "bg-white text-primary dark:bg-white/[0.14] dark:text-white dark:ring-1 dark:ring-white/25"
                  : "text-white/90 hover:text-white bg-white/10 hover:bg-white/20",
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Class Dashboard
            </button>
            {cls.units.length > 0 && unitNav}
          </div>

          <div className="flex-1" />
          <span data-tour="todo-button" className="inline-flex">
          <TodoButton
            items={todos}
            onPrimary
            onOpenItem={(item) =>
              item.sectionId && handleSectionSelect(item.sectionId)
            }
          />
          </span>
        </div>

        {/* Mobile: minimized section picker — inside the sticky block so it
            stacks against the banner instead of guessing an offset. */}
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 float-pane px-4 py-2.5">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            aria-expanded={sidebarOpen}
            aria-haspopup="dialog"
          >
            <List className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" />
            <div className="flex-1 min-w-0">
              <div className="eyebrow-muted">
                {view === "overview" ? "Viewing" : "Current Section"}
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {view === "overview"
                  ? "Class Dashboard"
                  : activeSection
                    ? `${activeSection.id} · ${activeSection.title}`
                    : "—"}
              </div>
            </div>
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* Portalled out of the app tree: the page blur is applied to the app
          root, so a sheet rendered inside it would blur itself. */}
      {sheet.mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            {/* Blurred, never darkened — the same treatment every popup gets. */}
            <button
              type="button"
              aria-label="Close sections"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "absolute inset-0 overlay-backdrop",
                sheet.shown && "is-shown",
              )}
            />
            <div
              className={cn(
                "relative w-full max-h-[85vh] rounded-t-2xl border float-pane-raised flex flex-col",
                "overlay-sheet",
                sheet.shown && "is-shown",
              )}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b">
                <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setUnitIndex((i) => Math.max(0, i - 1))}
                    disabled={unitIndex === 0}
                    aria-label="Previous unit"
                    className="h-8 w-8 flex items-center justify-center text-slate-500 disabled:opacity-35"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-1 text-sm font-semibold whitespace-nowrap">
                    {unitLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setUnitIndex((i) => Math.min(cls.units.length - 1, i + 1))
                    }
                    disabled={unitIndex >= cls.units.length - 1}
                    aria-label="Next unit"
                    className="h-8 w-8 flex items-center justify-center text-slate-500 disabled:opacity-35"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto py-4 px-3">
                <SectionSidebarContent
                  {...sidebarProps}
                  onSelectOverview={openOverview}
                  overviewActive={view === "overview"}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      <div className="flex-1 flex w-full">
        <SectionSidebar {...sidebarProps} className="hidden md:block" />

        <main className="flex-1 min-w-0 flex justify-center px-4 sm:px-6 py-6">
          <div className="w-full max-w-3xl">
            {view === "overview" ? (
              <CourseOverview
                className={cls.name}
                units={cls.units}
                progress={progress}
                blockSectionId={blockSectionId}
                onOpenSection={handleSectionSelect}
              />
            ) : !activeSection ? (
              <div className="rounded-2xl border bg-white dark:bg-slate-900 p-8 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  Pick a section from the list to get started.
                </p>
              </div>
            ) : !sectionAccessible ? (
              <div className="rounded-2xl border bg-white dark:bg-slate-900 p-8 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  {isBeyondBlock(sections, activeSectionId, blockSectionId) ? (
                    <>
                      This section is locked by your teacher through section{" "}
                      <strong>{blockSectionId}</strong>.
                    </>
                  ) : (
                    <>Complete the previous section before moving forward.</>
                  )}
                </p>
              </div>
            ) : (
              <SectionView
                section={activeSection}
                sectionProgress={sectionProgress}
                sectionComplete={isSectionComplete(
                  activeSection,
                  sectionProgress,
                )}
                accessible={sectionAccessible}
                checkpoints={checkpoints.filter(
                  (c) => c.afterSectionId === activeSectionId,
                )}
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
