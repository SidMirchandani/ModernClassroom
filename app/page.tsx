import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { ChangeScene } from "@/components/landing/ChangeScene";
import { CountTo } from "@/components/landing/CountTo";
import { HeroStage } from "@/components/landing/HeroStage";
import { HoverNav } from "@/components/landing/HoverNav";
import { CreateMock, DiffMock, GridMock, PostMock } from "@/components/landing/Mocks";
import { Reveal } from "@/components/landing/Reveal";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { StepList } from "@/components/landing/StepList";
import { SITE } from "@/lib/site";
import {
  ArrowRight,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  type LucideIcon,
  Play,
  RefreshCw,
  Users,
} from "lucide-react";

/**
 * Two pages at one address. With `?auth=` this is the sign-in card and nothing
 * else: a returning user came here to get in, and should not have to scroll past
 * a pitch to do it. Without it, it is the pitch.
 *
 * The pitch runs from big to small: a pinned panel with one line on it, which the
 * rest of the page slides up over, a statement with three plain facts, the steps
 * beside a list that stays put, then one scene of a plan changing. Every picture
 * is the product itself, either the real screen or a miniature built from its
 * parts.
 */

const STEPS = [
  {
    id: "step-attach",
    label: "Attach your materials.",
    body: "Spreadsheets, PDFs or photos. We read them and build the units, lessons, quizzes and dates.",
    picture: <CreateMock />,
  },
  {
    id: "step-check",
    label: "Check it first.",
    body: "Every change is shown row by row, and nothing is saved until you say yes.",
    picture: <DiffMock />,
  },
  {
    id: "step-post",
    label: "It posts itself.",
    body: "Each lesson appears in Google Classroom on its own date. There is no button to remember.",
    picture: <PostMock />,
  },
  {
    id: "step-grid",
    label: "See who turned in what.",
    body: "Your students keep using Google Classroom. Marks stay private until you return them.",
    picture: <GridMock />,
  },
];

