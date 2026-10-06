import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { DiffMock, GridMock, TracksMock } from "@/components/landing/Mocks";
import { Reveal } from "@/components/landing/Reveal";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ChevronDown,
  CloudOff,
  FileSpreadsheet,
  HelpCircle,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

/**
 * Two pages at one address. With `?auth=` this is the sign-in card and nothing
 * else — a returning user came here to get in, and should not have to scroll
 * past a pitch to do it. Without it, it is the pitch.
 *
 * The pitch shows the product rather than describing it: the hero and both
 * feature sections are anchored to miniatures built from the app's own
 * components, because a page of adjectives about software nobody has seen is
 * worth very little.
 */
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

      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate px-5 sm:px-6 pt-12 sm:pt-20 pb-14 sm:pb-20">
        {/* Decoration only: a slow wash of brand colour and a plotting grid,
            both masked so they never reach the text they sit behind. */}
        <div className="aurora -z-10" aria-hidden="true">
          <span className="aurora-blob aurora-blob-1" />
          <span className="aurora-blob aurora-blob-2" />
          <span className="aurora-blob aurora-blob-3" />
        </div>
        <div className="hero-grid -z-10" aria-hidden="true" />

        <div className="max-w-5xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <p className="stagger">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-primary/30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-primary dark:text-primary-glow text-xs font-semibold"
                style={{ "--i": 0 } as React.CSSProperties}
              >
                <Sparkles className="w-3 h-3" />
                Self-paced learning, teacher oversight
              </span>
            </p>

            {/* Set a word at a time so the line assembles rather than fading in
                as a block — and kept as real text, so it reads and copies as
                one sentence. */}
            <h1 className="stagger mt-5 sm:mt-6 text-[2rem] sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] sm:leading-[1.05] text-slate-900 dark:text-slate-100">
              {"A class where nobody".split(" ").map((word, i) => (
                <span
                  key={i}
                  className="inline-block"
                  style={{ "--i": i + 1 } as React.CSSProperties}
                >
                  {word}&nbsp;
                </span>
              ))}
              <br className="hidden sm:inline" />
              {"waits for the middle.".split(" ").map((word, i) => (
                <span
                  key={i}
                  className="inline-block"
                  style={{ "--i": i + 5 } as React.CSSProperties}
                >
                  {word}&nbsp;
                </span>
              ))}
            </h1>

            <div className="stagger">
              <p
                className="mt-4 sm:mt-6 text-[15px] sm:text-lg leading-relaxed text-slate-600 dark:text-slate-400 max-w-md sm:max-w-2xl mx-auto"
                style={{ "--i": 10 } as React.CSSProperties}
              >
                Students move at their own speed. Every resource is tracked
                separately, so &quot;done&quot; means something — and you can see
                at a glance exactly who is stuck, and on what.
              </p>

              <div
                className="mt-7 sm:mt-9 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3"
                style={{ "--i": 11 } as React.CSSProperties}
              >
                <Link href="/?auth=signup" className="btn btn-lg btn-primary">
                  Start a class
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/demo" className="btn btn-lg btn-secondary">
                  Try the demo first
                </Link>
              </div>

              <p
                className="mt-3 text-xs text-slate-400 dark:text-slate-500"
                style={{ "--i": 12 } as React.CSSProperties}
              >
                No account needed for the demo. Nothing is saved.
              </p>
            </div>
          </div>

          {/* The product, immediately — and it fills itself in as you arrive. */}
          <Reveal className="mt-12 sm:mt-16" delay={0.1}>
            <GridMock />
            <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
              The teacher&apos;s view: every student, every subunit, one screen.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Numbers ──────────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 py-10 border-y border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30">
        <Reveal as="dl" className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4 text-center">
          <Stat value="3" label="resources tracked per subunit" />
          <Stat value="72" label="subunits in the demo class" />
          <Stat value="0" label="trackers, ads or third-party scripts" />
          <Stat value="100%" label="of student work kept when units renumber" />
        </Reveal>
      </section>

      {/* ── Feature 1 ────────────────────────────────────────────────────── */}
      <Feature
        eyebrow="The idea"
        title="One button per resource, not one per lesson"
        body={[
          "A textbook, AP Classroom and a guided-notes series never line up section for section. So each gets its own track, with its own numbering and its own Learn and Practice steps.",
          "So a student who has read the chapter but not done the problems is in a different place from one who has done neither — and “done” stops being one checkbox covering three different things.",
        ]}
        points={[
          {
            icon: <Layers className="w-4 h-4" />,
            text: "Textbook, AP Classroom and notes tracked apart",
          },
          {
            icon: <HelpCircle className="w-4 h-4" />,
            text: "“I’m stuck” is a state on a specific resource",
          },
          {
            icon: <Lock className="w-4 h-4" />,
            text: "A gate you set for how far the class may run ahead",
          },
        ]}
        mock={<TracksMock />}
      />

      {/* ── Feature 2 ────────────────────────────────────────────────────── */}
      <Feature
        reversed
        tinted
        eyebrow="Setting it up"
        title="You already wrote the curriculum. In a spreadsheet."
        body={[
          "Upload the timeline you already keep — a spreadsheet, a syllabus, a photo of a printed plan — and it becomes the curriculum.",
          "When the dates shift in November, upload the new version: it changes only what actually changed, and nothing is saved until you approve it — cell by cell if you want.",
        ]}
        points={[
          {
            icon: <FileSpreadsheet className="w-4 h-4" />,
            text: "Spreadsheets, CSVs, PDFs and photos",
          },
          {
            icon: <ShieldCheck className="w-4 h-4" />,
            text: "Removals flagged in red before you touch them",
          },
          {
            icon: <CloudOff className="w-4 h-4" />,
            text: "Insert a subunit and student work follows the renumber",
          },
        ]}
        mock={<DiffMock />}
      />

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 py-12 sm:py-20 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <SectionHeading eyebrow="How it works" title="Three steps to a running class" />
          </Reveal>
          <Reveal as="ol" className="mt-7 sm:mt-10 grid sm:grid-cols-3 gap-3 sm:gap-4" delay={0.08}>
            <Step
              n={1}
              title="Start from a template, or your own file"
              body="Algebra II, AP Precalculus and AP Statistics come ready to go. Or upload the timeline you already keep and let it build the thing."
            />
            <Step
              n={2}
              title="Share the join code"
              body="Students enter six digits. No invitations to chase, no accounts for you to create, no roster to import."
            />
            <Step
              n={3}
              title="Watch the grid, not the inbox"
              body="You see who finished, who is mid-way and who asked for help — and you move the gate when the class is ready."
            />
          </Reveal>
        </div>
      </section>

      {/* ── Trust ────────────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 py-12 sm:py-20 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <SectionHeading
              eyebrow="The boring, important part"
              title="Built to be trusted with a class"
            />
          </Reveal>
          <Reveal className="mt-7 sm:mt-10 grid sm:grid-cols-3 gap-3 sm:gap-4" delay={0.08}>
            <Card
              icon={<ShieldCheck className="w-5 h-5" />}
              title="Enforced in the database"
              body="Who can read what is decided by row-level security, not by the interface. A student cannot see another student's work even if the app is wrong."
            />
            <Card
              icon={<CloudOff className="w-5 h-5" />}
              title="Works when the wifi doesn't"
              body="Changes are saved on the device and queued. The moment the connection is back they sync on their own, and the app says so while they wait."
            />
            <Card
              icon={<Sparkles className="w-5 h-5" />}
              title="No tracking, no ads"
              body="No analytics, no third-party scripts, nothing sold or shared. Student work is never sent to the AI — only your own curriculum documents are."
            />
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 py-12 sm:py-20 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <SectionHeading eyebrow="Questions" title="The ones worth asking first" />
          </Reveal>
          <Reveal className="mt-8 divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
            <Faq q="Is it free?">
              Yes. There is no paid tier, no trial, and nothing to enter a card
              for.
            </Faq>
            <Faq q="What happens to student work if I change the curriculum?">
              It moves with it. Renumbering a subunit rewrites every mark filed
              under it in the same transaction — progress is never dropped to make
              a curriculum edit simpler.
            </Faq>
            <Faq q="Does the AI see my students?">
              No. An import sends your curriculum structure and the documents you
              upload. No names, no progress, no grades — and it only runs when you
              press the button.
            </Faq>
            <Faq q="Do students need accounts?">
              Yes, but they make their own: an email, a password, and the
              six-digit join code. You do not create or manage them.
            </Faq>
            <Faq q="What if I want to stop using it?">
              Delete your account from the profile menu. It removes everything
              immediately, and tells you exactly what will go before you confirm.
            </Faq>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 py-12 sm:py-20 border-t border-slate-200 dark:border-slate-800">
        <Reveal className="max-w-2xl mx-auto text-center">
          <h2 className="text-[1.75rem] sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            See it with a real class
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            The demo has a full year of Algebra II, eight students partway through
            it, and both sides of the app to walk around in.
          </p>
          <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
            <Link href="/demo" className="btn btn-lg btn-primary">
              Open the demo
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/?auth=signup" className="btn btn-lg btn-secondary">
              Create an account
            </Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

function SiteHeader() {
  return (
    <header className="h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 float-pane px-5 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <Logo href="/" textClassName="text-sm" />
      <div className="flex items-center gap-1 sm:gap-2">
        <Link href="/demo" className="btn btn-sm btn-ghost hidden sm:inline-flex">
          Demo
        </Link>
        <Link href="/?auth=login" className="btn btn-sm btn-ghost">
          Log in
        </Link>
        <Link href="/?auth=signup" className="btn btn-sm btn-primary">
          Sign up
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

function AuthView({ initialMode }: { initialMode: "login" | "signup" }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-5 sm:px-6 py-10">
        <div className="w-full max-w-md animate-content-in">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
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

function Feature({
  eyebrow,
  title,
  body,
  points,
  mock,
  reversed = false,
  tinted = false,
}: {
  eyebrow: string;
  title: string;
  body: string[];
  points: { icon: React.ReactNode; text: string }[];
  mock: React.ReactNode;
  reversed?: boolean;
  tinted?: boolean;
}) {
  return (
    <section
      className={cn(
        "px-5 sm:px-6 py-12 sm:py-20 border-t border-slate-200 dark:border-slate-800",
        tinted && "bg-slate-50/60 dark:bg-slate-900/30"
      )}
    >
      {/* On a phone the mock sits between the heading and the prose, so the
          first thing past the title is the thing itself rather than two
          paragraphs of grey. On a wide screen the text re-forms into one
          column beside it, which is why this is a grid with explicit
          placement rather than a flex row that merely wraps. */}
      <div className="max-w-5xl mx-auto grid gap-7 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-5 lg:items-start">
        <Reveal className={reversed ? "lg:col-start-2 lg:row-start-1" : "lg:col-start-1 lg:row-start-1"}>
          <SectionHeading eyebrow={eyebrow} title={title} />
        </Reveal>

        <Reveal
          className={cn(
            "lg:row-span-2 lg:self-center",
            reversed ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-2 lg:row-start-1"
          )}
          delay={0.1}
        >
          {mock}
        </Reveal>

        <Reveal
          className={reversed ? "lg:col-start-2 lg:row-start-2" : "lg:col-start-1 lg:row-start-2"}
          delay={0.06}
        >
          {body.map((p, i) => (
            <p
              key={i}
              className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 [&:not(:first-child)]:mt-3"
            >
              {p}
            </p>
          ))}
          <ul className="mt-5 space-y-2">
            {points.map((p, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="shrink-0 mt-px w-6 h-6 rounded-lg border border-primary/30 bg-white dark:bg-slate-900 text-primary dark:text-primary-glow flex items-center justify-center [&_svg]:w-3.5 [&_svg]:h-3.5">
                  {p.icon}
                </span>
                <span className="text-[14px] leading-snug pt-0.5 text-slate-700 dark:text-slate-200">
                  {p.text}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
        {value}
      </dt>
      <dd className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {label}
      </dd>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="card p-5">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-white text-xs font-bold tabular-nums">
        {n}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
        {body}
      </p>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group py-4">
      <summary className="flex items-center gap-3 cursor-pointer list-none">
        <span className="flex-1 text-[15px] font-medium text-slate-900 dark:text-slate-100">
          {q}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-2.5 pr-7 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
        {children}
      </p>
    </details>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="eyebrow-muted">{eyebrow}</p>
      <h2 className="mt-2 text-xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 max-w-2xl">
        {title}
      </h2>
    </div>
  );
}

function Card({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-primary dark:text-primary-glow">{icon}</div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
        {body}
      </p>
    </div>
  );
}
