"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell, type DashboardMode } from "./DashboardShell";
import type { ClassSummary } from "@/lib/db/types";
import {
  GraduationCap,
  LayoutGrid,
  Plus,
  Loader2,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardClient() {
  const router = useRouter();
  const [mode, setMode] = useState<DashboardMode>("teaching");
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (!meData.user) {
        router.replace("/?auth=login");
        return;
      }

      const clsRes = await fetch("/api/classes");
      const clsData = await clsRes.json();
      setClasses(clsData.classes ?? []);
      setLoading(false);
    }
    load();
  }, [router]);

  const filteredClasses = classes.filter((cls) =>
    mode === "teaching" ? cls.role === "teacher" : cls.role === "student"
  );

  async function handleCreateClass() {
    const res = await fetch("/api/classes", { method: "POST" });
    const data = await res.json();
    if (data.class) {
      router.push(`/dashboard/class/${data.class.id}`);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");
    setJoining(true);
    try {
      const res = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to join");
      router.push(`/dashboard/class/${data.class.id}`);
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
        {mode === "teaching" && (
          <button
            type="button"
            onClick={handleCreateClass}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium shrink-0"
          >
            <Plus className="w-4 h-4" />
            New class
          </button>
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
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join class"}
          </button>
          {joinError && (
            <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{joinError}</p>
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
          {filteredClasses.map((cls) => (
            <Link
              key={cls.id}
              href={`/dashboard/class/${cls.id}`}
              className="flex items-center gap-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 transition-colors group"
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  cls.role === "teacher"
                    ? "bg-violet-50 dark:bg-violet-950"
                    : "bg-blue-50 dark:bg-blue-950"
                )}
              >
                {cls.role === "teacher" ? (
                  <LayoutGrid className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                ) : (
                  <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {cls.name}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""} ·{" "}
                  {cls.subunitCount} subunit{cls.subunitCount !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="text-xs font-mono text-slate-400 dark:text-slate-600 hidden sm:block">
                {cls.code}
              </div>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
