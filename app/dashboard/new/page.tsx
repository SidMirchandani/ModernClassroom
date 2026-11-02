"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavbar } from "@/components/AppNavbar";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { FileDrop, MAX_UPLOAD_MB, totalMegabytes } from "@/components/teacher/FileDrop";
import { getCurrentUser } from "@/lib/auth-client";
import { setPendingImport } from "@/lib/pending-import";
import { store } from "@/lib/store";
import { usePageTitle } from "@/lib/use-page-title";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, FileUp, Loader2, PencilLine } from "lucide-react";

/**
 * Starting a class, as numbered steps anyone can follow: name it, then
 * choose how to start — from the teacher's own plan (upload it and we set it
 * up), or blank (type the units in by hand). One large button finishes it.
 *
 * The draft is made in the new class's own Curriculum tab rather than here:
 * the import route only reads for a class that exists and that the caller
 * teaches, and the tab is where every proposal is reviewed anyway. So this
 * page creates the class empty, hands the files over (`setPendingImport`) and
 * moves there, where the read starts on arrival. Nothing reaches the class
 * until the teacher approves it.
 */

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 shrink-0 rounded-full bg-primary text-white inline-flex items-center justify-center text-[15px] font-medium">
        {n}
      </span>
      <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">{children}</h2>
    </div>
  );
}

function Choice({
  selected,
  onClick,
  icon,
  title,
  body,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "text-left rounded-2xl p-5 transition-colors",
        selected
          ? "border-2 border-primary bg-primary/5 dark:bg-primary/10"
          : "border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      )}
    >
      {icon}
      <p className="mt-3 text-base font-medium text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
    </button>
  );
}

export default function NewClassPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  usePageTitle("New class", "Teaching");
  const [name, setName] = useState("");
  const [start, setStart] = useState<"plan" | "blank" | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) {
        router.replace("/?auth=login");
        return;
      }
      setReady(true);
    });
  }, [router]);

  async function create() {
    const user = await getCurrentUser();
    if (!user || !start) return;
    setCreating(true);
    setError("");
    try {
      const fromPlan = start === "plan";
      const cls = await store.createClassForTeacher(user.id, { name, blank: fromPlan });
      if (fromPlan) {
        setPendingImport(cls.id, { files, instructions: notes.trim() });
        router.push(`/dashboard/class/${cls.id}?view=curriculum`);
      } else {
        router.push(`/dashboard/class/${cls.id}?view=curriculum`);
      }
    } catch {
      setCreating(false);
      setError("The class could not be created — check your connection and try again.");
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const tooLarge = totalMegabytes(files) > MAX_UPLOAD_MB;
  const canCreate =
    name.trim() !== "" && start !== null && (start === "blank" || (files.length > 0 && !tooLarge)) && !creating;
  // What is still needed, said plainly next to the disabled button.
  const missing =
    name.trim() === ""
      ? "Give your class a name first."
      : start === null
        ? "Choose how you'd like to start."
        : start === "plan" && files.length === 0
          ? "Choose your file to continue."
          : "";

  return (
    <div className="min-h-screen flex flex-col">
      <AppNavbar
        sticky
        left={
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard?tab=teaching"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
            <Logo size={24} showText={false} />
          </div>
        }
        right={
          <>
            <ThemeToggle />
            <ProfileMenu />
          </>
        }
      />

      <main className="page-in flex-1 max-w-2xl mx-auto w-full px-5 sm:px-6 py-10 sm:py-14 space-y-10">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] leading-[1.1] text-slate-900 dark:text-slate-100">
          New class
        </h1>

        <section className="space-y-3">
          <Step n={1}>Name your class</Step>
          <input
            type="text"
            value={name}
            disabled={creating}
            aria-label="Class name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Class name"
            className="w-full h-14 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-lg placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </section>

        <section className="space-y-4">
          <Step n={2}>How would you like to start?</Step>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              selected={start === "plan"}
              onClick={() => setStart("plan")}
              icon={<FileUp className="w-8 h-8 text-primary dark:text-primary-glow" />}
              title="From my plan"
              body="Upload your pacing guide or calendar and we'll set the class up for you. You'll check it before anything is saved."
            />
            <Choice
              selected={start === "blank"}
              onClick={() => setStart("blank")}
              icon={<PencilLine className="w-8 h-8 text-slate-500 dark:text-slate-400" />}
              title="Start blank"
              body="Type in your units and subunits yourself. You can upload a plan later."
            />
          </div>

          {start === "plan" && (
            <div className="fade-in space-y-4 pt-2">
              <FileDrop files={files} onFilesChange={setFiles} disabled={creating} />
              {files.length > 0 && (
                <label className="block space-y-1.5">
                  <span className="text-[15px] font-medium text-slate-800 dark:text-slate-100">
                    Anything we should know? <span className="font-normal text-slate-500">(optional)</span>
                  </span>
                  <textarea
                    rows={2}
                    value={notes}
                    disabled={creating}
                    onChange={(e) => setNotes(e.target.value)}
                    className="block w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-[15px] leading-relaxed focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              )}
            </div>
          )}
        </section>

        <section className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => void create()}
            aria-busy={creating}
            className="btn btn-lg btn-primary mt-6"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {start === "plan" ? "Create my class and read my plan" : "Create my class"}
            {!creating && <ArrowRight className="w-5 h-5" />}
          </button>
          {missing && <span className="sm:mt-6 text-[15px] text-slate-500 dark:text-slate-400">{missing}</span>}
        </section>

        {error && (
          <p className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-[15px] text-rose-800 dark:text-rose-200">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
