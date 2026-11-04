"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Attach the new version.",
    body: "We show only what really changed. What you accept reaches Google Classroom by itself, including lessons already posted.",
    caption: "From your new file",
  },
  {
    title: "Edit in Classroom? It stays.",
    body: "Change a title or a date in Google Classroom and it shows here too. It won't be overwritten unless your plan changes that same thing.",
    caption: "Changed in Google Classroom",
  },
  {
    title: "Student work is safe.",
    body: "Take a lesson out of your plan and it leaves Google Classroom only if no student has touched it. If one has, it stays, and we tell you.",
    caption: "Taken out of your plan",
  },
];

const EASE = "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]";

/** The two places, with a pulse travelling between them the way the change goes. */
function Flow({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-300">
      <span>Modern Classroom</span>
      <span className="relative flex-1 h-px bg-slate-200 dark:bg-slate-700">
        <span
          key={step}
          className={cn(
            "absolute -top-[3px] w-[7px] h-[7px] rounded-full bg-primary",
            step === 1 ? "flow-back" : step === 0 ? "flow-on" : "hidden"
          )}
        />
      </span>
      <span>Google Classroom</span>
    </div>
  );
}

function Row({
  number,
  on,
  tone = "primary",
  dim = false,
  children,
}: {
  number: string;
  on: boolean;
  tone?: "primary" | "emerald";
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-[3.25rem]",
        EASE,
        on && "scale-[1.02]",
        on && (tone === "emerald" ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-primary-light/70 dark:bg-primary/15"),
        dim && !on && "opacity-55"
      )}
    >
      <span className="w-7 shrink-0 font-mono text-[11px] text-slate-400">{number}</span>
      {children}
    </div>
  );
}

/** A piece of a curriculum, showing whichever thing is happening to it. */
function ChangeMock({ step }: { step: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5" aria-hidden>
      <Flow step={step} />

      <div className="mt-4 space-y-1.5">
        <Row number="3.3" on={step === 0}>
          <span className="flex-1 min-w-0 truncate text-sm text-slate-800 dark:text-slate-100">Line of Best Fit</span>
          <span className="shrink-0 text-xs tabular-nums">
            <span className="text-slate-400 line-through">10/14</span>
            <span className="ml-1.5 font-medium text-emerald-700 dark:text-emerald-400">10/16</span>
          </span>
        </Row>

        <Row number="" on={step === 1}>
          <span className="relative flex-1 min-w-0 h-5 text-sm text-slate-800 dark:text-slate-100">
            <span className={cn("absolute inset-0 truncate", EASE, step < 1 ? "opacity-100" : "opacity-0 -translate-y-2")}>
              Quiz 3A
            </span>
            <span className={cn("absolute inset-0 truncate", EASE, step >= 1 ? "opacity-100" : "opacity-0 translate-y-2")}>
              Quiz 3A, Moved to Friday
            </span>
          </span>
          <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">10/15</span>
        </Row>

        <Row number="3.4" on={false} dim>
          <span className="flex-1 min-w-0 truncate text-sm text-slate-800 dark:text-slate-100">Median-Median Line</span>
          <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">10/19</span>
        </Row>

        <Row number="3.5" on={step === 2} tone="emerald">
          <span
            className={cn(
              "flex-1 min-w-0 truncate text-sm text-slate-800 dark:text-slate-100",
              EASE,
              step === 2 && "line-through decoration-slate-400"
            )}
          >
            Residuals & RMSE
          </span>
          <span
            className={cn(
              "shrink-0 inline-flex items-center gap-1 overflow-hidden whitespace-nowrap text-xs font-medium text-emerald-700 dark:text-emerald-400",
              EASE,
              // Takes no room until it appears, so the title isn't cut short for nothing.
              step === 2 ? "max-w-40 opacity-100" : "max-w-0 opacity-0 translate-x-2"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            Kept
            <span className="hidden sm:inline">: 3 Have Work</span>
          </span>
        </Row>
      </div>

      <div className="relative mt-4 h-5 text-xs text-slate-500 dark:text-slate-400">
        {STEPS.map((s, i) => (
          <span
            key={s.caption}
            className={cn(
              "absolute inset-0 inline-flex items-center gap-1.5",
              EASE,
              i === step ? "opacity-100" : "opacity-0 translate-y-1"
            )}
          >
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            {s.caption}
          </span>
        ))}
      </div>
    </div>
  );
}

const HEADING = (
  <h2 className="text-[1.75rem] sm:text-5xl font-medium tracking-[-0.035em] leading-[1.12] text-slate-900 dark:text-slate-100">
    Plans change in November. Your class keeps up.
  </h2>
);

/**
 * What happens after the first day, told once rather than in three boxes: the
 * panel stays put while the page scrolls, the words step along, and one small
 * curriculum on the right shows each change happening. On a phone there is no
 * room to pin it, so the same scene follows the words and steps by itself.
 */
export function ChangeScene() {
  const track = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [phoneStep, setPhoneStep] = useState(0);

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      const node = track.current;
      if (!node) return;
      const box = node.getBoundingClientRect();
      const travel = Math.max(1, box.height - window.innerHeight);
      const progress = Math.min(0.999, Math.max(0, -box.top / travel));
      setStep(Math.floor(progress * STEPS.length));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    paint();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setPhoneStep((i) => (i + 1) % STEPS.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      {/* Wide screens: pinned while the page travels the height of this track. */}
      <div ref={track} className="hidden lg:block h-[280vh]">
        <div className="sticky top-[4.5rem] h-[calc(100vh-5.25rem)] pb-3">
          <div className="scene-panel relative overflow-hidden h-full rounded-3xl">
            <span aria-hidden className="scene-orb scene-orb-a" />
            <span aria-hidden className="scene-orb scene-orb-b" />
            <div className="relative h-full max-w-6xl mx-auto px-10 grid grid-cols-2 gap-16 items-center">
              <div>
                {HEADING}
                {/* Tall enough for its longest step, so the heading above never shifts. */}
                <ol className="mt-10 space-y-6 min-h-[13.5rem]">
                  {STEPS.map((s, i) => (
                    <li key={s.title} className="relative pl-5">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
                          EASE,
                          i === step ? "bg-primary" : "bg-slate-300/60 dark:bg-slate-700"
                        )}
                      />
                      <h3
                        className={cn(
                          "text-xl font-medium",
                          EASE,
                          i === step ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        {s.title}
                      </h3>
                      <div
                        className={cn(
                          "grid",
                          EASE,
                          i === step ? "grid-rows-[1fr] opacity-100 mt-1.5" : "grid-rows-[0fr] opacity-0"
                        )}
                      >
                        <p className="overflow-hidden text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                          {s.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <ChangeMock step={step} />
            </div>
          </div>
        </div>
      </div>

      {/* Phones and narrow screens: everything shown, the scene steps by itself. */}
      <div className="lg:hidden scene-panel relative overflow-hidden rounded-3xl px-5 py-12 sm:px-8">
        <span aria-hidden className="scene-orb scene-orb-a" />
        <div className="relative">
          {HEADING}
          <div className="mt-8">
            <ChangeMock step={phoneStep} />
          </div>
          <div className="mt-8 space-y-6">
            {STEPS.map((s) => (
              <div key={s.title}>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{s.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
