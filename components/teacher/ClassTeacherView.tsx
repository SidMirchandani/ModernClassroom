"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { countClassHelpRequests } from "@/lib/class-progress";
import { classIcon } from "@/lib/class-appearance";
import { useClassTheme } from "@/lib/use-class-theme";
import { usePageTitle } from "@/lib/use-page-title";
import { classHasStarted, getCurrentUnitIndexByDate, getUnitPhase, type UnitPhase } from "@/lib/unit-phase";
import { UnitPhaseBadge } from "./UnitPhaseBadge";
import { CurriculumPanel } from "./CurriculumPanel";
import { ImportDialog } from "./ImportDialog";
import { useCurriculumImport } from "@/lib/use-curriculum-import";
import { ClassCustomize } from "./ClassCustomize";
import { ClassroomPanel } from "./ClassroomPanel";
import { ClassroomGrid } from "./ClassroomGrid";
import { useClassroom } from "@/lib/use-classroom";
import { useClassroomLinks } from "@/lib/use-classroom-links";
import { supabaseConfigured } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { Logo } from "@/components/Logo";
import { NavCapsule } from "@/components/NavCapsule";
import { AppNavbar } from "@/components/AppNavbar";
import { getCurrentUser } from "@/lib/auth-client";
import { store, type SectionRemap } from "@/lib/store";
import { useClassSync } from "@/lib/use-class-sync";
import type { CurriculumUnit, DbClass } from "@/lib/db/types";
import type { StudentProgress } from "@/lib/types";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type TeacherView = "classroom" | "curriculum" | "customize";

function readView(value: string | null): TeacherView {
  return value === "curriculum" || value === "customize" ? value : "classroom";
}
interface ClassTeacherViewProps {
  classId: string;
}

export function ClassTeacherView({ classId }: ClassTeacherViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState<DbClass | null>(null);
  const [classProgress, setClassProgress] = useState<StudentProgress[]>([]);
  const [className, setClassName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  // The tab lives in the URL as well as in state, so a link can land on
  // Curriculum or Customize.
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

  // Memoised: a fresh [] each render would rebuild every callback closing over it.
  const units = useMemo(() => cls?.units ?? [], [cls]);
  const activeUnit = units[activeUnitIndex];
  // Where the class is comes from the calendar: there is no line to drag.
  const currentUnitIndex = getCurrentUnitIndexByDate(units, new Date());
  const unitPhase = getUnitPhase(activeUnitIndex, currentUnitIndex, classHasStarted(units, new Date()));

  const loadData = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) {
      router.replace("/");
      return;
    }
    // A reload that fails keeps what is on screen — see ClassStudentView.
    const data = await store.getClassDetail(classId, user.id).catch((err) => {
      console.warn("Could not refresh this class", err);
      return undefined;
    });
    if (data === undefined) return;
    if (!data) {
      router.replace("/dashboard");
      return;
    }
    setCls(data.class);

    // A re-read can arrive at any moment — a student marking a step is enough
    // to cause one. It must never move the teacher: not off the unit they are
    // looking at, and not out of the name they are halfway through typing.
    // Not until there is something to land on: a new class is empty until its
    // plan is approved, and should then open on the unit it is in.
    if (!settled.current && data.class.units.length > 0) {
      setActiveUnitIndex(getCurrentUnitIndexByDate(data.class.units, new Date()));
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

  useClassTheme(cls?.color);
  usePageTitle(
    cls?.name &&
      (activeView === "curriculum"
        ? `Curriculum for ${cls.name}`
        : activeView === "customize"
          ? `Customize ${cls.name}`
          : cls.name),
    "Teaching"
  );

  const classroomEnabled = supabaseConfigured();
  const classroom = useClassroom(classId, classroomEnabled);
  const { postQuietly } = classroom;
  const { links: classroomLinks } = useClassroomLinks(classId, classroomEnabled, classroom.syncCount);

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
      // An approved curriculum goes on to Google Classroom by itself.
      postQuietly();
    },
    [classId, cls?.version, loadData, postQuietly]
  );

  const handleNameSave = async () => {
    setEditingName(false);
    if (className.trim() && className !== cls?.name) {
      await saveClass({ name: className.trim() });
    }
  };

  // Reading the teacher's files in — the curriculum's one use of AI. The
  // draft it makes is reviewed on the Curriculum tab, so one arriving while
  // the teacher is elsewhere takes them there.
  const importer = useCurriculumImport({
    classId,
    units,
    onApply: applyCurriculum,
    onDraft: () => selectView("curriculum"),
  });

  if (loading || !cls) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const pendingHelpCount = countClassHelpRequests(units, classProgress, null);

  const ClassGlyph = classIcon(cls?.icon);

  const navTabs = [
    {
      id: "classroom",
      label: "Classroom",
      onClick: () => selectView("classroom"),
      notify: pendingHelpCount > 0,
    },
    {
      id: "curriculum",
      label: "Curriculum",
      onClick: () => selectView("curriculum"),
    },
    {
      id: "customize",
      label: "Customize",
      onClick: () => selectView("customize"),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <AppNavbar
        sticky
        left={
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard?tab=teaching"
              className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-sm shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              {/* Only where there is room: beside the tab capsule. */}
              <span className="hidden lg:inline">Dashboard</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700 hidden lg:inline">|</span>
            <Logo size={24} showText={false} />
          </div>
        }
        center={
          <NavCapsule
            tabs={navTabs}
            activeId={activeView}
            className="hidden sm:inline-flex"
          />
        }
        right={
          <>
            <ThemeToggle />
            <ProfileMenu />
          </>
        }
      />

      {/* Phone: the capsule needs its own row on a 375px screen. */}
      <div className="sm:hidden sticky top-14 z-20 flex justify-center px-5 py-2 border-b border-slate-200 dark:border-slate-800 float-pane">
        <NavCapsule tabs={navTabs} activeId={activeView} />
      </div>

      {/* A size container: the class lays itself out for the width it
          actually has (the `cq-*` variants) — the subunit inspector beside
          the curriculum takes some of it. */}
      <div style={{ containerType: "inline-size" }}>
      <div className="max-w-7xl mx-auto w-full px-5 cq-sm:px-6 py-8 cq-sm:py-10 space-y-10">
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
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
          <div key="classroom-google" className="page-in">
            <ClassroomGrid
              classId={classId}
              unit={activeUnit}
              classroom={classroom}
              onOpenCurriculum={() => selectView("curriculum")}
            />
          </div>
        )}

        {activeView === "curriculum" && (
          <div key="curriculum" className="page-in space-y-5">
          {!importer.review && <ClassroomPanel classroom={classroom} />}
          <CurriculumPanel
            units={cls.units}
            // An unlinked class's links are kept for relinking, but mean nothing until then.
            links={classroom.status.state === "connected" && classroom.status.courseId ? classroomLinks : []}
            importer={importer}
          />
          </div>
        )}

        {activeView === "customize" && (
          <div key="customize" className="page-in">
          <ClassCustomize
            name={cls.name}
            color={cls.color}
            icon={cls.icon}
            onChange={(patch) => {
              if (patch.name) setClassName(patch.name);
              saveClass(patch);
            }}
          />
          </div>
        )}

      </div>
      </div>

      {/* Here rather than in the Curriculum tab: a read started there keeps
          going, and can be watched, from any tab. */}
      <ImportDialog importer={importer} units={units} />

    </div>
  );
}

/**
 * The unit selector, under the class name.
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
