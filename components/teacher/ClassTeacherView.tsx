"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  applyApproveTrack,
  applySendBackForTrack,
  countClassHelpRequests,
  getTeacherSectionStatus,
  getTrackProgress,
  resolveHelpForTrack,
  trackHasHelp,
  trackNeedsReview,
  type TeacherSectionStatus,
} from "@/lib/class-progress";
import { getActiveSteps, getVisibleTracks } from "@/lib/section-tracks";
import { classIcon } from "@/lib/class-appearance";
import { useClassTheme } from "@/lib/use-class-theme";
import { TrackStatusDots } from "@/components/TrackStatusDots";
import { CHECKPOINT_KIND_META } from "@/components/CheckpointRow";
import { Popover } from "@/components/Popover";
import { Tooltip } from "@/components/Tooltip";
import { checkpointMax, gradeToneClass } from "@/lib/grades";
import { trackAbbr, TRACK_KIND_COLORS } from "@/lib/section-tracks";
import { getCurrentUnitIndex, getUnitPhase, type UnitPhase } from "@/lib/unit-phase";
import { UnitPhaseBadge } from "./UnitPhaseBadge";
import { TableProgressGate } from "./TableProgressGate";
import { CurriculumPanel } from "./CurriculumPanel";
import { ClassCustomize } from "./ClassCustomize";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { Logo } from "@/components/Logo";
import { NavCapsule } from "@/components/NavCapsule";
import { UserAvatar } from "@/components/UserAvatar";
import { AppNavbar } from "@/components/AppNavbar";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getCurrentUser } from "@/lib/auth-client";
import { store, type SectionRemap } from "@/lib/store";
import { useClassSync } from "@/lib/use-class-sync";
import type { CurriculumUnit, DbClass, DbInvite } from "@/lib/db/types";
import type {
  Checkpoint,
  CheckpointKind,
  Section,
  Student,
  StudentProgress,
} from "@/lib/types";
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
  KeyRound,
  Users,
  Eye,
  Loader2,
  MoreHorizontal,
  UserPlus,
  UserMinus,
  RotateCcw,
} from "lucide-react";
import {
  STATUS_CHIP,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_LABEL_SHORT,
  type ProgressStatus,
} from "@/lib/status-styles";
import { cn } from "@/lib/utils";

type OverallStatus = "complete" | "help" | "in-progress" | "not-started" | "review";
type StatModal = "students" | "help" | "progress" | "sections" | null;
type TeacherView = "classroom" | "curriculum" | "customize";

function readView(value: string | null): TeacherView {
  return value === "curriculum" || value === "customize" ? value : "classroom";
}
type ReviewTarget = { studentId: string; sectionId: string; trackId: string } | null;
type HelpTarget = { studentId: string; sectionId: string; trackId: string } | null;

