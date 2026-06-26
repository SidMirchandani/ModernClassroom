"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DEMO_UNITS,
  DEMO_CLASS_NAME,
  DEMO_CLASS_CODE,
  DEMO_DEFAULT_UNIT_INDEX,
  getDemoProgressForUnit,
  STUDENTS,
} from "@/lib/data";
import {
  countClassHelpRequests,
  getTeacherSectionStatus,
  type TeacherSectionStatus,
} from "@/lib/class-progress";
import { getUnitPhase } from "@/lib/unit-phase";
import { UnitPhaseBadge } from "./UnitPhaseBadge";
import {
  approvePracticeSubmission,
  loadClassProgress,
  resolveHelpRequest,
  sendBackPracticeSubmission,
} from "@/lib/progress-store";
import {
  getProgressBlockSectionId,
  setProgressBlockSectionId,
  PROGRESS_BLOCK_CHANGE_EVENT,
} from "@/lib/progress-block-store";
import { TableProgressGate } from "./TableProgressGate";
import { CurriculumTable } from "./CurriculumTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { NavCapsule } from "@/components/NavCapsule";
import { AppNavbar } from "@/components/AppNavbar";
import { UserAvatar } from "@/components/UserAvatar";
import { getInitialsFromName } from "@/lib/avatar";
import { Modal } from "@/components/Modal";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  CheckCircle2,
  HelpCircle,
  Clock,
  Lock,
  Search,
  Users,
  Eye,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadDemoCurriculum,
  getDefaultDemoCurriculum,
} from "@/lib/demo-curriculum-store";
import type { CurriculumUnit } from "@/lib/db/types";
import { useDemoNotice } from "@/components/demo/DemoProvider";

import type { StudentProgress } from "@/lib/types";

type OverallStatus = "complete" | "help" | "in-progress" | "not-started" | "review";
type StatModal = "students" | "help" | "progress" | "sections" | null;
type TeacherView = "classroom" | "curriculum";
type ReviewTarget = { studentId: string; sectionId: string } | null;
type HelpTarget = { studentId: string; sectionId: string } | null;

const STATUS_CONFIG: Record<OverallStatus, { label: string; classes: string; icon: React.ReactNode }> = {
  complete: {
    label: "Done",
    classes:
      "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  review: {
    label: "Review",
    classes:
      "bg-yellow-50 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800",
    icon: <Eye className="w-3 h-3" />,
  },
  help: {
    label: "Help!",
    classes:
      "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800",
    icon: <HelpCircle className="w-3 h-3" />,
  },
  "in-progress": {
    label: "Active",
    classes:
      "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800",
    icon: <Clock className="w-3 h-3" />,
  },
  "not-started": {
    label: "—",
    classes:
      "bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800",
    icon: <Lock className="w-3 h-3" />,
  },
};

function getHelpDetails(classProgress: StudentProgress[], sections: typeof DEMO_UNITS[0]["sections"]) {
  return classProgress.flatMap((p) => {
    const student = STUDENTS.find((s) => s.id === p.studentId)!;
    const items = sections.flatMap((section) => {
      const sp = p.sections[section.id];
      if (!sp) return [];
      const entries: { sectionId: string; sectionTitle: string; activity: string }[] = [];
      if (sp.learn === "help")
        entries.push({ sectionId: section.id, sectionTitle: section.title, activity: "Learn" });
      if (sp.practice === "help")
        entries.push({ sectionId: section.id, sectionTitle: section.title, activity: "Practice" });
      if (sp.extra === "help")
        entries.push({ sectionId: section.id, sectionTitle: section.title, activity: "Extra" });
      return entries;
    });
    if (items.length === 0) return [];
    return [{ student, items }];
  });
}

