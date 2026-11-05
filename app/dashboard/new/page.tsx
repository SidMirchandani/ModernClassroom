"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavbar } from "@/components/AppNavbar";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { IconTile } from "@/components/teacher/ActionCard";
import { ClassSetupScreen } from "@/components/teacher/ClassSetupScreen";
import { FileDrop, MAX_UPLOAD_MB, totalMegabytes } from "@/components/teacher/FileDrop";
import { getCurrentUser, SIGNED_OUT_HOME } from "@/lib/auth-client";
import { setPendingImport, type SetupStep } from "@/lib/pending-import";
import { store } from "@/lib/store";
import type { CurriculumUnit } from "@/lib/db/types";
import { usePageTitle } from "@/lib/use-page-title";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, CheckCircle2, FileUp, GraduationCap, Loader2, PencilLine, Plus } from "lucide-react";

/**
 * Starting a class, as numbered steps anyone can follow. First, where it
 * lives: a brand-new class, or one the teacher already has in Google
 * Classroom (it takes that class's name, and its lessons are posted there).
 * Then name it. A brand-new class then chooses what goes in it — the teacher's
 * own plan (upload it and we set it up), or blank. A Google Classroom class has
 * nothing to choose: everything in it becomes its curriculum, with no AI, and
 * nothing to approve since it is the teacher's own already. One large button
 * finishes it, and the setup screen takes the whole page from there.
 *
 * A plan's draft is made in the new class's own Curriculum tab rather than here:
 * the import route only reads for a class that exists and that the caller
 * teaches, and the tab is where every proposal is reviewed anyway. So this
 * page creates the class empty, hands the files over (`setPendingImport`) and
 * moves there, where the read starts on arrival. Nothing from a plan reaches the
 * class until the teacher approves it.
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
        "flex flex-col items-start text-left rounded-2xl p-5 transition-colors",
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

interface GoogleCourse {
  id: string;
  name: string;
  section?: string;
  /** Another of this teacher's classes already posts into it. */
  linked: boolean;
}

type GoogleState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "disconnected" }
  | { state: "connected"; email: string | null; courses: GoogleCourse[] }
  | { state: "error" };