const STATUS_CONFIG: Record<OverallStatus, { label: string; classes: string; icon: React.ReactNode }> = {
  complete: {
    label: STATUS_LABEL_SHORT.complete,
    classes: STATUS_CHIP.complete,
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  review: {
    label: STATUS_LABEL_SHORT.review,
    classes: STATUS_CHIP.review,
    icon: <Eye className="w-3 h-3" />,
  },
  help: {
    label: STATUS_LABEL_SHORT.help,
    classes: STATUS_CHIP.help,
    icon: <HelpCircle className="w-3 h-3" />,
  },
  "in-progress": {
    label: STATUS_LABEL_SHORT["in-progress"],
    classes: STATUS_CHIP["in-progress"],
    icon: <Clock className="w-3 h-3" />,
  },
  "not-started": {
    label: STATUS_LABEL_SHORT["not-started"],
    classes: STATUS_CHIP["not-started"],
    icon: <Lock className="w-3 h-3" />,
  },
};

/**
 * Wide enough for a column title to wrap in **two lines at most**. Inter at
 * 10px semibold measures about 5.05px a character, so two lines hold half the
 * string — and a single long word still has to fit on one line whatever the
 * total. Clamped so one wordy subunit cannot push the grid off the screen.
 * (Measured, not guessed: this was 4.6 for Garamond and every column came out
 * a tenth too narrow when the face changed.)
 */
function titleColumnWidth(title: string): number {
  const CHAR = 5.05;
  const PADDING = 22;
  const longestWord = title
    .split(/\s+/)
    .reduce((widest, word) => Math.max(widest, word.length), 0);
  const needed = Math.max((title.length * CHAR) / 2, longestWord * CHAR) + PADDING;
  return Math.round(Math.min(224, Math.max(120, needed)));
}

/**
 * The grid runs subunit, subunit, subunit — with a checkpoint dropped in
 * wherever the unit says it falls. A checkpoint pinned to the top of the unit
 * (`afterSectionId: null`) leads; one whose anchor is not in this unit still
 * gets a column at the end rather than disappearing.
 */
type GridColumn =
  | { kind: "section"; section: Section; index: number }
  | { kind: "checkpoint"; checkpoint: Checkpoint };

function buildColumns(sections: Section[], checkpoints: Checkpoint[]): GridColumn[] {
  const ids = new Set(sections.map((s) => s.id));
  const columns: GridColumn[] = checkpoints
    .filter((c) => c.afterSectionId === null)
    .map((checkpoint) => ({ kind: "checkpoint" as const, checkpoint }));

  sections.forEach((section, index) => {
    columns.push({ kind: "section", section, index });
    checkpoints
      .filter((c) => c.afterSectionId === section.id)
      .forEach((checkpoint) => columns.push({ kind: "checkpoint", checkpoint }));
  });

  checkpoints
    .filter((c) => c.afterSectionId !== null && !ids.has(c.afterSectionId))
    .forEach((checkpoint) => columns.push({ kind: "checkpoint", checkpoint }));

  return columns;
}

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
  const [openModal, setOpenModal] = useState<StatModal>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget>(null);
  const [helpTarget, setHelpTarget] = useState<HelpTarget>(null);
  const [gradeNum, setGradeNum] = useState(10);
  const [gradeDenom, setGradeDenom] = useState(10);
  // Grading happens in the cells. Drafts hold what is being typed until it is
  // committed on blur, so a half-typed "1" of "18" never lands in the store.
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, string>>({});
  const [pointsDrafts, setPointsDrafts] = useState<Record<string, string>>({});
  const [inviteInput, setInviteInput] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [blockSectionId, setBlockSectionId] = useState<string | null>(null);
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  // The tab lives in the URL as well as in state, so a link can land on
  // Curriculum or Customize — which is how the guided tour walks the class.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [activeView, setActiveView] = useState<TeacherView>(() =>
    readView(searchParams.get("view"))
  );

  useEffect(() => {
    setActiveView(readView(searchParams.get("view")));
  }, [searchParams]);

  const selectView = useCallback(
    (view: TeacherView) => {
      setActiveView(view);
      router.replace(view === "classroom" ? pathname : `${pathname}?view=${view}`, {
        scroll: false,
      });
    },
    [router, pathname]
  );
  // Guards against a live re-read stealing the teacher's place on screen.
  const settled = useRef(false);
  const editingNameRef = useRef(false);
  editingNameRef.current = editingName;

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const sectionColumnRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const inviteRowRef = useRef<HTMLTableRowElement>(null);

  // Memoised: `handleSaveGrades` closes over it, and a fresh [] each render
  // would rebuild that callback every time.
  const units = useMemo(() => cls?.units ?? [], [cls]);
  const activeUnit = units[activeUnitIndex];
  const sections = activeUnit?.subunits ?? [];
  const sectionIds = sections.map((s) => s.id);
  const columns = buildColumns(sections, activeUnit?.checkpoints ?? []);
  const currentUnitIndex = getCurrentUnitIndex(units, blockSectionId);
  const unitPhase = getUnitPhase(activeUnitIndex, currentUnitIndex);
  const isActiveUnit = unitPhase === "active";
  const effectiveBlockId =
    isActiveUnit && blockSectionId
      ? blockSectionId
      : isActiveUnit && sectionIds.length > 0
        ? sectionIds[sectionIds.length - 1]
        : null;
  const blockIndex = effectiveBlockId ? sectionIds.indexOf(effectiveBlockId) : -1;
  const gateActive =
    isActiveUnit &&
    blockSectionId !== null &&
    blockIndex >= 0 &&
    blockIndex < sections.length - 1;

  function getCellStatus(
    studentProgress: StudentProgress | undefined,
    sectionId: string,
    sIdx: number
  ): TeacherSectionStatus {
    if (unitPhase === "finished") return "complete";
    if (unitPhase === "upcoming") return "not-started";
    if (gateActive && sIdx > blockIndex) return "not-started";
    if (!studentProgress) return "not-started";
    return getTeacherSectionStatus(studentProgress, sectionId, sections);
  }

  /**
   * Clicking a resource chip jumps straight to whatever that resource needs —
   * a submission to sign off, or a help request to clear.
   */
  function openTrackTarget(studentId: string, sectionId: string, trackId: string) {
    const section = sections.find((s) => s.id === sectionId);
    const track = section ? getVisibleTracks(section).find((t) => t.id === trackId) : null;
    if (!section || !track) return;

    const studentProgress = classProgress.find((p) => p.studentId === studentId);
    const trackProgress = getTrackProgress(studentProgress?.sections[sectionId], trackId);

    if (trackNeedsReview(track, trackProgress)) {
      setReviewTarget({ studentId, sectionId, trackId });
    } else if (trackHasHelp(track, trackProgress)) {
      setHelpTarget({ studentId, sectionId, trackId });
    }
  }

  const loadData = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) {
      router.replace("/?auth=login");
      return;
    }
    const data = await store.getClassDetail(classId, user.id);
    if (!data) {
      router.replace("/dashboard");
      return;
    }
    setCls(data.class);
    setStudents(data.students);
    setInvites(data.invites);
    setBlockSectionId(data.class.blockSectionId);

    // A re-read can arrive at any moment — a student marking a step is enough
    // to cause one. It must never move the teacher: not off the unit they are
    // looking at, and not out of the name they are halfway through typing.
    if (!settled.current) {
      setActiveUnitIndex(getCurrentUnitIndex(data.class.units, data.class.blockSectionId));
      settled.current = true;
    }
    if (!editingNameRef.current) setClassName(data.class.name);

    const progress: StudentProgress[] = (data.progress ?? []).map((p) => ({
      studentId: p.studentId,
      unitId: 1,
      sections: p.sections,
      checkpoints: p.checkpoints,
    }));
    setClassProgress(progress);
    setLoading(false);
  }, [classId, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // The student side of this class, arriving as it happens.
  useClassSync(classId, loadData);

  const saveProgress = useCallback(
    (all: StudentProgress[]) => {
      void store.saveAllClassProgress(
        classId,
        all.map((p) => ({
          classId,
          studentId: p.studentId,
          sections: p.sections,
          checkpoints: p.checkpoints,
        }))
      );
      setClassProgress(all);
    },
    [classId]
  );

  // The student a removal is being confirmed for, if any.
  const [pendingRemoval, setPendingRemoval] = useState<Student | null>(null);

  useClassTheme(cls?.color);

  const saveClass = useCallback(
    async (patch: Partial<DbClass>) => {
      const updated = await store.updateClass(classId, patch);
      if (updated) setCls(updated);
    },
    [classId]
  );

  /**
   * An approved import. It goes through `applyCurriculum` rather than a plain
   * save because renumbering a section has to move every mark filed under it
   * in the same breath — and then the whole class is re-read, since those
   * marks are now under different keys than the ones on screen.
   */
  const applyCurriculum = useCallback(
    async (units: CurriculumUnit[], remaps: SectionRemap[]) => {
      await store.applyCurriculum(classId, units, remaps, cls?.version ?? null);
      await loadData();
    },
    [classId, cls?.version, loadData]
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

  /** One student's mark on one checkpoint. Empty clears it. */
  const commitGrade = useCallback(
    (studentId: string, checkpoint: Checkpoint, raw: string) => {
      const key = `${studentId}:${checkpoint.id}`;
      setGradeDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      const outOf = checkpointMax(checkpoint);
      const trimmed = raw.trim();
      const score = Number(trimmed);
      const valid = trimmed !== "" && Number.isFinite(score);
      const current = classProgress.find((p) => p.studentId === studentId)?.checkpoints?.[
        checkpoint.id
      ];

      if (!valid && !current) return;
      if (valid && current && current.score === score && current.outOf === outOf) return;

      const all = classProgress.map((p) => {
        if (p.studentId !== studentId) return p;
        const checkpoints = { ...(p.checkpoints ?? {}) };
        if (valid) checkpoints[checkpoint.id] = { score, outOf };
        else delete checkpoints[checkpoint.id];
        return { ...p, checkpoints };
      });

      // A student who has not opened the class yet still needs somewhere to
      // keep a mark.
      if (valid && !classProgress.some((p) => p.studentId === studentId)) {
        all.push({
          studentId,
          unitId: 1,
          sections: {},
          checkpoints: { [checkpoint.id]: { score, outOf } },
        });
      }

      saveProgress(all);
    },
    [classProgress, saveProgress]
  );

  /**
   * The total belongs to the checkpoint, so changing it re-denominates the
   * marks already given — raw scores stay, the denominator moves with the
   * assignment rather than leaving old marks reading against a stale total.
   */
  const commitPoints = useCallback(
    (checkpoint: Checkpoint, raw: string) => {
      setPointsDrafts((prev) => {
        const next = { ...prev };
        delete next[checkpoint.id];
        return next;
      });

      const outOf = Number(raw.trim());
      if (!Number.isFinite(outOf) || outOf <= 0) return;
      if (outOf === checkpointMax(checkpoint)) return;

      saveClass({
        units: units.map((unit) => ({
          ...unit,
          checkpoints: (unit.checkpoints ?? []).map((c) =>
            c.id === checkpoint.id ? { ...c, maxPoints: outOf } : c
          ),
        })),
      });

      const touched = classProgress.some((p) => p.checkpoints?.[checkpoint.id]);
      if (!touched) return;

      saveProgress(
        classProgress.map((p) => {
          const grade = p.checkpoints?.[checkpoint.id];
          if (!grade) return p;
          return {
            ...p,
            checkpoints: { ...p.checkpoints, [checkpoint.id]: { ...grade, outOf } },
          };
        })
      );
    },
    [classProgress, saveClass, saveProgress, units]
  );

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;
    setInviting(true);
    setInviteError("");
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const data = await store.inviteToClass(classId, user.id, inviteInput.trim());
      setStudents(data.students);
      setInvites(data.invites);
      setInviteInput("");
      await loadData();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not invite");
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

    const approved = applyApproveTrack(section, reviewTarget.trackId);
    const graded = approved.tracks[reviewTarget.trackId]
      ? {
          ...approved,
          tracks: {
            ...approved.tracks,
            [reviewTarget.trackId]: {
              ...approved.tracks[reviewTarget.trackId],
              gradeNumerator: gradeNum,
              gradeDenominator: gradeDenom,
            },
          },
        }
      : approved;

    all[idx] = {
      ...all[idx],
      sections: { ...all[idx].sections, [reviewTarget.sectionId]: graded },
    };

    await saveProgress(all);
    setReviewTarget(null);
  }, [reviewTarget, classProgress, gradeNum, gradeDenom, saveProgress]);

  const handleSendBack = useCallback(async () => {
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
        [reviewTarget.sectionId]: applySendBackForTrack(section, reviewTarget.trackId),
      },
    };

    await saveProgress(all);
    setReviewTarget(null);
  }, [reviewTarget, classProgress, saveProgress]);

  const handleResolveHelp = useCallback(
    async (resolution: "all-good" | "send-back") => {
      if (!helpTarget) return;
      const all = [...classProgress];
      const idx = all.findIndex((p) => p.studentId === helpTarget.studentId);
      if (idx < 0) return;

      const section = all[idx].sections[helpTarget.sectionId];
      if (!section) return;

      all[idx] = {
        ...all[idx],
        sections: {
          ...all[idx].sections,
          [helpTarget.sectionId]:
            resolution === "send-back"
              ? applySendBackForTrack(section, helpTarget.trackId)
              : resolveHelpForTrack(section, helpTarget.trackId),
        },
      };

      await saveProgress(all);
      setHelpTarget(null);
    },
    [helpTarget, classProgress, saveProgress]
  );

  useEffect(() => {
    if (reviewTarget) {
      const p = classProgress.find((x) => x.studentId === reviewTarget.studentId);
      const tp = getTrackProgress(p?.sections[reviewTarget.sectionId], reviewTarget.trackId);
      setGradeNum(tp?.gradeNumerator ?? 10);
      setGradeDenom(tp?.gradeDenominator ?? 10);
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

  const classStats = sections.map((section, sIdx) => {
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

  const totalStudents = students.length;

  const reviewStudent = reviewTarget
    ? students.find((s) => s.id === reviewTarget.studentId)
    : null;
  const reviewSection = reviewTarget
    ? sections.find((s) => s.id === reviewTarget.sectionId)
    : null;
  const reviewProgress = reviewTarget
    ? classProgress.find((p) => p.studentId === reviewTarget.studentId)
    : null;
  const reviewTrack =
    reviewTarget && reviewSection
      ? getVisibleTracks(reviewSection).find((t) => t.id === reviewTarget.trackId)
      : null;
  const reviewProofUrl = reviewTarget
    ? getTrackProgress(reviewProgress?.sections[reviewTarget.sectionId], reviewTarget.trackId)
        ?.practiceProofUrl
    : undefined;

  const helpStudent = helpTarget
    ? students.find((s) => s.id === helpTarget.studentId)
    : null;
  const helpSection = helpTarget
    ? sections.find((s) => s.id === helpTarget.sectionId)
    : null;
  const helpProgress = helpTarget
    ? classProgress.find((p) => p.studentId === helpTarget.studentId)
    : null;
  const helpTrack =
    helpTarget && helpSection
      ? getVisibleTracks(helpSection).find((t) => t.id === helpTarget.trackId)
      : null;
  const helpTrackProgress = helpTarget
    ? getTrackProgress(helpProgress?.sections[helpTarget.sectionId], helpTarget.trackId)
    : undefined;
  const helpActivities = helpTrack
    ? getActiveSteps(helpTrack)
        .filter((step) => helpTrackProgress?.[step] === "help")
        .map((step) => (step === "learn" ? "Learn" : "Practice"))
    : [];

  const studentProgressList = classProgress.map((p) => {
    const student = students.find((s) => s.id === p.studentId)!;
    const completedCount = sections.filter(
      (s, sIdx) => getCellStatus(p, s.id, sIdx) === "complete"
    ).length;
    const pct = sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0;
    return { student, completedCount, pct };
  });

  const avgProgress =
    studentProgressList.length > 0 && sections.length > 0
      ? studentProgressList.reduce((acc, { pct }) => acc + pct / 100, 0) /
        studentProgressList.length
      : 0;

  const pendingHelpCount = countClassHelpRequests(units, classProgress, blockSectionId);

  const ClassGlyph = classIcon(cls?.icon);

  const navTabs = [
    {
      id: "classroom",
      label: "Classroom",
      tourId: "nav-classroom",
      onClick: () => selectView("classroom"),
      notify: pendingHelpCount > 0,
    },
    {
      id: "curriculum",
      label: "Curriculum",
      tourId: "nav-curriculum",
      onClick: () => selectView("curriculum"),
    },
    {
      id: "customize",
      label: "Customize",
      tourId: "nav-customize",
      onClick: () => selectView("customize"),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0b0f16]">
      <AppNavbar
        sticky
        left={
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard?tab=teaching"
              data-tour="nav-dashboard"
              className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-sm shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
            <Logo size={24} showText={false} />
            <span className="font-mono text-sm font-bold tracking-[0.15em] text-slate-700 dark:text-slate-300 tabular-nums">
              {cls.code}
            </span>
          </div>
        }
        center={
          <span data-tour="class-nav" className="inline-flex">
            <NavCapsule
              tabs={navTabs}
              activeId={activeView}
              className="hidden sm:inline-flex"
            />
          </span>
        }
        right={
          <>
            <ThemeToggle />
            <ProfileMenu />
          </>
        }
      />

      {/* Phone: the capsule needs its own row — sharing the navbar with the
          class code overflows a 375px screen. */}
      <div className="sm:hidden sticky top-14 z-20 flex justify-center px-5 py-2 border-b border-slate-200 dark:border-slate-800 float-pane">
        <NavCapsule tabs={navTabs} activeId={activeView} />
      </div>

      <div className="max-w-7xl mx-auto w-full px-5 py-6 space-y-6">
        <div>
          {editingName ? (
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
              className="text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none text-slate-900 dark:text-slate-100 w-full max-w-md"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <ClassGlyph className="w-5 h-5 shrink-0 text-primary dark:text-primary-glow" />
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight hover:text-primary dark:hover:text-primary-glow transition-colors text-left truncate"
                title="Click to edit class name"
              >
                {cls.name}
              </button>
            </div>
          )}
          {activeView !== "customize" && (
            <div data-tour="unit-nav" className="flex items-center gap-2 mt-1.5 flex-wrap">
              <UnitNav
                index={activeUnitIndex}
                count={units.length}
                title={activeUnit?.title ?? "No units"}
                phase={unitPhase}
                onChange={setActiveUnitIndex}
              />
            </div>
          )}
        </div>

        {activeView === "classroom" && (
          <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Students" value={totalStudents} sub="enrolled" icon={<Users className="w-4 h-4 text-primary" />} color="blue" onClick={() => setOpenModal("students")} />
          <StatCard label="Avg Progress" value={`${Math.round(avgProgress * 100)}%`} sub="complete" icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} color="green" onClick={() => setOpenModal("progress")} />
          <StatCard className="col-span-2 sm:col-span-1" label="Sections" value={sections.length} sub="subunits" icon={<LayoutGrid className="w-4 h-4 text-primary" />} color="violet" onClick={() => setOpenModal("sections")} />
        </div>

        {sections.length > 0 && (
          <>
            {/*
              Three things want this row: the unit selector, the keys and the
              search. They only all fit side by side on a wide screen, so the
              row gives up one thing at a time — below `xl` the unit selector
              goes (the page heading carries the same control, on the same
              state), and below `md` the keys move above the search.
            */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="hidden xl:block min-w-0">
                <UnitNav
                  index={activeUnitIndex}
                  count={units.length}
                  title={activeUnit?.title ?? "No units"}
                  phase={unitPhase}
                  onChange={setActiveUnitIndex}
                />
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end md:gap-2">
                <TableKeys sections={sections} />
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-full md:w-48"
                  />
                </div>
              </div>
            </div>

            <div data-tour="progress-table" className="card overflow-hidden">
              <div ref={tableScrollRef} className="relative overflow-x-auto">
                {effectiveBlockId && isActiveUnit && sections.length > 0 && (
                  <TableProgressGate
                    blockSectionId={effectiveBlockId}
                    onChange={handleBlockChange}
                    containerRef={tableScrollRef}
                    columnRefs={sectionColumnRefs}
                    sectionIds={sectionIds}
                    endRef={inviteRowRef}
                  />
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left px-4 py-3 font-semibold text-slate-500 w-36 sticky left-0 z-10 float-pane-sticky">
                        Student
                      </th>
                      {columns.map((column) =>
                        column.kind === "section" ? (
                          <th
                            key={column.section.id}
                            ref={(el) => {
                              sectionColumnRefs.current[column.index] = el;
                            }}
                            style={{ minWidth: titleColumnWidth(column.section.title) }}
                            className="text-center align-bottom px-2 py-3 font-semibold text-slate-500"
                          >
                            <div>{column.section.id}</div>
                            <div className="text-[10px] font-normal text-slate-400 mt-0.5 leading-[14px]">
                              {column.section.title}
                            </div>
                          </th>
                        ) : (
                          <th
                            key={column.checkpoint.id}
                            style={{ minWidth: titleColumnWidth(column.checkpoint.title) }}
                            className="px-2 py-3 align-bottom border-x border-slate-100 dark:border-slate-800"
                          >
                            {/* Tight stack, with the title given room for two
                               lines whether it needs them or not — that is what
                               keeps the totals on one line across the row
                               without spreading each header apart. */}
                            <div className="flex flex-col items-center gap-0.5">
                              {/* No kind row: the title itself carries the
                                  colour, and the tooltip spells it out. */}
                              <Tooltip
                                className="min-h-[1.8rem] flex items-center"
                                label={
                                  <>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                      {column.checkpoint.title}
                                    </span>
                                    {" — "}
                                    {CHECKPOINT_KIND_META[column.checkpoint.kind].label.toLowerCase()}
                                    {column.checkpoint.afterSectionId
                                      ? `, after ${column.checkpoint.afterSectionId}`
                                      : ""}
                                    {column.checkpoint.date ? ` · due ${column.checkpoint.date}` : ""}
                                    {column.checkpoint.note ? ` · ${column.checkpoint.note}` : ""}
                                  </>
                                }
                              >
                                <span
                                  className={cn(
                                    "text-xs font-semibold leading-[1.15] cursor-help",
                                    CHECKPOINT_KIND_META[column.checkpoint.kind].accent
                                  )}
                                >
                                  {column.checkpoint.title}
                                </span>
                              </Tooltip>
                              <label className="flex items-center justify-center gap-0.5 h-[14px] text-[10px] font-normal leading-[14px] text-slate-400">
                                out of
                                <input
                                  type="number"
                                  min={1}
                                  value={
                                    pointsDrafts[column.checkpoint.id] ??
                                    String(checkpointMax(column.checkpoint))
                                  }
                                  onChange={(e) =>
                                    setPointsDrafts((prev) => ({
                                      ...prev,
                                      [column.checkpoint.id]: e.target.value,
                                    }))
                                  }
                                  onBlur={(e) => commitPoints(column.checkpoint, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") e.currentTarget.blur();
                                  }}
                                  title="Points this is out of"
                                  className="no-spinner w-8 h-[14px] px-0.5 py-0 leading-[14px] text-center text-[10px] font-semibold tabular-nums bg-transparent border-0 border-b border-slate-300 dark:border-slate-600 rounded-none hover:border-slate-400 focus:border-primary focus:outline-none"
                                />
                              </label>
                            </div>
                          </th>
                        )
                      )}
                      <th className="text-center px-3 py-3 font-semibold text-slate-500 min-w-[80px]">
                        Overall
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, idx) => {
                      const studentProgress = classProgress.find((p) => p.studentId === student.id);
                      const completedCount = sections.filter(
                        (s, sIdx) =>
                          studentProgress && getCellStatus(studentProgress, s.id, sIdx) === "complete"
                      ).length;
                      const pct = sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0;

                      return (
                        <tr key={student.id} className={cn("border-b border-slate-100 dark:border-slate-800/50", idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/30")}>
                          <td className="px-4 py-3 sticky left-0 z-10 float-pane-sticky">
                            <div className="flex items-center gap-2">
                              <UserAvatar initials={student.avatar} size="sm" />
                              <span className="flex-1 min-w-0 font-medium text-sm">
                                {student.name}
                              </span>
                              <Popover
                                width={208}
                                align="left"
                                triggerTitle={`Options for ${student.name}`}
                                triggerClassName={(open) =>
                                  cn(
                                    "shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                                    open
                                      ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                      : "text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  )
                                }
                                label={<MoreHorizontal className="w-4 h-4" />}
                                panelClassName="p-1.5"
                              >
                                {(close) => (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      close();
                                      setPendingRemoval(student);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  >
                                    <UserMinus className="w-4 h-4" />
                                    Remove from class
                                  </button>
                                )}
                              </Popover>
                            </div>
                          </td>
                          {columns.map((column) => {
                            if (column.kind === "checkpoint") {
                              const grade =
                                studentProgress?.checkpoints?.[column.checkpoint.id];
                              const draftKey = `${student.id}:${column.checkpoint.id}`;
                              return (
                                <td
                                  key={column.checkpoint.id}
                                  className="px-2 py-3 text-center border-x border-slate-100 dark:border-slate-800"
                                >
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="—"
                                    aria-label={`${column.checkpoint.title} score for ${student.name}`}
                                    value={
                                      gradeDrafts[draftKey] ??
                                      (grade ? String(grade.score) : "")
                                    }
                                    onChange={(e) =>
                                      setGradeDrafts((prev) => ({
                                        ...prev,
                                        [draftKey]: e.target.value,
                                      }))
                                    }
                                    onBlur={(e) =>
                                      commitGrade(student.id, column.checkpoint, e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") e.currentTarget.blur();
                                    }}
                                    className={cn(
                                      "no-spinner w-14 px-1.5 py-1 text-center text-xs font-semibold tabular-nums rounded-lg border border-transparent bg-transparent transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600 hover:border-slate-200 dark:hover:border-slate-700 focus:border-primary focus:outline-none focus:bg-white dark:focus:bg-slate-900",
                                      grade ? gradeToneClass(grade) : ""
                                    )}
                                  />
                                </td>
                              );
                            }

                            const section = column.section;
                            const sIdx = column.index;
                            const status = getCellStatus(studentProgress, section.id, sIdx);
                            const cfg = STATUS_CONFIG[status];
                            const isReview = status === "review";
                            const isHelp = status === "help";
                            const beyondGate = gateActive && sIdx > blockIndex;

                            return (
                              <td key={section.id} className={cn("px-2 py-3", beyondGate && "opacity-60")}>
                                <div className="flex flex-col items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                                      cfg.classes
                                    )}
                                    title={
                                      isReview
                                        ? "A submission is waiting on you — click the resource below"
                                        : isHelp
                                          ? "Help requested — click the resource below"
                                          : undefined
                                    }
                                  >
                                    {cfg.icon}
                                    {cfg.label}
                                  </span>
                                  <TrackStatusDots
                                    section={section}
                                    sectionProgress={studentProgress?.sections[section.id]}
                                    accessible={!beyondGate && unitPhase !== "upcoming"}
                                    onTrackClick={(trackId) =>
                                      openTrackTarget(student.id, section.id, trackId)
                                    }
                                  />
                                </div>
                              </td>
                            );
                          })}
                          <td className="text-center px-3 py-3">
                            <span className="text-xs font-semibold">{pct}%</span>
                          </td>
                        </tr>
                      );
                    })}

                    <tr
                      ref={inviteRowRef}
                      className="bg-slate-50 dark:bg-slate-800/30 border-t-2 border-dashed border-slate-200 dark:border-slate-700"
                    >
                      <td colSpan={columns.length + 2} className="px-4 py-3">
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
                            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-medium disabled:opacity-50"
                          >
                            {inviting ? "Inviting…" : "Invite"}
                          </button>
                        </form>
                        {inviteError && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 ml-7">
                            {inviteError}
                          </p>
                        )}
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
            {isActiveUnit && (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-600">
              Drag the{" "}
              <span className="text-rose-500 dark:text-rose-400">red line</span> to set how far
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
            )}
          </>
        )}

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
                  {/* Same five colours as every chip in the app — these bars
                      used to spell their own, so "Active" read blue here and
                      sky everywhere else. */}
                  <MiniBar label="Done" count={stat.complete} total={totalStudents} color={STATUS_DOT.complete} />
                  <MiniBar label="Review" count={stat.review} total={totalStudents} color={STATUS_DOT.review} />
                  <MiniBar label="Active" count={stat.inProgress} total={totalStudents} color={STATUS_DOT["in-progress"]} />
                  <MiniBar label="Help!" count={stat.help} total={totalStudents} color={STATUS_DOT.help} />
                  <MiniBar label="Not started" count={stat.notStarted} total={totalStudents} color={STATUS_DOT["not-started"]} />
                </div>
              ))}
            </div>
          </div>
        )}
          </>
        )}

        {activeView === "curriculum" && (
          <div data-tour="curriculum">
          <CurriculumPanel
            classId={classId}
            units={cls.units}
            importInstructions={cls.importInstructions}
            onUpdate={(units) => saveClass({ units })}
            onSaveInstructions={(importInstructions) => saveClass({ importInstructions })}
            onApply={applyCurriculum}
          />
          </div>
        )}

        {activeView === "customize" && (
          <ClassCustomize
            name={cls.name}
            code={cls.code}
            color={cls.color}
            icon={cls.icon}
            onChange={(patch) => {
              if (patch.name) setClassName(patch.name);
              saveClass(patch);
            }}
          />
        )}

      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (!pendingRemoval) return;
          void store.unenrollStudent(classId, pendingRemoval.id).then(() => loadData());
        }}
        danger
        title="Remove this student?"
        confirmLabel="Remove student"
        body={
          <>
            <strong>{pendingRemoval?.name}</strong> comes off the roster and stops seeing
            this class. Their work is kept, so joining again with the class code brings it
            back.
          </>
        }
      />

      <Modal open={reviewTarget !== null} onClose={() => setReviewTarget(null)} title="Review Submission" className="max-w-xl">
        {reviewStudent && reviewSection && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">
                {reviewStudent.avatar}
              </div>
              <div>
                <p className="font-semibold">{reviewStudent.name}</p>
                <p className="text-sm text-slate-500">
                  {reviewSection.id} · {reviewSection.title}
                  {reviewTrack ? ` · ${reviewTrack.label}` : ""}
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

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={handleApprove} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Submit grade & complete
              </button>
              <button type="button" onClick={handleSendBack} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">
                <RotateCcw className="w-4 h-4" />
                Send Back to Review
              </button>
              <button type="button" onClick={() => setReviewTarget(null)} className="px-4 py-2 rounded-lg border text-sm">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={helpTarget !== null} onClose={() => setHelpTarget(null)} title="Resolve Help Request" className="max-w-xl">
        {helpStudent && helpSection && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-sm font-bold text-rose-700">
                {helpStudent.avatar}
              </div>
              <div>
                <p className="font-semibold">{helpStudent.name}</p>
                <p className="text-sm text-slate-500">
                  {helpSection.id} · {helpSection.title}
                  {helpTrack ? ` · ${helpTrack.label}` : ""}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Help requested on
              </p>
              <ul className="space-y-1">
                {helpActivities.map((activity) => (
                  <li key={activity} className="text-sm text-rose-600 font-medium">
                    {activity}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              &ldquo;All good&rdquo; lets the student continue. &ldquo;Send back to review&rdquo;
              notifies them to revise and resubmit.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => handleResolveHelp("all-good")} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                All Good
              </button>
              <button type="button" onClick={() => handleResolveHelp("send-back")} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">
                <RotateCcw className="w-4 h-4" />
                Send Back to Review
              </button>
              <button type="button" onClick={() => setHelpTarget(null)} className="px-4 py-2 rounded-lg border text-sm">
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
                <div className="w-8 h-8 rounded-full bg-white border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">{s.avatar}</div>
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
              <span className="font-bold text-primary">{s.id}</span> {s.title}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

/**
 * The unit selector. It appears twice — under the class name and above the
 * progress table — and both instances drive the same state, so moving the unit
 * in one place moves it in the other.
 */
function UnitNav({
  index,
  count,
  title,
  phase,
  onChange,
}: {
  index: number;
  count: number;
  title: string;
  phase: UnitPhase;
  onChange: (next: number) => void;
}) {
  const arrows = count > 1;

  return (
    <div className="flex items-center gap-2 min-w-0">
      {arrows && (
        <button
          type="button"
          onClick={() => onChange(Math.max(0, index - 1))}
          disabled={index === 0}
          aria-label="Previous unit"
          className="w-7 h-7 shrink-0 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 min-w-0">
        <span className="truncate">{title}</span>
        {count > 0 && <UnitPhaseBadge phase={phase} />}
      </p>
      {arrows && (
        <button
          type="button"
          onClick={() => onChange(Math.min(count - 1, index + 1))}
          disabled={index >= count - 1}
          aria-label="Next unit"
          className="w-7 h-7 shrink-0 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Three keys rather than one long list — the grid carries three separate
 * vocabularies, and a teacher looking up a colour should not have to read past
 * the other two.
 */
function TableKeys({ sections }: { sections: Section[] }) {
  const resources = new Map<string, string>();
  for (const section of sections) {
    for (const track of getVisibleTracks(section)) {
      const abbr = trackAbbr(track);
      if (!resources.has(abbr)) resources.set(abbr, track.label);
    }
  }

  const statuses: ProgressStatus[] = [
    "not-started",
    "in-progress",
    "review",
    "help",
    "complete",
  ];

  const kinds: CheckpointKind[] = ["quiz", "test", "checkpoint", "project"];

  return (
    <div data-tour="table-keys" className="flex items-center gap-1.5 flex-wrap">
      <span className="eyebrow-muted mr-0.5">Key</span>

      <KeyPopover label="Resources" hint="The two-letter chip on each subunit.">
        {[...resources].map(([abbr, label]) => (
          <KeyRow
            key={abbr}
            swatch={
              <span className="inline-flex items-center justify-center w-6 h-5 rounded font-bold text-[10px] leading-none tracking-wide bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500">
                {abbr}
              </span>
            }
            label={label}
          />
        ))}
      </KeyPopover>

      <KeyPopover
        label="Assignment Colors"
        hint="Where a student is on one resource. Click a chip to open what it needs."
      >
        {statuses.map((status) => (
          <KeyRow
            key={status}
            swatch={
              <span
                className={cn(
                  "inline-flex items-center justify-center w-6 h-5 rounded font-bold text-[10px] leading-none",
                  STATUS_CHIP[status]
                )}
              >
                Aa
              </span>
            }
            label={STATUS_LABEL[status]}
          />
        ))}
      </KeyPopover>

      <KeyPopover label="Title Colors" hint="What a graded column is.">
        {kinds.map((kind) => (
          <KeyRow
            key={kind}
            swatch={
              <span
                className={cn(
                  "text-xs font-semibold w-6 text-center",
                  CHECKPOINT_KIND_META[kind].accent
                )}
              >
                Aa
              </span>
            }
            label={CHECKPOINT_KIND_META[kind].label}
          />
        ))}
      </KeyPopover>
    </div>
  );
}

function KeyPopover({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Popover
      width={264}
      align="right"
      triggerTitle={hint}
      triggerClassName="inline-flex items-center h-[34px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-primary/50 hover:text-primary dark:hover:text-primary-glow transition-colors shrink-0"
      label={label}
    >
      {() => (
        <div className="p-4">
          <ul className="space-y-1.5">{children}</ul>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 leading-snug">
            {hint}
          </p>
        </div>
      )}
    </Popover>
  );
}

function KeyRow({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span className="shrink-0">{swatch}</span>
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
    </li>
  );
}

function StatCard({ label, value, sub, icon, color, onClick, className }: {
  label: string; value: string | number; sub: string; icon: React.ReactNode;
  color: "blue" | "red" | "green" | "violet"; onClick: () => void; className?: string;
}) {
  const bg = { blue: "bg-white dark:bg-slate-900 border border-primary/30", red: "bg-rose-50 dark:bg-rose-950", green: "bg-emerald-50 dark:bg-emerald-950", violet: "bg-white dark:bg-slate-900 border border-primary/30" }[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-white dark:bg-slate-900 p-4 text-left hover:border-primary/50 transition-colors",
        className
      )}
    >
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
