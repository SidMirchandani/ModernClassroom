"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell, type DashboardMode } from "./DashboardShell";
import { getCurrentUser } from "@/lib/auth-client";
import { usePageTitle } from "@/lib/use-page-title";
import { store } from "@/lib/store";
import type { ClassSummary } from "@/lib/db/types";
import { buildTodosForClasses, type TodoItem } from "@/lib/todos";
import { classIcon, DEFAULT_ACCENT } from "@/lib/class-appearance";
import { cn } from "@/lib/utils";
import { TodoButton } from "@/components/TodoButton";
import { UNLINK_BODY } from "@/components/teacher/ClassroomPanel";
import type { AccentId } from "@/lib/class-appearance";
import { ClassroomSide, type DashboardCourse } from "./ClassroomSide";
import { ColorPicker } from "./ColorPicker";
import { Popover } from "@/components/Popover";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  CopyPlus,
  Loader2,
  LogOut,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";

export function DashboardClient() {
  const router = useRouter();
  // Always Teaching while the Enrolled tab is Coming Soon, whatever `?tab=` says.
  const [mode, setMode] = useState<DashboardMode>("teaching");
  usePageTitle(mode === "teaching" ? "Teaching" : "Enrolled");
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Each class's Google Classroom. Null until known, and asked for separately so
  // a slow answer from Google doesn't hold up the page.
  const [google, setGoogle] = useState<{ connected: boolean; courses: Map<string, DashboardCourse> } | null>(null);
  const [pendingUnlink, setPendingUnlink] = useState<ClassSummary | null>(null);
  const [unlinkError, setUnlinkError] = useState("");
  // The class a confirm dialog is currently asking about, if any.
  const [pendingRemoval, setPendingRemoval] = useState<ClassSummary | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.replace("/");
        return;
      }
      const summaries = await store.listClassSummaries(user.id);
      if (!alive) return;
      setClasses(summaries);

      // The dashboard's To-Do spans every class you sit in, so each one's
      // curriculum and your own progress row have to be read here.
      const enrolled = summaries.filter((c) => c.role === "student");
      const details = await Promise.all(
        enrolled.map((summary) => store.getClassDetail(summary.id, user.id, "student"))
      );
      if (!alive) return;
      setTodos(
        buildTodosForClasses(
          enrolled.flatMap((summary, i) => {
            const detail = details[i];
            if (!detail) return [];
            const mine = detail.progress.find((p) => p.studentId === user.id);
            return [
              {
                classId: summary.id,
                className: summary.name,
                units: detail.class.units,
                blockSectionId: detail.class.blockSectionId,
                progress: {
                  studentId: user.id,
                  unitId: 1,
                  sections: mine?.sections ?? {},
                },
              },
            ];
          }),
          new Date()
        )
      );

      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    let alive = true;
    fetch("/api/google")
      .then((res) => (res.ok ? res.json() : { connected: false }))
      .catch(() => ({ connected: false }))
      .then((body) => {
        if (!alive) return;
        const courses = new Map<string, DashboardCourse>();
        for (const link of body.classLinks ?? []) {
          const course = (body.courses ?? []).find((c: { id: string }) => c.id === link.courseId);
          courses.set(link.classId, {
            // Archived in Classroom, or moved: still connected, just unnamed.
            name: course?.name ?? "Connected class",
            section: course?.section,
            alternateLink: course?.alternateLink,
            students: link.students,
            color: link.color ?? undefined,
          });
        }
        setGoogle({ connected: Boolean(body.connected), courses });
      });
    return () => {
      alive = false;
    };
  }, []);

  const filteredClasses = classes.filter((cls) =>
    mode === "teaching" ? cls.role === "teacher" : cls.role === "student"
  );

  async function refreshClasses() {
    const user = await getCurrentUser();
    if (user) setClasses(await store.listClassSummaries(user.id));
  }

  /** Deleting a class you teach, or leaving one you are in. Same button. */
  async function confirmRemoval() {
    const user = await getCurrentUser();
    if (!user || !pendingRemoval) return;
    if (pendingRemoval.role === "teacher") {
      await store.deleteClass(pendingRemoval.id, user.id);
    } else {
      await store.unenrollStudent(pendingRemoval.id, user.id);
    }
    await refreshClasses();
  }

  /** Shown at once, and put back if it doesn't save. */
  async function changeClassColor(classId: string, color: AccentId) {
    const before = classes;
    setClasses((list) => list.map((c) => (c.id === classId ? { ...c, color } : c)));
    setUnlinkError("");
    try {
      await store.updateClass(classId, { color });
    } catch {
      setClasses(before);
      setUnlinkError("That color couldn't be saved. Try again in a minute.");
    }
  }

  async function changeClassroomColor(classId: string, color: AccentId) {
    const previous = google?.courses.get(classId)?.color;
    const paint = (next: AccentId | undefined) =>
      setGoogle((g) => {
        const course = g?.courses.get(classId);
        if (!g || !course) return g;
        return { ...g, courses: new Map(g.courses).set(classId, { ...course, color: next }) };
      });
    paint(color);
    setUnlinkError("");
    const res = await fetch("/api/classroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, classroomColor: color }),
    }).catch(() => null);
    if (!res?.ok) {
      paint(previous);
      setUnlinkError("That color couldn't be saved. Try again in a minute.");
    }
  }

  async function confirmUnlink() {
    if (!pendingUnlink) return;
    const classId = pendingUnlink.id;
    setUnlinkError("");
    const res = await fetch("/api/classroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, unlink: true }),
    }).catch(() => null);
    if (!res?.ok) {
      setUnlinkError("That class couldn't be unlinked. Try again in a minute.");
      return;
    }
    setGoogle((g) => {
      if (!g) return g;
      const courses = new Map(g.courses);
      courses.delete(classId);
      return { ...g, courses };
    });
  }

  async function handleDuplicate(classId: string) {
    const user = await getCurrentUser();
    if (!user) return;
    const copy = await store.duplicateClass(classId, user.id);
    if (copy) router.push(`/dashboard/class/${copy.id}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <DashboardShell mode={mode} onModeChange={setMode}>
      <div className="flex items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-slate-900 dark:text-slate-100">
            Classes
          </h1>
        </div>
        {mode === "teaching" ? (
          <Link
            href="/dashboard/new"
            className="btn btn-md btn-primary shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Class
          </Link>
        ) : (
          <TodoButton
            items={todos}
            showClass
            onOpenItem={(item) =>
              router.push(`/dashboard/class/${item.classId}?as=student`)
            }
          />
        )}
      </div>

      {filteredClasses.length === 0 ? (
        <div className="page-in text-center py-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 ">
          <p className="text-slate-500 dark:text-slate-400">
            {mode === "teaching"
              ? "No classes yet. Create one to get started."
              : "Not enrolled in any classes yet."}
          </p>
        </div>
      ) : (
        <div key={mode} className="list-in space-y-4">
          {filteredClasses.map((cls) => {
            const Icon = classIcon(cls.icon, cls.role);
            const classHref =
              cls.role === "student" ? `/dashboard/class/${cls.id}?as=student` : `/dashboard/class/${cls.id}`;

            return (
              // One card per class, cut in two by a slash: the class on the left,
              // its Google Classroom on the right, each its own link with its own
              // hover. The palette is scoped to the row, because this is the one
              // place several classes share a page.
              <div
                key={`${cls.id}-${cls.role}`}
                className="relative grid grid-cols-1 sm:grid-cols-2 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                data-accent={cls.color}
              >
                <div className="slash-left relative min-w-0">
                  <Link href={classHref} className="group/row flex flex-col h-full min-h-[9.5rem]">
                    <div className="relative overflow-hidden flex-1 bg-primary px-5 pt-5 pb-6 pr-28 text-white transition-[filter] duration-150 group-hover/row:brightness-110">
                      {/* The class's own glyph, large and quiet, as the banner's picture. */}
                      <Icon aria-hidden className="absolute right-3 -bottom-5 w-28 h-28 text-white/15" />
                      <div className="relative text-xl font-medium leading-snug group-hover/row:underline underline-offset-2 line-clamp-2">
                        {cls.name}
                      </div>
                    </div>
                    <div className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {cls.subunitCount} subunit{cls.subunitCount !== 1 ? "s" : ""}
                    </div>
                  </Link>

                  {/* Outside the link, so these can't open the class. */}
                  <div className="absolute right-2.5 sm:right-5 top-2.5 flex items-center">
                    <ColorPicker
                      value={cls.color ?? DEFAULT_ACCENT}
                      title="Change color"
                      onPick={(color) => void changeClassColor(cls.id, color)}
                    />
                    <Popover
                      width={224}
                      align="right"
                      triggerTitle={cls.role === "teacher" ? "Class options" : "Enrolment options"}
                      triggerClassName={(open) =>
                        cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors hover:bg-white/20",
                          open && "bg-white/20"
                        )
                      }
                      label={<MoreVertical className="w-5 h-5" />}
                      panelClassName="p-1.5"
                    >
                      {(close) => (
                        <>
                          {/* Duplicating is occasional, so it lives in here too
                              rather than as a button on every row. */}
                          {cls.role === "teacher" && (
                            <button
                              type="button"
                              onClick={() => {
                                close();
                                handleDuplicate(cls.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                              <CopyPlus className="w-4 h-4" />
                              Duplicate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              close();
                              setPendingRemoval(cls);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            {cls.role === "teacher" ? (
                              <>
                                <Trash2 className="w-4 h-4" />
                                Delete class
                              </>
                            ) : (
                              <>
                                <LogOut className="w-4 h-4" />
                                Leave class
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </Popover>
                  </div>
                </div>

                <ClassroomSide
                  course={google === null ? undefined : (google.courses.get(cls.id) ?? null)}
                  className={cls.name}
                  onUnlink={() => setPendingUnlink(cls)}
                  onColor={(color) => void changeClassroomColor(cls.id, color)}
                  // With Google connected the class's own card picks the
                  // Classroom class. Without, connect first and land there.
                  connectHref={
                    google?.connected
                      ? `/dashboard/class/${cls.id}?view=curriculum`
                      : `/api/google/connect?returnTo=${encodeURIComponent(`/dashboard/class/${cls.id}?view=curriculum`)}`
                  }
                />

                {/* The slash itself, along the edge where the two halves meet. */}
                <svg
                  aria-hidden
                  viewBox="0 0 28 100"
                  preserveAspectRatio="none"
                  className="hidden sm:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-7 h-full pointer-events-none text-slate-200 dark:text-slate-700"
                >
                  <line x1="28" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            );
          })}
        </div>
      )}

      {unlinkError && (
        <p className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-[15px] text-rose-800 dark:text-rose-200">
          {unlinkError}
        </p>
      )}

      <ConfirmDialog
        open={pendingUnlink !== null}
        onClose={() => setPendingUnlink(null)}
        onConfirm={() => void confirmUnlink()}
        title="Unlink this Google Classroom class?"
        confirmLabel="Unlink"
        body={UNLINK_BODY}
      />

      <ConfirmDialog
        open={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        onConfirm={() => void confirmRemoval()}
        danger
        title={
          pendingRemoval?.role === "teacher" ? "Delete this class?" : "Leave this class?"
        }
        confirmLabel={
          pendingRemoval?.role === "teacher" ? "Delete class" : "Leave class"
        }
        body={
          pendingRemoval?.role === "teacher" ? (
            <>
              <strong>{pendingRemoval?.name}</strong> and everything in it — the
              curriculum, the {pendingRemoval?.studentCount} student
              {pendingRemoval?.studentCount === 1 ? "" : "s"} on the roster, and all of
              their work — will be deleted for everyone. This cannot be undone.
            </>
          ) : (
            <>
              You will come off the roster for <strong>{pendingRemoval?.name}</strong> and
              stop seeing it here. Your work is kept, so being added back brings it back.
            </>
          )
        }
      />
    </DashboardShell>
  );
}
