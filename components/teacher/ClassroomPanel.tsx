"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, GraduationCap, Loader2, TriangleAlert } from "lucide-react";
import type { PostingRule } from "@/lib/classroom/plan";
import type { ClassroomConnection } from "@/lib/use-classroom";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Select } from "@/components/Select";
import { cn } from "@/lib/utils";
import { ActionCard } from "./ActionCard";

const RULES: { value: PostingRule; label: string; hint: string }[] = [
  { value: "lesson_day", label: "On the lesson day", hint: "Each lesson appears the morning of its date." },
  { value: "unit_start", label: "When the unit starts", hint: "A whole unit appears on its first lesson's date." },
];

export const UNLINK_BODY =
  "Everything already posted stays in Google Classroom, and students' work isn't touched. Nothing new will be sent there, and you won't see its students here. You can link the same class again and carry on where you left off.";

/**
 * The Google Classroom card at the top of the Curriculum tab. Written for a
 * teacher who is not at home in software:
 *
 *   not connected → one button, "Connect Google Classroom"
 *   connected     → which Classroom class this is, when lessons appear, and a
 *                   line saying where things stand
 *
 * There is no button to post. It happens by itself, so nobody can forget it;
 * the only thing left to press is "Try again", and only after it has failed.
 */
export function ClassroomPanel({ classroom }: { classroom: ClassroomConnection }) {
  const { status, syncing, syncFailed, error } = classroom;
  const [unlinking, setUnlinking] = useState(false);
  if (status.state === "unavailable") return null;

  if (status.state === "loading") {
    return (
      <ActionCard icon={GraduationCap}>
        <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Checking Google Classroom…
        </span>
      </ActionCard>
    );
  }

  if (status.state === "disconnected") {
    return (
      <ActionCard
        icon={GraduationCap}
        title="Post your curriculum to Google Classroom"
        action={
          <a href={classroom.connectHref()} className="btn btn-lg btn-primary">
            Connect Google Classroom
          </a>
        }
      >
        Connect your Google account once, and we&apos;ll put your units and lessons in Google Classroom for you, on
        your schedule.
      </ActionCard>
    );
  }

  const course = status.courses.find((c) => c.id === status.courseId);
  const { posted, scheduled, kept = 0 } = status.counts;

  return (
    <ActionCard
      icon={GraduationCap}
      title="Google Classroom"
      working={syncing}
      below={
        <>
          {/* 1 — which Classroom class this is. Its posts live there, so changing
              it means unlinking first. */}
          <div className="space-y-2">
            <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
              Which Google Classroom class is this?
            </p>
            {course ? (
              <p className="text-[15px] text-slate-700 dark:text-slate-200">
                {course.alternateLink ? (
                  <a
                    href={course.alternateLink}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-glow"
                  >
                    {course.name}
                    {course.section ? ` · ${course.section}` : ""}
                    <ExternalLink className="inline w-3.5 h-3.5 ml-1 -mt-0.5" aria-hidden />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <>
                    {course.name}
                    {course.section ? ` · ${course.section}` : ""}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setUnlinking(true)}
                  className="ml-3 text-sm text-slate-500 dark:text-slate-400 underline underline-offset-2 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  Unlink
                </button>
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
                  disabled: c.linked,
                  hint: c.linked ? "Already linked to another class" : undefined,
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

          {/* 3 — where things stand. Nothing to press unless it failed. */}
          {course && !error && (
            <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px]">
              {syncing ? (
                <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Updating Google Classroom…
                </span>
              ) : syncFailed ? (
                <>
                  <span className="inline-flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <TriangleAlert className="w-4 h-4 shrink-0" aria-hidden />
                    Some lessons haven&apos;t reached Google Classroom yet.
                  </span>
                  <button type="button" onClick={classroom.retrySync} className="btn btn-md btn-secondary">
                    Try again
                  </button>
                </>
              ) : posted + scheduled > 0 ? (
                <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
                  Up to date · {posted} posted · {scheduled} scheduled
                </span>
              ) : (
                <span className="text-slate-600 dark:text-slate-300">
                  Your lessons will appear here once your curriculum is saved.
                </span>
              )}
            </div>
          )}

          {kept > 0 && (
            <p className="text-[15px] text-slate-600 dark:text-slate-300">
              {kept === 1 ? "1 item" : `${kept} items`} you took out of your curriculum stayed in Google Classroom,
              because students have work on {kept === 1 ? "it" : "them"}. You can delete {kept === 1 ? "it" : "them"} there
              if you want to.
            </p>
          )}

          {error && <p className="text-[15px] text-red-700 dark:text-red-400">{error}</p>}

          <ConfirmDialog
            open={unlinking}
            onClose={() => setUnlinking(false)}
            onConfirm={() => void classroom.unlink()}
            title="Unlink this Google Classroom class?"
            confirmLabel="Unlink"
            body={UNLINK_BODY}
          />
        </>
      }
    >
      Connected{status.email ? ` as ${status.email}` : ""}.{" "}
      <button
        type="button"
        onClick={() => void classroom.disconnect()}
        className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-slate-100"
      >
        Disconnect
      </button>
    </ActionCard>
  );
}
