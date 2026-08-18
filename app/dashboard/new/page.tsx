"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavbar } from "@/components/AppNavbar";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { getCurrentUser } from "@/lib/auth-client";
import { createClassForTeacher } from "@/lib/db/client";
import { COURSE_TEMPLATES } from "@/lib/course-templates";
import { ArrowLeft, ArrowRight, Loader2, Plus } from "lucide-react";

/**
 * Starting a class is a decision with a year of curriculum behind it, so it
 * gets a page rather than a dialog — room to read what each template brings.
 */
export default function NewClassPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getCurrentUser()) {
      router.replace("/?auth=login");
      return;
    }
    setReady(true);
  }, [router]);

  function createClass(templateId?: string) {
    const user = getCurrentUser();
    if (!user) return;
    const cls = createClassForTeacher(user.id, templateId);
    router.push(`/dashboard/class/${cls.id}`);
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0b0f16]">
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

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-6 py-8 sm:py-12">
        <p className="eyebrow mb-2">New Class</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Start from a course you already run
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xl">
          Pick a template and the units, dates, checkpoints and resource slots come
          pre-built — you just attach the materials. Everything stays editable, and the
          class opens for students only as far as you move the gate.
        </p>

        <div className="mt-8 space-y-3">
          {COURSE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => createClass(template.id)}
              className="w-full flex items-start gap-4 p-5 card hover:border-primary/60 text-left transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary dark:group-hover:text-primary-glow transition-colors">
                  {template.name}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {template.summary}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-600 mt-2">
                  {template.units.length} units ·{" "}
                  {template.units.reduce((n, u) => n + u.sections.length, 0)} subunits ·{" "}
                  {template.tracks.map((t) => t.label).join(", ")}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary dark:group-hover:text-primary-glow shrink-0 mt-1 transition-colors" />
            </button>
          ))}

          <button
            type="button"
            onClick={() => createClass()}
            className="w-full flex items-start gap-3 p-5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary/60 text-left transition-colors"
          >
            <Plus className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Empty Class
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                One unit, one subunit, three empty resource slots.
              </div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