export function TeacherDashboard() {
  const notifyDemo = useDemoNotice();
  const [activeUnitIndex, setActiveUnitIndex] = useState(DEMO_DEFAULT_UNIT_INDEX);
  const activeUnit = DEMO_UNITS[activeUnitIndex];
  const [classProgress, setClassProgress] = useState<StudentProgress[]>([]);
  const [search, setSearch] = useState("");
  const [highlightStatus, setHighlightStatus] = useState<OverallStatus | null>(null);
  const [openModal, setOpenModal] = useState<StatModal>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget>(null);
  const [helpTarget, setHelpTarget] = useState<HelpTarget>(null);
  const [blockSectionId, setBlockSectionId] = useState("3.4");
  const [curriculumUnits, setCurriculumUnits] = useState<CurriculumUnit[]>(
    getDefaultDemoCurriculum
  );
  const [activeView, setActiveView] = useState<TeacherView>("classroom");
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const sectionColumnRefs = useRef<(HTMLTableCellElement | null)[]>([]);

  const unitPhase = getUnitPhase(activeUnitIndex, DEMO_DEFAULT_UNIT_INDEX);
  const isActiveUnit = unitPhase === "active";
  const blockIndex = isActiveUnit
    ? activeUnit.sections.findIndex((s) => s.id === blockSectionId)
    : -1;
  const gateActive =
    isActiveUnit && blockIndex >= 0 && blockIndex < activeUnit.sections.length - 1;
  const sectionIds = activeUnit.sections.map((s) => s.id);

  function loadProgressForUnit(unitId: number): StudentProgress[] {
    if (unitId === 3) return loadClassProgress();
    return getDemoProgressForUnit(unitId);
  }

  function getCellStatus(
    studentProgress: StudentProgress | undefined,
    sectionId: string,
    sIdx: number
  ): TeacherSectionStatus {
    if (unitPhase === "finished") return "complete";
    if (unitPhase === "upcoming") return "not-started";
    if (gateActive && sIdx > blockIndex) return "not-started";
    if (!studentProgress) return "not-started";
    return getTeacherSectionStatus(studentProgress, sectionId, sectionIds);
  }

  useEffect(() => {
    setClassProgress(loadProgressForUnit(activeUnit.id));
    if (isActiveUnit) setBlockSectionId(getProgressBlockSectionId());
    setCurriculumUnits(loadDemoCurriculum());
  }, [activeUnitIndex, activeUnit.id, isActiveUnit]);

  useEffect(() => {
    if (!isActiveUnit) return;
    const refresh = () => {
      setClassProgress(loadClassProgress());
      setBlockSectionId(getProgressBlockSectionId());
      setCurriculumUnits(loadDemoCurriculum());
    };
    window.addEventListener("focus", refresh);
    window.addEventListener(PROGRESS_BLOCK_CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(PROGRESS_BLOCK_CHANGE_EVENT, refresh);
    };
  }, [isActiveUnit]);

  const handleApprove = useCallback(() => {
    if (!reviewTarget) return;
    const updated = approvePracticeSubmission(
      reviewTarget.studentId,
      reviewTarget.sectionId
    );
    setClassProgress(updated);
    setReviewTarget(null);
    notifyDemo();
  }, [reviewTarget, notifyDemo]);

  const handleSendBack = useCallback(() => {
    if (!reviewTarget) return;
    const updated = sendBackPracticeSubmission(
      reviewTarget.studentId,
      reviewTarget.sectionId
    );
    setClassProgress(updated);
    setReviewTarget(null);
    notifyDemo();
  }, [reviewTarget, notifyDemo]);

  const handleResolveHelp = useCallback(
    (resolution: "all-good" | "send-back") => {
      if (!helpTarget) return;
      const updated = resolveHelpRequest(
        helpTarget.studentId,
        helpTarget.sectionId,
        resolution
      );
      setClassProgress(updated);
      setHelpTarget(null);
      notifyDemo();
    },
    [helpTarget, notifyDemo]
  );

  const filteredStudents = STUDENTS.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const classStats = activeUnit.sections.map((section, sIdx) => {
    const statuses = classProgress.map((p) =>
      getCellStatus(p, section.id, sIdx)
    );
    return {
      sectionId: section.id,
      sectionTitle: section.title,
      complete: statuses.filter((s) => s === "complete").length,
      review: statuses.filter((s) => s === "review").length,
      help: statuses.filter((s) => s === "help").length,
      inProgress: statuses.filter((s) => s === "in-progress").length,
      notStarted: statuses.filter((s) => s === "not-started").length,
    };
  });

  const totalStudents = STUDENTS.length;
  const helpDetails = getHelpDetails(classProgress, activeUnit.sections);
  const studentsNeedingHelp = helpDetails.length;

  const studentProgressList = classProgress.map((p) => {
    const student = STUDENTS.find((s) => s.id === p.studentId)!;
    const completedCount = activeUnit.sections.filter(
      (s, sIdx) => getCellStatus(p, s.id, sIdx) === "complete"
    ).length;
    const pct = Math.round((completedCount / activeUnit.sections.length) * 100);
    return { student, completedCount, pct };
  });

  const avgProgress =
    studentProgressList.length > 0
      ? studentProgressList.reduce((acc, { pct }) => acc + pct / 100, 0) /
        studentProgressList.length
      : 0;

  const reviewStudent = reviewTarget
    ? STUDENTS.find((s) => s.id === reviewTarget.studentId)
    : null;
  const reviewSection = reviewTarget
    ? activeUnit.sections.find((s) => s.id === reviewTarget.sectionId)
    : null;
  const reviewProgress = reviewTarget
    ? classProgress.find((p) => p.studentId === reviewTarget.studentId)
    : null;
  const reviewProofUrl = reviewTarget
    ? reviewProgress?.sections[reviewTarget.sectionId]?.practiceProofUrl
    : undefined;

  const helpStudent = helpTarget
    ? STUDENTS.find((s) => s.id === helpTarget.studentId)
    : null;
  const helpSection = helpTarget
    ? activeUnit.sections.find((s) => s.id === helpTarget.sectionId)
    : null;
  const helpProgress = helpTarget
    ? classProgress.find((p) => p.studentId === helpTarget.studentId)
    : null;
  const helpSectionProgress = helpTarget
    ? helpProgress?.sections[helpTarget.sectionId]
    : undefined;
  const helpActivities = helpSectionProgress
    ? (
        [
          helpSectionProgress.learn === "help" ? "Learn" : null,
          helpSectionProgress.practice === "help" ? "Practice" : null,
          helpSectionProgress.extra === "help" ? "Extra Material" : null,
        ] as const
      ).filter(Boolean)
    : [];

  const handleBlockChange = useCallback((sectionId: string) => {
    setProgressBlockSectionId(sectionId);
    setBlockSectionId(sectionId);
    notifyDemo();
  }, [notifyDemo]);

  const pendingHelpCount = countClassHelpRequests(
    curriculumUnits,
    classProgress,
    isActiveUnit ? blockSectionId : null
  );

  if (classProgress.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0e]">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0a0a0e]">
      <AppNavbar
        sticky
        left={
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-sm shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
            <Logo size={24} showText={false} />
            <span className="font-mono text-sm font-bold tracking-[0.15em] text-slate-700 dark:text-slate-300 tabular-nums">
              {DEMO_CLASS_CODE}
            </span>
          </div>
        }
        center={
          <NavCapsule
            tabs={[
              {
                id: "classroom",
                label: "Classroom",
                onClick: () => setActiveView("classroom"),
                notify: pendingHelpCount > 0,
              },
              {
                id: "curriculum",
                label: "Curriculum",
                onClick: () => setActiveView("curriculum"),
              },
            ]}
            activeId={activeView}
          />
        }
        right={<ThemeToggle />}
      />

      <div className="max-w-7xl mx-auto w-full px-5 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {DEMO_CLASS_NAME}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() => setActiveUnitIndex((i) => Math.max(0, i - 1))}
              disabled={activeUnitIndex === 0}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous unit"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm text-slate-500 dark:text-slate-400 min-w-0 text-center flex items-center justify-center gap-2 flex-wrap">
              <span>
                Unit {activeUnit.id} · {activeUnit.title}
              </span>
              <UnitPhaseBadge phase={unitPhase} />
            </p>
            <button
              type="button"
              onClick={() =>
                setActiveUnitIndex((i) => Math.min(DEMO_UNITS.length - 1, i + 1))
              }
              disabled={activeUnitIndex === DEMO_UNITS.length - 1}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next unit"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {activeView === "classroom" && (
          <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Students"
            value={totalStudents}
            sub="enrolled"
            icon={<Users className="w-4 h-4 text-blue-500" />}
            color="blue"
            onClick={() => setOpenModal("students")}
          />
          <StatCard
            label="Need Help"
            value={studentsNeedingHelp}
            sub="students"
            icon={<HelpCircle className="w-4 h-4 text-red-500" />}
            color="red"
            onClick={() => setOpenModal("help")}
          />
          <StatCard
            label="Avg Progress"
            value={`${Math.round(avgProgress * 100)}%`}
            sub="sections complete"
            icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
            color="green"
            onClick={() => setOpenModal("progress")}
          />
          <StatCard
            label="Sections"
            value={activeUnit.sections.length}
            sub="this unit"
            icon={<LayoutGrid className="w-4 h-4 text-violet-500" />}
            color="violet"
            onClick={() => setOpenModal("sections")}
          />
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 dark:text-slate-600 font-medium mr-1">
              Filter:
            </span>
            {(Object.keys(STATUS_CONFIG) as OverallStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setHighlightStatus(highlightStatus === s ? null : s)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity border",
                  STATUS_CONFIG[s].classes,
                  highlightStatus && highlightStatus !== s ? "opacity-40" : "opacity-100"
                )}
              >
                {STATUS_CONFIG[s].icon}
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-400 dark:focus:border-blue-600 w-48"
            />
          </div>
        </div>

        <div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden isolate">
          <div ref={tableScrollRef} className="relative overflow-x-auto">
            {isActiveUnit && (
              <TableProgressGate
                blockSectionId={blockSectionId}
                onChange={handleBlockChange}
                containerRef={tableScrollRef}
                columnRefs={sectionColumnRefs}
                sectionIds={sectionIds}
              />
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 w-36 sticky left-0 z-10 bg-white dark:bg-slate-900">
                    Student
                  </th>
                  {activeUnit.sections.map((section, sIdx) => (
                    <th
                      key={section.id}
                      ref={(el) => {
                        sectionColumnRefs.current[sIdx] = el;
                      }}
                      className="text-center px-2 py-3 font-semibold text-slate-500 dark:text-slate-400 min-w-[7.5rem]"
                    >
                      <div>{section.id}</div>
                      <div className="text-[10px] font-normal text-slate-400 dark:text-slate-600 mt-0.5 leading-snug">
                        {section.title}
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400 min-w-[80px]">
                    Overall
                  </th>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <td className="px-4 py-2 text-xs font-semibold text-slate-400 dark:text-slate-600 sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50">
                    Class avg
                  </td>
                  {classStats.map((stat) => (
                    <td key={stat.sectionId} className="text-center px-2 py-2">
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                          {stat.complete}
                        </span>
                        <span className="text-[10px] text-slate-300 dark:text-slate-700">/</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-600">
                          {totalStudents}
                        </span>
                      </div>
                    </td>
                  ))}
                  <td />
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, idx) => {
                  const studentProgress = classProgress.find(
                    (p) => p.studentId === student.id
                  );
                  const completedCount = activeUnit.sections.filter(
                    (s, sIdx) =>
                      studentProgress &&
                      getCellStatus(studentProgress, s.id, sIdx) === "complete"
                  ).length;
                  const pct = Math.round(
                    (completedCount / activeUnit.sections.length) * 100
                  );

                  return (
                    <tr
                      key={student.id}
                      className={cn(
                        "border-b border-slate-100 dark:border-slate-800/50 last:border-0 transition-colors",
                        idx % 2 === 0
                          ? "bg-white dark:bg-slate-900"
                          : "bg-slate-50/50 dark:bg-slate-900/50"
                      )}
                    >
                      <td
                        className={cn(
                          "px-4 py-3 sticky left-0 z-10",
                          idx % 2 === 0
                            ? "bg-white dark:bg-slate-900"
                            : "bg-slate-50/50 dark:bg-slate-900/50"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <UserAvatar initials={getInitialsFromName(student.name)} size="sm" />
                          <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                            {student.name}
                          </span>
                        </div>
                      </td>

                      {activeUnit.sections.map((section, sIdx) => {
                        const status = getCellStatus(studentProgress, section.id, sIdx);
                        const dimmed =
                          highlightStatus !== null && status !== highlightStatus;
                        const cfg = STATUS_CONFIG[status];
                        const isReview = status === "review";
                        const isHelp = status === "help";
                        const beyondGate = gateActive && sIdx > blockIndex;

                        return (
                          <td
                            key={section.id}
                            className={cn(
                              "text-center px-2 py-3",
                              beyondGate && "bg-red-50/40 dark:bg-red-950/20"
                            )}
                          >
                            {isReview ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewTarget({
                                    studentId: student.id,
                                    sectionId: section.id,
                                  })
                                }
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-opacity cursor-pointer hover:opacity-80",
                                  cfg.classes,
                                  dimmed && "opacity-20"
                                )}
                              >
                                {cfg.icon}
                                {cfg.label}
                              </button>
                            ) : isHelp ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setHelpTarget({
                                    studentId: student.id,
                                    sectionId: section.id,
                                  })
                                }
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-opacity cursor-pointer hover:opacity-80",
                                  cfg.classes,
                                  dimmed && "opacity-20"
                                )}
                              >
                                {cfg.icon}
                                {cfg.label}
                              </button>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-opacity",
                                  cfg.classes,
                                  dimmed && "opacity-20"
                                )}
                              >
                                {cfg.icon}
                                {cfg.label}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      <td className="text-center px-3 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {pct}%
                          </span>
                          <div className="w-12 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredStudents.length === 0 && (
                  <tr>
                    <td
                      colSpan={activeUnit.sections.length + 2}
                      className="text-center py-10 text-slate-400 dark:text-slate-600"
                    >
                      No students found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {isActiveUnit && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-600">
          Drag the{" "}
          <span className="text-red-500 dark:text-red-400">red line</span> to set how far
          students can progress
          {gateActive ? (
            <>
              {" "}
              — currently open through{" "}
              <span className="text-slate-500 dark:text-slate-500">{blockSectionId}</span>
            </>
          ) : (
            " (fully open)"
          )}
          .
        </p>
        )}
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Section Breakdown
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {classStats.map((stat) => {
              return (
                <div
                  key={stat.sectionId}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <div className="mb-3">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {stat.sectionId}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {stat.sectionTitle}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <MiniBar
                      label="Done"
                      count={stat.complete}
                      total={totalStudents}
                      color="bg-green-500"
                    />
                    <MiniBar
                      label="Review"
                      count={stat.review}
                      total={totalStudents}
                      color="bg-yellow-400"
                    />
                    <MiniBar
                      label="Active"
                      count={stat.inProgress}
                      total={totalStudents}
                      color="bg-blue-500"
                    />
                    <MiniBar
                      label="Help!"
                      count={stat.help}
                      total={totalStudents}
                      color="bg-red-500"
                    />
                    <MiniBar
                      label="Not started"
                      count={stat.notStarted}
                      total={totalStudents}
                      color="bg-slate-200 dark:bg-slate-700"
                      textColor="text-slate-400 dark:text-slate-600"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
          </>
        )}

        {activeView === "curriculum" && (
          <CurriculumTable
            classId="demo"
            units={curriculumUnits}
            onUpdate={(units) => {
              setCurriculumUnits(units);
            }}
            onEdit={notifyDemo}
            getSubunitHref={(id) =>
              `/demo/teacher/subunit/${encodeURIComponent(id)}`
            }
          />
        )}
      </div>

      {/* Stat detail modals */}
      <Modal
        open={openModal === "students"}
        onClose={() => setOpenModal(null)}
        title="Enrolled Students"
      >
        <ul className="space-y-2">
          {STUDENTS.map((student) => (
            <li
              key={student.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800"
            >
              <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-sm font-bold text-violet-700 dark:text-violet-300">
                {student.avatar}
              </div>
              <span className="font-medium text-slate-800 dark:text-slate-200">{student.name}</span>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={openModal === "help"}
        onClose={() => setOpenModal(null)}
        title="Students Needing Help"
      >
        {helpDetails.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No students have requested help.
          </p>
        ) : (
          <ul className="space-y-3">
            {helpDetails.map(({ student, items }) => (
              <li
                key={student.id}
                className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 p-3"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-300">
                    {student.avatar}
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {student.name}
                  </span>
                </div>
                <ul className="space-y-1 ml-9">
                  {items.map((item, i) => (
                    <li key={i} className="text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {item.sectionId}
                      </span>
                      {" · "}
                      {item.activity}
                      <span className="text-slate-400 dark:text-slate-600">
                        {" "}
                        — {item.sectionTitle}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={openModal === "progress"}
        onClose={() => setOpenModal(null)}
        title="Student Progress"
      >
        <ul className="space-y-2">
          {studentProgressList
            .sort((a, b) => b.pct - a.pct)
            .map(({ student, completedCount, pct }) => (
              <li
                key={student.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800"
              >
                <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-sm font-bold text-violet-700 dark:text-violet-300 shrink-0">
                  {student.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {student.name}
                    </span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {pct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-600 shrink-0">
                      {completedCount}/{activeUnit.sections.length} sections
                    </span>
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </Modal>

      <Modal
        open={openModal === "sections"}
        onClose={() => setOpenModal(null)}
        title="Unit Sections"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Unit {activeUnit.id}: {activeUnit.title}
          </p>
          <ul className="space-y-2">
            {activeUnit.sections.map((section) => (
              <li
                key={section.id}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800"
              >
                <span className="text-sm font-bold text-violet-600 dark:text-violet-400 shrink-0">
                  {section.id}
                </span>
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    {section.title}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">
                    {section.objectives.length} learning objectives
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600 mb-2">
              Assessments
            </p>
            <ul className="space-y-1.5">
              {activeUnit.quizzes.map((quiz) => (
                <li key={quiz.id} className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-medium">{quiz.title}</span>
                  <span className="text-slate-400 dark:text-slate-600"> · {quiz.dueDate}</span>
                </li>
              ))}
              <li className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Unit Test</span>
                <span className="text-slate-400 dark:text-slate-600"> · {activeUnit.testDate}</span>
              </li>
            </ul>
          </div>
        </div>
      </Modal>

      <Modal
        open={reviewTarget !== null}
        onClose={() => setReviewTarget(null)}
        title="Review Submission"
        className="max-w-xl"
      >
        {reviewStudent && reviewSection && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-sm font-bold text-violet-700 dark:text-violet-300">
                {reviewStudent.avatar}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {reviewStudent.name}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Section {reviewSection.id} · {reviewSection.title}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600 mb-2">
                Practice Screenshot
              </p>
              {reviewProofUrl ? (
                <img
                  src={reviewProofUrl}
                  alt={`${reviewStudent.name} practice submission for ${reviewSection.id}`}
                  className="w-full max-h-80 rounded-xl border border-slate-200 dark:border-slate-700 object-contain bg-slate-50 dark:bg-slate-800"
                />
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No screenshot attached.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleApprove}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Complete
              </button>
              <button
                type="button"
                onClick={handleSendBack}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Send Back to Review
              </button>
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={helpTarget !== null}
        onClose={() => setHelpTarget(null)}
        title="Resolve Help Request"
        className="max-w-xl"
      >
        {helpStudent && helpSection && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-sm font-bold text-red-700 dark:text-red-300">
                {helpStudent.avatar}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {helpStudent.name}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Section {helpSection.id} · {helpSection.title}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600 mb-2">
                Help requested on
              </p>
              <ul className="space-y-1">
                {helpActivities.map((activity) => (
                  <li
                    key={activity}
                    className="text-sm text-red-600 dark:text-red-400 font-medium"
                  >
                    {activity}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              Choose how to respond. &ldquo;All good&rdquo; lets the student continue and mark
              activities done. &ldquo;Send back to review&rdquo; notifies them to revise and
              resubmit.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleResolveHelp("all-good")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                All Good
              </button>
              <button
                type="button"
                onClick={() => handleResolveHelp("send-back")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Send Back to Review
              </button>
              <button
                type="button"
                onClick={() => setHelpTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
  onClick,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  color: "blue" | "red" | "green" | "violet";
  onClick: () => void;
}) {
  const bg = {
    blue: "bg-blue-50 dark:bg-blue-950",
    red: "bg-red-50 dark:bg-red-950",
    green: "bg-green-50 dark:bg-green-950",
    violet: "bg-violet-50 dark:bg-violet-950",
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", bg)}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">{sub}</div>
    </button>
  );
}

function MiniBar({
  label,
  count,
  total,
  color,
  textColor = "text-slate-600 dark:text-slate-400",
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  textColor?: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 dark:text-slate-600 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-[10px] font-medium w-4 text-right shrink-0", textColor)}>
        {count}
      </span>
    </div>
  );
}
