"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell, type DashboardMode } from "./DashboardShell";
import { getCurrentUser } from "@/lib/auth-client";
import { store } from "@/lib/store";
import type { ClassSummary } from "@/lib/db/types";
import { buildTodosForClasses, type TodoItem } from "@/lib/todos";
import { referenceToday } from "@/lib/demo-seed";
import { classIcon } from "@/lib/class-appearance";
import { cn } from "@/lib/utils";
import { TodoButton } from "@/components/TodoButton";
import { Popover } from "@/components/Popover";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Check,
  Copy,
  CopyPlus,
  Hash,
  Loader2,
  LogOut,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";

export function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?tab=` is how a class page sends you back to the side you came from.
  const requestedTab =
    searchParams.get("tab") === "enrolled"
      ? "enrolled"
      : searchParams.get("tab") === "teaching"
        ? "teaching"
        : null;
  const [mode, setMode] = useState<DashboardMode>(requestedTab ?? "teaching");
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // The class a confirm dialog is currently asking about, if any.
  const [pendingRemoval, setPendingRemoval] = useState<ClassSummary | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.replace("/?auth=login");
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
          referenceToday()
        )
      );

      // With no explicit tab, land on the side the user actually has classes
      // on — a student opening "Teaching" to an empty state reads as a broken
      // account.
      if (
        !requestedTab &&
        !summaries.some((c) => c.role === "teacher") &&
        summaries.some((c) => c.role === "student")
      ) {
        setMode("enrolled");
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router, requestedTab]);

  const filteredClasses = classes.filter((cls) =>
    mode === "teaching" ? cls.role === "teacher" : cls.role === "student"
  );

  function copyCode(classId: string, code: string) {
    navigator.clipboard?.writeText(code);
    setCopiedId(classId);
    setTimeout(() => setCopiedId((id) => (id === classId ? null : id)), 1500);
  }

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

  async function handleDuplicate(classId: string) {
    const user = await getCurrentUser();
    if (!user) return;
    const copy = await store.duplicateClass(classId, user.id);
    if (copy) router.push(`/dashboard/class/${copy.id}`);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");
    setJoining(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("Not logged in");
      const cls = await store.joinClassWithCode(user.id, joinCode);
      router.push(`/dashboard/class/${cls.id}?as=student`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setJoining(false);
    }
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
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {mode === "teaching" ? "Classes you teach" : "Classes you're enrolled in"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {mode === "teaching"
              ? "Create and manage your classes"
              : "Join a class with a code or open one below"}
          </p>
        </div>
        {mode === "teaching" ? (
          <Link
            href="/dashboard/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-medium shrink-0"
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

      {mode === "enrolled" && (
        <form
          onSubmit={handleJoin}
          className="mb-8 flex flex-col sm:flex-row gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          <div className="flex-1 flex items-center gap-2">
            <Hash className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter 6-digit class code to join"
              className="flex-1 bg-transparent text-sm focus:outline-none"
              maxLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={joining || joinCode.length !== 6}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join class"}
          </button>
          {joinError && (
            <p className="text-sm text-rose-600 dark:text-rose-400 sm:col-span-2">{joinError}</p>
          )}
        </form>
      )}

      {filteredClasses.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400">
            {mode === "teaching"
              ? "No classes yet. Create one to get started."
              : "Not enrolled in any classes yet. Join with a class code above."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredClasses.map((cls, i) => {
            // One quiet glyph per card, never a boxed tile — but the teacher
            // picks which glyph and which colour, so six periods are told
            // apart at a glance instead of reading as one grey list.
            const Icon = classIcon(cls.icon, cls.role);

            return (
              // The one place several classes share a page, so the palette
              // is scoped to the card rather than to the document.
              <div
                key={`${cls.id}-${cls.role}`}
                className="relative"
                data-accent={cls.color}
                data-tour={i === 0 ? "class-card" : undefined}
              >
                <Link
                  data-tour={i === 0 ? "class-card-link" : undefined}
                  href={
                    cls.role === "student"
                      ? `/dashboard/class/${cls.id}?as=student`
                      : `/dashboard/class/${cls.id}`
                  }
                  className="flex items-center gap-3.5 p-5 card hover:border-primary/60 transition-colors group"
                >
                  <Icon className="w-5 h-5 shrink-0 text-primary dark:text-primary-glow transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary dark:group-hover:text-primary-glow transition-colors">
                      {cls.name}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""} ·{" "}
                      {cls.subunitCount} subunit{cls.subunitCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                  {/* Room for the code and the buttons, which sit outside the
                      link so clicking them cannot navigate. */}
                  <span
                    className={cn(
                      "hidden sm:block shrink-0",
                      cls.role === "teacher" ? "w-[18rem]" : "w-10"
                    )}
                    aria-hidden
                  />
                </Link>

                <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2">
                  {cls.role === "teacher" && (
                    <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="eyebrow-muted">Class Code</div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono tracking-[0.15em] text-slate-500 dark:text-slate-400">
                          {cls.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyCode(cls.id, cls.code)}
                          title="Copy class code"
                          aria-label="Copy class code"
                          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-primary dark:hover:text-primary-glow hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          {copiedId === cls.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDuplicate(cls.id)}
                      title="Create another class with this curriculum — students and progress are not copied"
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-primary/50 hover:text-primary dark:hover:text-primary-glow transition-colors"
                    >
                      <CopyPlus className="w-3.5 h-3.5" />
                      Duplicate
                    </button>
                    </div>
                  )}

                  {/* One quiet menu per card. The destructive item lives in
                      here rather than on the surface, where a mis-click on the
                      way to opening a class would find it. */}
                  <Popover
                    width={224}
                    align="right"
                    triggerTitle={
                      cls.role === "teacher" ? "Class options" : "Enrolment options"
                    }
                    triggerClassName={(open) =>
                      cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center border transition-colors",
                        open
                          ? "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                    )}
                  </Popover>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              stop seeing it here. Your work is kept, so joining again with the class code
              brings it back.
            </>
          )
        }
      />
    </DashboardShell>
  );
}
