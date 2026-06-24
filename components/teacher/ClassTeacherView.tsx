"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getTeacherSectionStatus,
} from "@/lib/class-progress";
import { TableProgressGate } from "./TableProgressGate";
import { CurriculumTable } from "./CurriculumTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { Logo } from "@/components/Logo";
import { Modal } from "@/components/Modal";
import type { DbClass, DbInvite } from "@/lib/db/types";
import type { Student, StudentProgress } from "@/lib/types";
import {
  ArrowLeft,
  LayoutGrid,
  CheckCircle2,
  HelpCircle,
  Clock,
  Lock,
  Search,
  Users,
  Eye,
  Loader2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

type OverallStatus = "complete" | "help" | "in-progress" | "not-started" | "review";
type StatModal = "students" | "help" | "progress" | "sections" | null;
type ReviewTarget = { studentId: string; sectionId: string } | null;

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

interface ClassTeacherViewProps {
  classId: string;
}

export function ClassTeacherView({ classId }: ClassTeacherViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState<DbClass | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [invites, setInvites] = useState<DbInvite[]>([]);
  const [classProgress, setClassProgress] = useState<StudentProgress[]>([]);
  const [className, setClassName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightStatus, setHighlightStatus] = useState<OverallStatus | null>(null);
  const [openModal, setOpenModal] = useState<StatModal>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget>(null);
  const [gradeNum, setGradeNum] = useState(10);
  const [gradeDenom, setGradeDenom] = useState(10);
  const [inviteInput, setInviteInput] = useState("");
  const [inviting, setInviting] = useState(false);
  const [blockSectionId, setBlockSectionId] = useState<string | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const sectionColumnRefs = useRef<(HTMLTableCellElement | null)[]>([]);

  const sections = cls?.units.flatMap((u) => u.subunits) ?? [];
  const sectionIds = sections.map((s) => s.id);

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/classes/${classId}`);
    if (!res.ok) {
      router.replace("/dashboard");
      return;
    }
    const data = await res.json();
    setCls(data.class);
    setClassName(data.class.name);
    setStudents(data.students);
    setInvites(data.invites);
    setBlockSectionId(data.class.blockSectionId);

    const progress: StudentProgress[] = (data.progress ?? []).map(
      (p: { studentId: string; sections: StudentProgress["sections"] }) => ({
        studentId: p.studentId,
        unitId: 1,
        sections: p.sections,
      })
    );
    setClassProgress(progress);
    setLoading(false);
  }, [classId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveProgress = useCallback(
    async (all: StudentProgress[]) => {
      await fetch(`/api/classes/${classId}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress: all.map((p) => ({
            classId,
            studentId: p.studentId,
            sections: p.sections,
          })),
        }),
      });
      setClassProgress(all);
    },
    [classId]
  );

  const saveClass = useCallback(
    async (patch: Partial<DbClass>) => {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.class) setCls(data.class);
    },
    [classId]
  );

  const handleNameSave = async () => {
    setEditingName(false);
    if (className.trim() && className !== cls?.name) {
      await saveClass({ name: className.trim() });
    }
  };

  const handleBlockChange = useCallback(
    async (sectionId: string) => {
      setBlockSectionId(sectionId);
      await saveClass({ blockSectionId: sectionId });
    },
    [saveClass]
  );

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrUsername: inviteInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students);
        setInvites(data.invites);
        setInviteInput("");
        await loadData();
      }
    } finally {
      setInviting(false);
    }
  };

  const handleApprove = useCallback(async () => {
    if (!reviewTarget) return;
    const all = [...classProgress];
    const idx = all.findIndex((p) => p.studentId === reviewTarget.studentId);
    if (idx < 0) return;

    const section = all[idx].sections[reviewTarget.sectionId];
    if (!section) return;

    all[idx] = {
      ...all[idx],
      sections: {
        ...all[idx].sections,
        [reviewTarget.sectionId]: {
          ...section,
          practiceApproved: true,
          gradeNumerator: gradeNum,
          gradeDenominator: gradeDenom,
        },
      },
    };

    await saveProgress(all);
    setReviewTarget(null);
  }, [reviewTarget, classProgress, gradeNum, gradeDenom, saveProgress]);

  useEffect(() => {
    if (reviewTarget) {
      const p = classProgress.find((x) => x.studentId === reviewTarget.studentId);
      const sec = p?.sections[reviewTarget.sectionId];
      setGradeNum(sec?.gradeNumerator ?? 10);
      setGradeDenom(sec?.gradeDenominator ?? 10);
    }
  }, [reviewTarget, classProgress]);

  if (loading || !cls) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const classStats = sections.map((section) => {
    const statuses = classProgress.map((p) =>
      getTeacherSectionStatus(p, section.id, sectionIds)
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

  const totalStudents = students.length;
  const effectiveBlockId =
    blockSectionId ?? (sectionIds.length > 0 ? sectionIds[sectionIds.length - 1] : null);
  const blockIndex = effectiveBlockId ? sectionIds.indexOf(effectiveBlockId) : -1;
  const gateActive =
    blockSectionId !== null &&
    blockIndex >= 0 &&
    blockIndex < sections.length - 1;

  const reviewStudent = reviewTarget
    ? students.find((s) => s.id === reviewTarget.studentId)
    : null;
  const reviewSection = reviewTarget
    ? sections.find((s) => s.id === reviewTarget.sectionId)
    : null;
  const reviewProgress = reviewTarget
    ? classProgress.find((p) => p.studentId === reviewTarget.studentId)
    : null;
  const reviewProofUrl = reviewTarget
    ? reviewProgress?.sections[reviewTarget.sectionId]?.practiceProofUrl
    : undefined;

  const studentProgressList = classProgress.map((p) => {
    const student = students.find((s) => s.id === p.studentId)!;
    const completedCount = sections.filter(
      (s) => getTeacherSectionStatus(p, s.id, sectionIds) === "complete"
    ).length;
    const pct = sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0;
    return { student, completedCount, pct };
  });

  const avgProgress =
    studentProgressList.length > 0 && sections.length > 0
      ? studentProgressList.reduce((acc, { pct }) => acc + pct / 100, 0) /
        studentProgressList.length
      : 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0a0a0e]">
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-5 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-sm shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
          <Logo size={24} showText={false} />
        </div>

        <div className="flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-600 font-medium">
            Class code
          </span>
          <span className="text-xl font-mono font-bold tracking-[0.2em] text-slate-900 dark:text-slate-100">
            {cls.code}
          </span>
        </div>

        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full px-5 py-6 space-y-6">
        <div>
          {editingName ? (
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
              className="text-2xl font-bold bg-transparent border-b-2 border-violet-500 focus:outline-none text-slate-900 dark:text-slate-100 w-full max-w-md"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight hover:text-violet-600 dark:hover:text-violet-400 transition-colors text-left"
              title="Click to edit class name"
            >
              {cls.name}
            </button>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Teacher view · {sections.length} subunit{sections.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Students" value={totalStudents} sub="enrolled" icon={<Users className="w-4 h-4 text-blue-500" />} color="blue" onClick={() => setOpenModal("students")} />
          <StatCard label="Avg Progress" value={`${Math.round(avgProgress * 100)}%`} sub="complete" icon={<CheckCircle2 className="w-4 h-4 text-green-500" />} color="green" onClick={() => setOpenModal("progress")} />
          <StatCard label="Sections" value={sections.length} sub="subunits" icon={<LayoutGrid className="w-4 h-4 text-violet-500" />} color="violet" onClick={() => setOpenModal("sections")} />
        </div>

        {sections.length > 0 && (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 font-medium mr-1">Filter:</span>
                {(Object.keys(STATUS_CONFIG) as OverallStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setHighlightStatus(highlightStatus === s ? null : s)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
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
                  className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-48"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div ref={tableScrollRef} className="relative overflow-x-auto">
                {effectiveBlockId && sections.length > 0 && (
                  <TableProgressGate
                    blockSectionId={effectiveBlockId}
                    onChange={handleBlockChange}
                    containerRef={tableScrollRef}
                    columnRefs={sectionColumnRefs}
                    sectionIds={sectionIds}
                  />
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left px-4 py-3 font-semibold text-slate-500 w-36 sticky left-0 z-10 bg-white dark:bg-slate-900">
                        Student
                      </th>
                      {sections.map((section, sIdx) => (
                        <th
                          key={section.id}
                          ref={(el) => { sectionColumnRefs.current[sIdx] = el; }}
                          className="text-center px-2 py-3 font-semibold text-slate-500 min-w-[7.5rem]"
                        >
                          <div>{section.id}</div>
                          <div className="text-[10px] font-normal text-slate-400 mt-0.5 leading-snug">
                            {section.title}
                          </div>
                        </th>
                      ))}
                      <th className="text-center px-3 py-3 font-semibold text-slate-500 min-w-[80px]">
                        Overall
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, idx) => {
                      const studentProgress = classProgress.find((p) => p.studentId === student.id);
                      const completedCount = sections.filter(
                        (s) => studentProgress && getTeacherSectionStatus(studentProgress, s.id, sectionIds) === "complete"
                      ).length;
                      const pct = sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0;

                      return (
                        <tr key={student.id} className={cn("border-b border-slate-100 dark:border-slate-800/50", idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50")}>
                          <td className={cn("px-4 py-3 sticky left-0 z-10", idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50")}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-bold text-violet-700">
                                {student.avatar}
                              </div>
                              <span className="font-medium text-sm">{student.name}</span>
                            </div>
                          </td>
                          {sections.map((section, sIdx) => {
                            const status = studentProgress
                              ? getTeacherSectionStatus(studentProgress, section.id, sectionIds)
                              : ("not-started" as const);
                            const cfg = STATUS_CONFIG[status];
                            const isReview = status === "review";
                            const beyondGate = gateActive && sIdx > blockIndex;

                            return (
                              <td key={section.id} className={cn("text-center px-2 py-3", beyondGate && "bg-red-50/40 dark:bg-red-950/20")}>
                                {isReview ? (
                                  <button
                                    type="button"
                                    onClick={() => setReviewTarget({ studentId: student.id, sectionId: section.id })}
                                    className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium cursor-pointer hover:opacity-80", cfg.classes)}
                                  >
                                    {cfg.icon}
                                    {cfg.label}
                                  </button>
                                ) : (
                                  <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium", cfg.classes)}>
                                    {cfg.icon}
                                    {cfg.label}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center px-3 py-3">
                            <span className="text-xs font-semibold">{pct}%</span>
                          </td>
                        </tr>
                      );
                    })}

                    <tr className="bg-slate-50 dark:bg-slate-800/30 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
                      <td colSpan={sections.length + 2} className="px-4 py-3">
                        <form onSubmit={handleInvite} className="flex items-center gap-3">
                          <UserPlus className="w-4 h-4 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            value={inviteInput}
                            onChange={(e) => setInviteInput(e.target.value)}
                            placeholder="Invite student by email or username…"
                            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                          />
                          <button
                            type="submit"
                            disabled={inviting || !inviteInput.trim()}
                            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium disabled:opacity-50"
                          >
                            {inviting ? "Inviting…" : "Invite"}
                          </button>
                        </form>
                        {invites.length > 0 && (
                          <p className="text-xs text-slate-400 mt-2 ml-7">
                            Pending: {invites.map((i) => i.emailOrUsername).join(", ")}
                          </p>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-600">
              Drag the{" "}
              <span className="text-red-500 dark:text-red-400">red line</span> to set how far
              students can progress
              {gateActive ? (
                <>
                  {" "}
                  — currently open through{" "}
                  <span className="text-slate-500">{blockSectionId}</span>
                </>
              ) : (
                " (fully open)"
              )}
              .
            </p>
          </>
        )}

        <CurriculumTable
          classId={classId}
          units={cls.units}
          onUpdate={(units) => saveClass({ units })}
        />

        {sections.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Section Breakdown
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {classStats.map((stat) => (
                <div key={stat.sectionId} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <div className="mb-3">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {stat.sectionId}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {stat.sectionTitle}
                    </p>
                  </div>
                  <MiniBar label="Done" count={stat.complete} total={totalStudents} color="bg-green-500" />
                  <MiniBar label="Review" count={stat.review} total={totalStudents} color="bg-yellow-400" />
                  <MiniBar label="Active" count={stat.inProgress} total={totalStudents} color="bg-blue-500" />
                  <MiniBar label="Help!" count={stat.help} total={totalStudents} color="bg-red-500" />
                  <MiniBar label="Not started" count={stat.notStarted} total={totalStudents} color="bg-slate-200 dark:bg-slate-700" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal open={reviewTarget !== null} onClose={() => setReviewTarget(null)} title="Review Submission" className="max-w-xl">
        {reviewStudent && reviewSection && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700">
                {reviewStudent.avatar}
              </div>
              <div>
                <p className="font-semibold">{reviewStudent.name}</p>
                <p className="text-sm text-slate-500">
                  {reviewSection.id} · {reviewSection.title}
                </p>
              </div>
            </div>

            {reviewProofUrl ? (
              <img src={reviewProofUrl} alt="Submission" className="w-full max-h-80 rounded-xl border object-contain bg-slate-50 dark:bg-slate-800" />
            ) : (
              <p className="text-sm text-slate-500">No screenshot attached.</p>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Grade</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={gradeNum}
                  onChange={(e) => setGradeNum(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 rounded-lg border text-sm text-center"
                />
                <span className="text-slate-400">/</span>
                <input
                  type="number"
                  min={1}
                  value={gradeDenom}
                  onChange={(e) => setGradeDenom(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 rounded-lg border text-sm text-center"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={handleApprove} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Submit grade & complete
              </button>
              <button type="button" onClick={() => setReviewTarget(null)} className="px-4 py-2 rounded-lg border text-sm">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={openModal === "students"} onClose={() => setOpenModal(null)} title="Enrolled Students">
        {students.length === 0 ? (
          <p className="text-sm text-slate-500">No students yet. Invite them below the progress table.</p>
        ) : (
          <ul className="space-y-2">
            {students.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-700">{s.avatar}</div>
                <span className="font-medium">{s.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal open={openModal === "progress"} onClose={() => setOpenModal(null)} title="Student Progress">
        <ul className="space-y-2">
          {studentProgressList.sort((a, b) => b.pct - a.pct).map(({ student, pct }) => (
            <li key={student.id} className="flex items-center justify-between px-3 py-2 rounded-lg border">
              <span>{student.name}</span>
              <span className="font-semibold">{pct}%</span>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={openModal === "sections"} onClose={() => setOpenModal(null)} title="Subunits">
        <ul className="space-y-2">
          {sections.map((s) => (
            <li key={s.id} className="px-3 py-2 rounded-lg border">
              <span className="font-bold text-violet-600">{s.id}</span> {s.title}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, sub, icon, color, onClick }: {
  label: string; value: string | number; sub: string; icon: React.ReactNode;
  color: "blue" | "red" | "green" | "violet"; onClick: () => void;
}) {
  const bg = { blue: "bg-blue-50 dark:bg-blue-950", red: "bg-red-50 dark:bg-red-950", green: "bg-green-50 dark:bg-green-950", violet: "bg-violet-50 dark:bg-violet-950" }[color];
  return (
    <button type="button" onClick={onClick} className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-left hover:border-blue-300 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", bg)}>{icon}</div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </button>
  );
}

function MiniBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[10px] text-slate-400 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-medium w-4 text-right">{count}</span>
    </div>
  );
}
