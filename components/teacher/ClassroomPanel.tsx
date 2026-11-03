"use client";

import { CheckCircle2, ExternalLink, GraduationCap, Loader2, Send } from "lucide-react";
import type { PostingRule } from "@/lib/classroom/plan";
import type { ClassroomConnection } from "@/lib/use-classroom";
import { Select } from "@/components/Select";
import { cn } from "@/lib/utils";

const RULES: { value: PostingRule; label: string; hint: string }[] = [
  { value: "lesson_day", label: "On the lesson day", hint: "Each lesson appears the morning of its date." },
  { value: "unit_start", label: "When the unit starts", hint: "A whole unit appears on its first lesson's date." },
];

/**
 * The Google Classroom card at the top of the Curriculum tab. Written for a
 * teacher who is not at home in software, like the file upload card beside
 * it: every step is a sentence and a large labelled button.
 *
 *   not connected → one button, "Connect Google Classroom"
 *   connected     → which Classroom class this is, when lessons appear, and
 *                   "Post to Google Classroom"
 *
 * To change when something appears, the teacher changes its date.
 */
export function ClassroomPanel({ classroom }: { classroom: ClassroomConnection }) {
  const { status, posting, lastPost, error } = classroom;
  if (status.state === "unavailable") return null;

  if (status.state === "loading") {
    return (
      <section className="card px-5 py-5 cq-sm:px-6 flex items-center gap-4 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
        <span className="text-[15px]">Checking Google Classroom…</span>
      </section>
    );
  }

  if (status.state === "disconnected") {
    return (
      <section className="card px-5 py-5 cq-sm:px-6 flex flex-col cq-sm:flex-row cq-sm:items-center gap-4">
        <GraduationCap className="w-10 h-10 shrink-0 text-primary dark:text-primary-glow" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Post your curriculum to Google Classroom
          </h3>
          <p className="mt-1 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            Connect your Google account once, and we&apos;ll put your units and lessons in Google
            Classroom for you, on your schedule.
          </p>
        </div>
        <a href={classroom.connectHref()} className="btn btn-lg btn-primary shrink-0">
          <GraduationCap className="w-5 h-5" />
          Connect Google Classroom
        </a>
      </section>
    );
  }

  const course = status.courses.find((c) => c.id === status.courseId);
  const { posted, scheduled } = status.counts;
  const anything = posted + scheduled > 0;

  return (
    <section className="card px-5 py-5 cq-sm:px-6 space-y-5">
      <div className="flex flex-col cq-sm:flex-row cq-sm:items-start gap-4">
        <GraduationCap className="w-10 h-10 shrink-0 text-primary dark:text-primary-glow" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Google Classroom</h3>
          <p className="mt-1 text-[15px] text-slate-600 dark:text-slate-300">
            Connected{status.email ? ` as ${status.email}` : ""}.{" "}
            <button
              type="button"
              onClick={() => void classroom.disconnect()}
              className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Disconnect
            </button>
          </p>
        </div>
      </div>

      {/* 1 — which Classroom class this is. Chosen once: its posts live there. */}
      <div className="space-y-2">
        <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
          Which Google Classroom class is this?
        </p>
        {course ? (
          <p className="text-[15px] text-slate-700 dark:text-slate-200">
            {course.name}
            {course.section ? ` · ${course.section}` : ""}
          </p>
        ) : status.courses.length === 0 ? (
          <p className="text-[15px] text-slate-600 dark:text-slate-300">
            You don&apos;t teach any Google Classroom classes on this account yet. Create one at{" "}
            <a
              href="https://classroom.google.com"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              classroom.google.com
              <ExternalLink className="inline w-3.5 h-3.5 ml-0.5 -mt-0.5" aria-hidden />
            </a>
            , then come back.
          </p>
        ) : (
          <Select
            value=""
            placeholder="Choose a class…"
            options={status.courses.map((c) => ({
              value: c.id,
              label: c.section ? `${c.name} · ${c.section}` : c.name,
            }))}
            onChange={(courseId) => void classroom.save({ courseId })}
            className="max-w-md"
          />
        )}
      </div>

      {/* 2 — when lessons appear. */}
      {course && (
        <div className="space-y-2">
          <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
            When should students see each lesson?
          </p>
          <div role="radiogroup" className="grid gap-2 cq-md:grid-cols-2">
            {RULES.map((rule) => {
              const selected = status.postingRule === rule.value;
              return (
                <button
                  key={rule.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => void classroom.save({ postingRule: rule.value })}
                  className={cn(
                    "text-left rounded-xl border px-4 py-3 transition-colors",
                    selected
                      ? "border-primary bg-primary-light/60 dark:bg-primary/10"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  )}
                >
                  <span className="flex items-center gap-2 text-[15px] font-medium text-slate-900 dark:text-slate-100">
                    {selected && <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden />}
                    {rule.label}
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-slate-600 dark:text-slate-400">
                    {rule.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3 — post. */}
      {course && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void classroom.post()}
            disabled={posting}
            aria-busy={posting}
            className="btn btn-lg btn-primary"
          >
            {posting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Posting to Google Classroom…
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {anything ? "Update Google Classroom" : "Post to Google Classroom"}
              </>
            )}
          </button>
          <p className="text-[15px] text-slate-600 dark:text-slate-300">
            {lastPost && !posting
              ? lastPost.created + lastPost.updated + lastPost.removed === 0 && lastPost.failed === 0
                ? "Everything is already in Google Classroom."
                : `Done — ${lastPost.created} added, ${lastPost.updated} updated${
                    lastPost.removed ? `, ${lastPost.removed} extra copies removed` : ""
                  }${lastPost.failed ? `, ${lastPost.failed} couldn't be sent` : ""}.`
              : anything
                ? `${posted} posted · ${scheduled} scheduled`
                : "Nothing is in Google Classroom yet."}
          </p>
        </div>
      )}

      {error && <p className="text-[15px] text-red-700 dark:text-red-400">{error}</p>}
    </section>
  );
}
