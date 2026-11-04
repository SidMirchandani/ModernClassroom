import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Watch a demo",
  description: "A one-minute look at going from a pacing guide to Google Classroom.",
};

/**
 * The demo is a video. A class only makes sense with a real curriculum and real
 * students in it, so rather than hand a visitor an empty room to click around,
 * this shows the whole path in a minute. It has no sound, so it starts by itself.
 */
export default function DemoPage() {
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

      <main className="page-in flex-1 px-5 sm:px-6 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-[2rem] sm:text-4xl font-medium tracking-[-0.035em] leading-[1.1] sm:text-center">
            <span className="ink">From your plan to Google Classroom,</span>{" "}
            <span className="muted-ink">in a minute.</span>
          </h1>

          <video
            className="mt-8 w-full aspect-video rounded-2xl border border-slate-200 dark:border-slate-800 bg-white"
            src="/demo.mp4"
            poster="/demo-poster.jpg"
            controls
            autoPlay
            muted
            playsInline
            preload="metadata"
            aria-label="A teacher picks their Google Classroom class, uploads a pacing guide, approves what was read, and sees which students turned in what."
          />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 sm:text-center">
            Filmed with a sample class and sample students.
          </p>

          <div className="mt-7 flex sm:justify-center">
            <Link href="/?auth=signup" className="group btn btn-md btn-primary">
              Start a class
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
