"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavbar } from "@/components/AppNavbar";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import {
  MAX_UPLOAD_MB,
  MaterialsPicker,
  totalMegabytes,
} from "@/components/teacher/MaterialsPicker";
import { getCurrentUser } from "@/lib/auth-client";
import { setPendingImport } from "@/lib/pending-import";
import { store } from "@/lib/store";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

/**
 * A class starts from what the teacher already has. Attach the materials —
 * the year's time line, a syllabus, a photo of a printed plan — say anything
 * the AI should know, and it drafts the curriculum.
 *
 * The draft is made in the new class's own Curriculum tab rather than here:
 * the import route only reads for a class that exists and that the caller
 * teaches, and the tab is where every proposal is reviewed anyway. So this
 * page creates the class empty, hands the files over (`setPendingImport`) and
 * moves there, where the read starts on arrival. Nothing reaches the class
 * until the teacher approves it.
 */
export default function NewClassPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState<"ai" | "empty" | null>(null);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) {
        router.replace("/?auth=login");
        return;
      }
      setReady(true);
    });
  }, [router]);

  async function create(withAi: boolean) {
    const user = await getCurrentUser();
    if (!user) return;
    setCreating(withAi ? "ai" : "empty");
    try {
      const cls = await store.createClassForTeacher(user.id, { name, blank: withAi });
      if (withAi) {
        setPendingImport(cls.id, { files, instructions: notes.trim() });
        router.push(`/dashboard/class/${cls.id}?view=curriculum`);
      } else {
        router.push(`/dashboard/class/${cls.id}`);
      }
    } catch {
      setCreating(null);
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
  const busy = creating !== null;

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

      <main className="page-in flex-1 max-w-2xl mx-auto w-full px-5 sm:px-6 py-10 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] leading-[1.1] text-slate-900 dark:text-slate-100">
          New class
        </h1>

        <label className="block mt-10">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Name
          </span>
          <input
            type="text"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="Algebra II, Period 3"
            className="mt-1 w-full px-0 py-2 bg-transparent border-0 border-b border-slate-200 dark:border-slate-700 rounded-none text-lg placeholder:text-slate-300 dark:placeholder:text-slate-600 focus-visible:!shadow-none focus-visible:!border-primary"
          />
        </label>

        <div className="mt-8">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Files
          </span>
          <MaterialsPicker
            files={files}
            onFilesChange={setFiles}
            notes={notes}
            onNotesChange={setNotes}
            disabled={busy}
            actions={
              <button
                type="button"
                disabled={busy || files.length === 0 || tooLarge}
                onClick={() => create(true)}
                aria-busy={creating === "ai"}
                className="btn btn-sm btn-primary"
              >
                Create class
                {creating === "ai" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
              </button>
            }
          />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => create(false)}
          className="mt-5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          {creating === "empty" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Start empty instead
        </button>
      </main>
    </div>
  );
}