const STEP_LINKS = STEPS.map(({ id, label }) => ({ id, label }));

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const params = await searchParams;
  const auth =
    params.auth === "signup" ? "signup" : params.auth === "login" ? "login" : null;

  if (auth) return <AuthView initialMode={auth} />;

  return (
    <div className="min-h-screen flex flex-col">
      {/* `.reveal` hides itself and waits for an observer to say it is visible.
          Without JS that observer never runs, so everything below the hero
          would stay invisible — this hands those readers the finished page. */}
      <noscript>
        <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      <SmoothScroll />
      <SiteHeader />

      {/* ── Hero: one panel, one line. Pinned; the rest slides up over it. ── */}
      <HeroStage>
        <h1 className="hero-rise text-[2.5rem] sm:text-6xl lg:text-7xl font-medium tracking-[-0.04em] leading-[1.05] text-white">
          A class where nobody waits for the middle.
        </h1>
        <p className="hero-rise [animation-delay:120ms] mt-5 text-[15px] sm:text-xl text-white/90">
          Attach your materials. We build the class.
        </p>
        <div className="hero-rise [animation-delay:240ms] mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/?auth=signup"
            className="group inline-flex items-center gap-2 h-12 px-7 rounded-full bg-white text-slate-950 text-[15px] font-medium transition-colors hover:bg-white/90"
          >
            Start a class
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-white/15 text-white text-[15px] font-medium backdrop-blur transition-colors hover:bg-white/25"
          >
            <Play className="w-4 h-4" />
            Watch a demo
          </Link>
        </div>
      </HeroStage>

      {/* The sheet that slides over the hero: everything from here down. */}
      <div className="relative z-10 bg-white dark:bg-slate-950">
      {/* ── Statement, and three plain facts ─────────────────────────────── */}
      <section className="px-3 sm:px-6 pt-3">
        <div className="rounded-3xl bg-slate-50 dark:bg-slate-900 px-5 sm:px-10 lg:px-16 py-14 sm:py-20">
          <Reveal>
            <p className="eyebrow-muted">Built around the classroom you already use</p>
            <p className="mt-5 max-w-4xl text-[1.75rem] sm:text-5xl font-medium tracking-[-0.035em] leading-[1.15] text-slate-900 dark:text-slate-100">
              Upload your plan, and every lesson reaches Google Classroom on its own date.
            </p>
          </Reveal>
          <div className="mt-10 sm:mt-16 grid gap-4 sm:grid-cols-3">
            <Reveal>
              <Fact text="To build a whole year of lessons.">
                <CountTo from={24} to={1} suffix=" files" suffixOne=" file" />
              </Fact>
            </Reveal>
            <Reveal delay={0.1}>
              <Fact text="To post by hand, once your plan is approved.">
                <CountTo from={104} to={0} suffix=" lessons" />
              </Fact>
            </Reveal>
            <Reveal delay={0.2}>
              <Fact text="To use it.">
                <CountTo from={49} to={0} prefix="$" />
              </Fact>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── The steps, beside a list that stays put ──────────────────────── */}
      <section id="how" className="scroll-mt-20 px-5 sm:px-6 py-16 sm:py-28">
        <div className="max-w-6xl mx-auto grid grid-cols-1 gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div className="hidden lg:block">
            <StepList steps={STEP_LINKS} />
          </div>
          <div className="min-w-0">
            <Reveal>
              <p className="eyebrow-muted">How it works</p>
              <h2 className="mt-3 text-[1.75rem] sm:text-5xl font-medium tracking-[-0.035em] leading-[1.12] text-slate-900 dark:text-slate-100">
                From your plan to a running class.
              </h2>
            </Reveal>
            <div className="mt-10 sm:mt-14 space-y-12 sm:space-y-20">
              {STEPS.map((step) => (
                <Reveal key={step.id}>
                  <div id={step.id} className="scroll-mt-28">
                    <div className="rounded-2xl bg-slate-100 dark:bg-slate-900 p-5 sm:p-10">
                      <div className="mx-auto max-w-lg">{step.picture}</div>
                    </div>
                    <h3 className="mt-5 text-xl font-medium text-slate-900 dark:text-slate-100 lg:hidden">{step.label}</h3>
                    <p className="mt-2 lg:mt-5 max-w-xl text-[15px] sm:text-[17px] leading-relaxed text-slate-600 dark:text-slate-300">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── What happens after the first day: one scene, told as you scroll ── */}
      <section className="px-3 sm:px-6">
        <ChangeScene />
      </section>

      {/* ── What's in it ─────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 pt-16 sm:pt-28">
        <div className="max-w-6xl mx-auto grid gap-4 lg:grid-cols-[1fr_2fr]">
          <Reveal className="relative overflow-hidden flex flex-col rounded-3xl bg-primary-light dark:bg-primary/15 p-7 sm:p-9">
            <h2 className="text-[1.75rem] sm:text-4xl font-medium tracking-[-0.03em] leading-[1.15] text-slate-900 dark:text-slate-100">
              Everything a class needs.
            </h2>
            <p className="mt-4 text-[15px] sm:text-[17px] leading-relaxed text-slate-600 dark:text-slate-300">
              Nothing it doesn&apos;t.
            </p>
            <Link href="/?auth=signup" className="mt-10 lg:mt-auto btn btn-lg btn-primary !rounded-full">
              Start a class
            </Link>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <Reveal>
              <FeatureCard
                icon={GraduationCap}
                title="Works with Google Classroom"
                body="Pick the class you already teach. Your topics and assignments appear there, under your name."
              />
            </Reveal>
            <Reveal delay={0.08}>
              <FeatureCard
                icon={ClipboardCheck}
                title="Grades in one grid"
                body="Type marks beside each turn-in, then return a whole column when you're ready."
              />
            </Reveal>
            <Reveal delay={0.16}>
              <FeatureCard
                icon={Users}
                title="Students stay put"
                body="They don't need an account here or anything new. Your roster comes from Google Classroom."
              />
            </Reveal>
            <Reveal delay={0.24}>
              <FeatureCard
                icon={RefreshCw}
                title="Syncs both ways"
                body="A change on either side reaches the other, whenever you open your class."
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Questions ────────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-20 px-5 sm:px-6 py-16 sm:py-28">
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center">
            <h2 className="text-[1.75rem] sm:text-5xl font-medium tracking-[-0.035em] leading-[1.12] text-slate-900 dark:text-slate-100">
              Questions worth asking first.
            </h2>
          </Reveal>
          <Reveal className="mt-10 sm:mt-14 divide-y divide-slate-200 dark:divide-slate-800">
            <Faq q="Is it free?">Yes.</Faq>
            <Faq q="Do I have to type the curriculum in?">
              No. Attach what you already have and we build it.
            </Faq>
            <Faq q="Do my students need to do anything?">
              No. They keep using Google Classroom the way they do now.
            </Faq>
            <Faq q="What happens to student work if I change the curriculum?">
              It stays. A lesson a student has touched is never deleted from Google Classroom.
            </Faq>
            <Faq q="Is student information ever sent anywhere?">
              Only the documents you attach are read, and your class&apos;s posts and turn-ins move between here
              and your own Google Classroom.
            </Faq>
            <Faq q="What if I want to stop using it?">
              Delete your account from the profile menu. Everything goes with it.
            </Faq>
          </Reveal>
        </div>
      </section>

      {/* ── One more panel, to close ─────────────────────────────────────── */}
      <section className="px-3 sm:px-6 pb-6">
        <div className="rounded-3xl bg-slate-950 dark:border dark:border-slate-800 px-5 py-20 sm:py-32 text-center">
          <h2 className="text-[2rem] sm:text-6xl font-medium tracking-[-0.04em] leading-[1.08] text-white">
            See it in a minute.
          </h2>
          <p className="mt-4 text-[15px] sm:text-xl text-white/80">No sign-up.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-white text-slate-950 text-[15px] font-medium transition-colors hover:bg-white/90"
            >
              <Play className="w-4 h-4" />
              Watch a demo
            </Link>
            <Link
              href="/?auth=signup"
              className="inline-flex items-center h-12 px-7 rounded-full bg-white/15 text-white text-[15px] font-medium transition-colors hover:bg-white/25"
            >
              Create an account
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
      </div>
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

function SiteHeader() {
  return (
    <header className="h-[4.5rem] shrink-0 bg-white dark:bg-slate-950 px-5 sm:px-6 sticky top-0 z-20">
      <div className="h-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 sm:gap-8 min-w-0">
          <Logo href="/" textClassName="text-base hidden sm:inline" />
          <div className="hidden md:block">
            <HoverNav
              links={[
                { href: "/#how", label: "How It Works" },
                { href: "/demo", label: "Demo" },
                { href: "/#faq", label: "Questions" },
              ]}
            />
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <HoverNav links={[{ href: "/?auth=login", label: "Log in" }]} />
          <Link
            href="/?auth=signup"
            className="inline-flex items-center h-10 sm:h-11 px-4 sm:px-6 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-sm font-medium whitespace-nowrap transition-opacity hover:opacity-85"
          >
            Sign up
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function AuthView({ initialMode }: { initialMode: "login" | "signup" }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="page-in flex-1 flex items-center justify-center px-5 sm:px-6 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-medium tracking-[-0.03em] text-slate-900 dark:text-slate-100">
              {SITE.name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {SITE.tagline}
            </p>
          </div>
          <div className="card p-6 sm:p-8">
            <AuthPanel initialMode={initialMode} />
          </div>
          <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
            By continuing you agree to the{" "}
            <Link href="/terms" className="hover:text-primary underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="hover:text-primary underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** A plain fact: what it means up top, the number large below it. */
function Fact({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col justify-between gap-10 rounded-2xl bg-white dark:bg-slate-800 p-5 sm:p-6 min-h-[11rem] sm:min-h-[14rem]">
      <p className="text-sm leading-snug text-slate-600 dark:text-slate-300 max-w-[16rem]">{text}</p>
      <p className="text-5xl font-medium tracking-[-0.04em] text-slate-900 dark:text-slate-100">{children}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="group h-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-8 sm:min-h-[16rem] transition-[transform,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-primary/40 hover:shadow-z2">
      <span className="w-11 h-11 rounded-xl inline-flex items-center justify-center bg-primary/10 text-primary dark:text-primary-glow transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110">
        <Icon className="w-5 h-5" aria-hidden />
      </span>
      <h3 className="mt-6 text-xl sm:text-2xl font-medium tracking-[-0.02em] text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="faq group py-4">
      <summary className="flex items-center gap-3 cursor-pointer list-none">
        <span className="flex-1 text-[15px] font-medium text-slate-900 dark:text-slate-100 transition-colors group-hover:text-primary dark:group-hover:text-primary-glow">
          {q}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-slate-400 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <p className="mt-2.5 pr-7 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
        {children}
      </p>
    </details>
  );
}
