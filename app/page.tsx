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
      <header className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <Logo href="/" textClassName="text-sm" />
        <div className="flex items-center gap-3">
          <Link
            href="/demo/student"
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hidden sm:inline"
          >
            Try demo
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-12 lg:py-20 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-medium mb-6">
              <Sparkles className="w-3 h-3" />
              Self-paced learning, teacher oversight
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
              Your classroom,
              <br />
              <span className="text-blue-600 dark:text-blue-400">modernized.</span>
            </h1>

            <p className="mt-5 text-lg text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed">
              Track progress through units at your own pace. Teachers see who needs help,
              review submissions, and control how far the class can go.
            </p>

            <div className="mt-10 grid sm:grid-cols-3 gap-4">
              <Feature
                icon={<BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                title="Learn · Practice · Extra"
                desc="Structured activities per subunit"
              />
              <Feature
                icon={<BarChart3 className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
                title="Live progress"
                desc="See status across your whole class"
              />
              <Feature
                icon={<Users className="w-5 h-5 text-green-600 dark:text-green-400" />}
                title="One login"
                desc="Students and teachers, same door"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <AuthPanel initialMode={initialMode} />
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
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
      <div className="mb-2">{icon}</div>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</div>
    </div>
  );
}
