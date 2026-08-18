"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Compass, GraduationCap, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { seedDemo } from "@/lib/demo-seed";
import { endTour, startTour } from "@/lib/tour";

/**
 * The only demo entry point. It seeds the real store with one account that both
 * teaches and sits in three courses from the timeline sheet, eight classmates,
 * and their progress — then drops you into the actual product. There is no
 * separate demo UI to drift out of sync.
 *
 * It asks one question first, because the two people who arrive here want
 * opposite things: someone who has never seen the app needs to be shown where
 * anything is, and someone who has needs to be left alone.
 */
export default function DemoPage() {
  const router = useRouter();
  const [entering, setEntering] = useState(false);

  function enter(withTour: boolean) {
    setEntering(true);
    seedDemo();
    if (withTour) startTour();
    else endTour();
    router.replace("/dashboard");
  }

  if (entering) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Setting up the demo classroom…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 float-pane px-5 sm:px-6 flex items-center justify-between">
        <Logo href="/" textClassName="text-sm" />
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-3xl animate-content-in">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              How would you like to start?
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-500 dark:text-slate-400">
              You will land in a real class with a full year of curriculum, eight
              classmates and their progress. Nothing you do is saved.
            </p>
          </div>

          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            <Choice
              icon={<GraduationCap className="w-5 h-5" />}
              title="Take the guided tour"
              desc="A short walk through both sides of a class — the progress table, the gate, the curriculum, and what a student sees. About a minute, and you can leave at any point."
              cta="Start the tour"
              onClick={() => enter(true)}
              primary
            />
            <Choice
              icon={<Compass className="w-5 h-5" />}
              title="Explore on my own"
              desc="Straight into the dashboard with no overlay. Everything the tour points at is there to be found — this is the same product either way."
              cta="Open the demo"
              onClick={() => enter(false)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function Choice({
  icon,
  title,
  desc,
  cta,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card p-5 text-left flex flex-col gap-2 hover:border-primary/60 transition-colors group"
    >
      <span className="text-primary dark:text-primary-glow">{icon}</span>
      <span className="text-base font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary dark:group-hover:text-primary-glow transition-colors">
        {title}
      </span>
      <span className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed flex-1">
        {desc}
      </span>
      <span
        className={
          primary
            ? "mt-2 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-primary group-hover:bg-primary-dark text-white text-sm font-semibold self-start transition-colors"
            : "mt-2 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium self-start group-hover:border-primary/50 transition-colors"
        }
      >
        {cta}
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}
