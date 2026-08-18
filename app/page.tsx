import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { BookOpen, BarChart3, Users, Sparkles } from "lucide-react";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const params = await searchParams;
  const initialMode = params.auth === "signup" ? "signup" : "login";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 float-pane px-5 sm:px-6 flex items-center justify-between">
        <Logo href="/" textClassName="text-sm" />
        <div className="flex items-center gap-3">
          <Link
            href="/demo"
            className="inline-flex items-center h-8 px-3 rounded-lg border border-primary/30 bg-white dark:bg-slate-900 text-xs font-semibold text-primary dark:text-primary-glow hover:border-primary transition-colors"
          >
            Try the Demo
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* The sign-in card stays vertically centred at every height. Below `lg`
          the marketing column drops away entirely rather than pushing the form
          off-screen — a returning user came here to log in. */}
      <main className="flex-1 flex items-center justify-center px-5 sm:px-6 py-10 lg:py-16">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="hidden lg:block animate-content-in">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-primary/30 bg-white dark:bg-slate-900 text-primary dark:text-primary-glow text-xs font-semibold mb-6">
              <Sparkles className="w-3 h-3" />
              Self-Paced Learning, Teacher Oversight
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-[1.1]">
              Your classroom,
              <br />
              <span className="text-primary dark:text-primary-glow">modernized.</span>
            </h1>

            <p className="mt-5 text-lg text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed">
              Track progress through units at your own pace. Teachers see who needs help,
              review submissions, and control how far the class can go.
            </p>

            <div className="mt-9 grid sm:grid-cols-3 gap-3">
              <Feature
                icon={<BookOpen className="w-5 h-5" />}
                title="One Button per Resource"
                desc="Textbook, AP Classroom and notes, tracked apart"
              />
              <Feature
                icon={<BarChart3 className="w-5 h-5" />}
                title="Live Progress"
                desc="See status across your whole class"
              />
              <Feature
                icon={<Users className="w-5 h-5" />}
                title="One Login"
                desc="Students and teachers, same door"
              />
            </div>
          </div>

          <div className="w-full max-w-md mx-auto lg:max-w-none animate-content-in">
            <div className="lg:hidden mb-6 text-center">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Your classroom,{" "}
                <span className="text-primary dark:text-primary-glow">modernized.</span>
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                Self-paced learning, teacher oversight.
              </p>
            </div>

            <div className="card p-6 sm:p-8">
              <AuthPanel initialMode={initialMode} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="panel-inset p-4">
      <div className="mb-2 text-primary dark:text-primary-glow">{icon}</div>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
        {title}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
        {desc}
      </div>
    </div>
  );
}
