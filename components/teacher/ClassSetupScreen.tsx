"use client";

import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  GraduationCap,
  ListChecks,
  Loader2,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import type { SetupStep } from "@/lib/pending-import";
import { cn } from "@/lib/utils";

/**
 * The whole page while a new Modern Classroom class is being set up: a plain
 * white page, icons turning over in a spinning ring, and the real list of what
 * is happening. Every line of the list is something that actually happened; the
 * icons are only there to show it is alive. Used by the new-class page and, once
 * the class exists, by the class page, so it reads as one screen.
 */

const GLYPHS = [GraduationCap, BookOpen, CalendarDays, ListChecks, ClipboardCheck, Users, Sparkles];

function StepIcon({ state }: { state: SetupStep["state"] }) {
  if (state === "done") return <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  if (state === "run") return <Loader2 className="w-5 h-5 shrink-0 animate-spin text-primary dark:text-primary-glow" />;
  if (state === "fail") return <XCircle className="w-5 h-5 shrink-0 text-rose-500" />;
  return <Circle className="w-5 h-5 shrink-0 text-slate-300 dark:text-slate-600" />;
}

export function ClassSetupScreen({
  steps,
  error,
  actions,
}: {
  steps: SetupStep[];
  /** Stopped short: said in place of "this takes under a minute". */
  error?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-white dark:bg-slate-950">
      <main className="min-h-full flex flex-col items-center justify-center gap-8 px-5 py-10">
        {!error && (
          <div className="setup-stage" aria-hidden>
            <span className="setup-ring" />
            <span className="setup-ring setup-ring-slow" />
            <span className="setup-orbit">
              <span className="setup-dot" />
            </span>
            <span className="setup-orbit setup-orbit-back">
              <span className="setup-dot" />
            </span>
            {GLYPHS.map((Glyph, i) => (
              <Glyph
                key={i}
                className="setup-glyph text-primary dark:text-primary-glow"
                style={{ "--i": i } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        <div className="text-center max-w-md">
          <h1 className="text-2xl sm:text-3xl font-medium tracking-[-0.02em] text-slate-900 dark:text-slate-100">
            {error ? "We couldn't finish setting it up" : "Setting up your Modern Classroom class"}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            {error ?? "This usually takes under a minute. Stay on this page and we'll take you there."}
          </p>
        </div>

        <ul role="status" aria-live="polite" className="w-full max-w-md space-y-2.5">
          {steps.map((step) => (
            <li key={step.key} className="flex items-start gap-3 text-[15px] leading-snug">
              <StepIcon state={step.state} />
              <span
                className={cn(
                  step.state === "wait" && "text-slate-400 dark:text-slate-500",
                  step.state === "run" && "font-medium text-slate-900 dark:text-slate-100",
                  step.state === "done" && "text-slate-700 dark:text-slate-200",
                  step.state === "fail" && "text-rose-700 dark:text-rose-300"
                )}
              >
                {step.text}
              </span>
            </li>
          ))}
        </ul>

        {actions && <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>}
      </main>
    </div>
  );
}