export default function NewClassPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  usePageTitle("New class", "Teaching");
  const [name, setName] = useState("");
  const [source, setSource] = useState<"new" | "google" | null>(null);
  // How a trip to Google's permission page ended, when it did not connect.
  const [googleOutcome, setGoogleOutcome] = useState<string | null>(null);
  const [google, setGoogle] = useState<GoogleState>({ state: "idle" });
  const [courseId, setCourseId] = useState<string | null>(null);
  const [start, setStart] = useState<"plan" | "blank" | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [steps, setSteps] = useState<SetupStep[]>([]);
  const [error, setError] = useState("");
  // Made already, so Try again carries on rather than making a second class.
  const created = useRef<{ id: string; version?: number } | null>(null);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) {
        router.replace(SIGNED_OUT_HOME);
        return;
      }
      // Back from connecting Google, the page picks up where it was.
      if (new URLSearchParams(window.location.search).get("from") === "google") {
        setSource("google");
        setGoogleOutcome(new URLSearchParams(window.location.search).get("google"));
      }
      setReady(true);
    });
  }, [router]);

  useEffect(() => {
    if (!ready || source !== "google" || google.state !== "idle") return;
    setGoogle({ state: "loading" });
    fetch("/api/google")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body) =>
        setGoogle(
          body.connected
            ? { state: "connected", email: body.email, courses: body.courses }
            : { state: "disconnected" }
        )
      )
      .catch(() => setGoogle({ state: "error" }));
  }, [ready, source, google.state]);

  function chooseCourse(course: GoogleCourse) {
    setCourseId(course.id);
    // Its Classroom name, unless the teacher has typed one of their own.
    const named = google.state === "connected" && google.courses.some((c) => c.name === name);
    if (name.trim() === "" || named) setName(course.name);
  }

  /** Writes through a local list as well, for the hand-off in the same run. */
  function stepper() {
    let list: SetupStep[] = [];
    const set = (key: string, text: string, state: SetupStep["state"]) => {
      const next = { key, text, state };
      list = list.some((s) => s.key === key) ? list.map((s) => (s.key === key ? next : s)) : [...list, next];
      setSteps(list);
    };
    return { set, list: () => list };
  }

  /** Answers or says why not, in words for the setup screen. */
  async function classroomCall(path: string, body: object): Promise<Record<string, unknown>> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const answer = await res.json().catch(() => ({}));
    if (answer.needsReconnect) {
      throw new Error("We need your permission again. Go to your class and reconnect Google Classroom.");
    }
    if (!res.ok) throw new Error(answer.error ?? "We couldn't reach Google Classroom. Try again in a minute.");
    return answer;
  }

  async function create() {
    const user = await getCurrentUser();
    if (!user) return;
    setCreating(true);
    setError("");
    const { set, list } = stepper();
    let step = "create";
    try {
      set("create", "Creating your Modern Classroom class", "run");
      // Always empty: a placeholder unit could not be edited, only replaced.
      created.current ??= await store.createClassForTeacher(user.id, { name, blank: true });
      const classId = created.current.id;
      set("create", "Created your Modern Classroom class", "done");

      if (source === "google" && courseId) {
        const course = google.state === "connected" ? google.courses.find((c) => c.id === courseId) : undefined;
        const title = course?.name ?? "your Google Classroom class";

        step = "link";
        set("link", `Linking it to ${title}`, "run");
        await classroomCall("/api/classroom", { classId, courseId });
        set("link", `Linked it to ${title}`, "done");

        step = "read";
        set("read", "Looking through your Google Classroom class", "run");
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const found = await classroomCall("/api/classroom/import", { classId, timeZone });
        const items = Number(found.items ?? 0);
        const topics = Number(found.topics ?? 0);
        set(
          "read",
          items === 0
            ? "Nothing has been posted in your Google Classroom class yet"
            : `Found ${items} ${items === 1 ? "item" : "items"} in ${topics} ${topics === 1 ? "topic" : "topics"}`,
          "done"
        );

        step = "students";
        set("students", "Bringing in your students", "run");
        const pulled = await classroomCall("/api/classroom/pull", { classId });
        const students = Number(pulled.students ?? 0);
        set("students", `Brought in ${students} ${students === 1 ? "student" : "students"}`, "done");

        if (items === 0) {
          // Long enough to see why the class is empty.
          await new Promise((resolve) => setTimeout(resolve, 1800));
          router.push(`/dashboard/class/${classId}`);
          return;
        }

        step = "build";
        set("build", "Building your curriculum", "run");
        const units = found.units as CurriculumUnit[];
        await store.applyCurriculum(classId, units, [], created.current.version ?? null);
        set("build", `Built your curriculum: ${units.length} ${units.length === 1 ? "unit" : "units"}`, "done");
      } else if (start === "plan") {
        setPendingImport(classId, { files, instructions: notes.trim(), steps: list() });
      }
      router.push(`/dashboard/class/${classId}?view=curriculum`);
    } catch (err) {
      const stage = list().find((s) => s.key === step);
      if (stage) set(step, stage.text, "fail");
      setError(
        step === "create"
          ? "Your Modern Classroom class could not be created — check your connection and try again."
          : err instanceof Error
            ? err.message
            : "We couldn't reach Google Classroom. Try again in a minute."
      );
    }
  }

  if (creating) {
    return (
      <ClassSetupScreen
        steps={steps}
        error={error || undefined}
        actions={
          error ? (
            <>
              {created.current && (
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/class/${created.current?.id}`)}
                  className="btn btn-lg btn-secondary"
                >
                  Go to my class
                </button>
              )}
              <button type="button" onClick={() => void create()} className="btn btn-lg btn-primary">
                Try again
              </button>
            </>
          ) : undefined
        }
      />
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const tooLarge = totalMegabytes(files) > MAX_UPLOAD_MB;
  const needsCourse = source === "google" && courseId === null;
  // Only a brand-new class has a start to choose; one picked and then
  // abandoned for Google Classroom counts for nothing.
  const startReady = source === "google" || start === "blank" || (start === "plan" && files.length > 0 && !tooLarge);
  const canCreate = source !== null && !needsCourse && name.trim() !== "" && startReady && !creating;
  // What is still needed, said plainly next to the disabled button.
  // (The button only shows once the class's home is settled.)
  const missing =
    name.trim() === ""
      ? "Give your Modern Classroom class a name first."
      : source === "google"
        ? ""
        : start === null
          ? "Choose how you'd like to start."
          : start === "plan" && files.length === 0
            ? "Choose your file to continue."
            : "";
  // Steps are numbered as they appear: the Google path has one more.
  const step = (n: number) => (source === "google" ? n + 1 : n);
  const connectHref = `/api/google/connect?returnTo=${encodeURIComponent("/dashboard/new?from=google")}`;

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
          New Modern Classroom class
        </h1>

        <section className="space-y-4">
          <Step n={1}>How do you want to start your Modern Classroom class?</Step>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              selected={source === "new"}
              onClick={() => setSource("new")}
              icon={<IconTile icon={Plus} />}
              title="Create a new Modern Classroom class"
              body="Start from scratch. You can link it to a Google Classroom class later."
            />
            <Choice
              selected={source === "google"}
              onClick={() => setSource("google")}
              icon={<IconTile icon={GraduationCap} />}
              title="Use my Google Classroom class"
              body="Pick a Google Classroom class you already teach. Its topics and assignments become your curriculum, and your students come with it."
            />
          </div>
        </section>

        {source === "google" && (
          <section className="fade-in space-y-4">
            <Step n={2}>Choose your Google Classroom class</Step>
            {google.state === "loading" || google.state === "idle" ? (
              <p className="flex items-center gap-2 text-[15px] text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Looking at your Google Classroom…
              </p>
            ) : google.state === "disconnected" ? (
              <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-5 space-y-4">
                {(googleOutcome === "declined" || googleOutcome === "failed") && (
                  <p className="rounded-xl bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-[15px] text-amber-900 dark:text-amber-100">
                    {googleOutcome === "declined"
                      ? "Google Classroom wasn't connected. On Google's page, choose Continue and tick every box, then Continue again."
                      : "Something went wrong connecting Google Classroom. Please try again."}
                  </p>
                )}
                <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                  Connect your Google account once, and we&apos;ll show you the classes you teach in Google Classroom.
                </p>
                <a href={connectHref} className="btn btn-lg btn-primary">
                  Connect Google Classroom
                </a>
              </div>
            ) : google.state === "error" ? (
              <p className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-[15px] text-rose-800 dark:text-rose-200">
                We couldn&apos;t reach Google Classroom just now. Try again in a minute, or create a new Modern Classroom
                class instead.
              </p>
            ) : google.courses.length === 0 ? (
              <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                You don&apos;t teach any Google Classroom classes on {google.email ?? "this account"} yet. Create one
                at classroom.google.com, then come back, or create a new Modern Classroom class instead.
              </p>
            ) : (
              <div className="space-y-2">
                {google.courses.map((course) => {
                  const selected = courseId === course.id;
                  return (
                    <button
                      key={course.id}
                      type="button"
                      disabled={course.linked || creating}
                      onClick={() => chooseCourse(course)}
                      aria-pressed={selected}
                      className={cn(
                        "w-full flex items-center gap-3 text-left rounded-xl px-4 py-3 border-2 transition-colors",
                        selected
                          ? "border-primary bg-primary/5 dark:bg-primary/10"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
                        course.linked && "opacity-60 cursor-not-allowed hover:border-slate-200"
                      )}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-base font-medium text-slate-900 dark:text-slate-100">
                          {course.name}
                        </span>
                        {(course.section || course.linked) && (
                          <span className="block text-sm text-slate-500 dark:text-slate-400">
                            {course.linked ? "Already linked to another Modern Classroom class" : course.section}
                          </span>
                        )}
                      </span>
                      {selected && <CheckCircle2 className="w-5 h-5 shrink-0 text-primary" aria-hidden />}
                    </button>
                  );
                })}
                {google.email && <p className="text-sm text-slate-500 dark:text-slate-400">From {google.email}</p>}
              </div>
            )}
          </section>
        )}

        {/* The rest appears once the first choice is made, one step at a time. */}
        {source !== null && !needsCourse && (
          <>
            <section className="fade-in space-y-3">
              <Step n={step(2)}>Name your Modern Classroom class</Step>
              <input
                type="text"
                value={name}
                disabled={creating}
                aria-label="Modern Classroom class name"
                onChange={(e) => setName(e.target.value)}
                placeholder="Modern Classroom class name"
                className="w-full h-14 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-lg placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </section>

            {source === "new" && (
              <section className="space-y-4">
                <Step n={3}>What should go in your Modern Classroom class?</Step>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Choice
                    selected={start === "plan"}
                    onClick={() => setStart("plan")}
                    icon={<IconTile icon={FileUp} />}
                    title="From my plan"
                    body="Upload your pacing guide or calendar and we'll set it up for you. You'll check it before anything is saved."
                  />
                  <Choice
                    selected={start === "blank"}
                    onClick={() => setStart("blank")}
                    icon={<IconTile icon={PencilLine} />}
                    title="Start blank"
                    body="Create it now, and upload your plan on its Curriculum tab when you're ready."
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
            )}

            <section className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={!canCreate}
                onClick={() => void create()}
                aria-busy={creating}
                className="btn btn-lg btn-primary mt-6"
              >
                {source === "new" && start === "plan"
                  ? "Create my Modern Classroom class and read my plan"
                  : "Create my Modern Classroom class"}
                <ArrowRight className="w-5 h-5" />
              </button>
              {missing && <span className="sm:mt-6 text-[15px] text-slate-500 dark:text-slate-400">{missing}</span>}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
