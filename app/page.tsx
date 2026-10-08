import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Bento } from "@/components/landing/Bento";
import { HoverNav } from "@/components/landing/HoverNav";
import { CreateMock, DiffMock, GridMock, TracksMock } from "@/components/landing/Mocks";
import { Reveal } from "@/components/landing/Reveal";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, ChevronDown } from "lucide-react";

/**
 * Two pages at one address. With `?auth=` this is the sign-in card and nothing
 * else — a returning user came here to get in, and should not have to scroll
 * past a pitch to do it. Without it, it is the pitch.
 *
 * The pitch is built the way Supabase builds theirs: one flat page colour, one
 * accent used sparingly, 1px borders instead of shadows, and two-tone headings
 * — the point in ink, the rest in grey. Every picture on it is a miniature of
 * the real product, built from the app's own components, because a page of
 * adjectives about software nobody has seen is worth very little.
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
      <section className="px-5 sm:px-6 pt-14 sm:pt-24 pb-12 sm:pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-3xl sm:mx-auto sm:text-center">
            <h1 className="text-[2.5rem] sm:text-6xl lg:text-7xl font-medium tracking-[-0.04em] leading-[1.02]">
              <span className="block ink">A class where nobody</span>
              <span className="block text-primary dark:text-primary-glow">
                waits for the middle.
              </span>
            </h1>
            <p className="mt-5 sm:mt-6 text-[15px] sm:text-lg leading-relaxed text-slate-500 dark:text-slate-400 max-w-xl sm:mx-auto">
              Attach your materials. We build the class.
            </p>
            <div className="mt-7 flex flex-wrap items-center sm:justify-center gap-2">
              <Link href="/?auth=signup" className="group btn btn-md btn-primary">
                Start a class
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link href="/demo" className="btn btn-md btn-secondary">
                Try the demo
              </Link>
            </div>
          </div>

          <Reveal className="mt-14 sm:mt-20">
            <GridMock />
          </Reveal>
        </div>
      </section>

      {/* ── Start from your materials ───────────────────────────────────── */}
      <Feature
        title="Bring what you already have."
        tail="We build the class."
        points={["Spreadsheets, PDFs or photos", "Nothing saved until you approve"]}
        mock={<CreateMock />}
      />

      {/* ── Statement ────────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 py-10 sm:py-16">
        <Reveal className="max-w-5xl mx-auto">
          <p className="max-w-3xl text-2xl sm:text-[2rem] font-medium tracking-[-0.03em] leading-[1.25]">
            <span className="ink">One room,</span>{" "}
            <span className="muted-ink">every pace.</span>
          </p>
        </Reveal>
      </section>

      {/* ── What you get ─────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 py-12 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <SectionHeading title="Everything a self-paced class needs." tail="Nothing it doesn’t." />
          </Reveal>
          <Reveal className="mt-8 sm:mt-12">
            <Bento />
          </Reveal>
        </div>
      </section>

      {/* ── Feature 1 ────────────────────────────────────────────────────── */}
      <Feature
        title="One button per resource,"
        tail="not one per lesson."

        points={[
          "Textbook, AP Classroom and notes tracked apart",
          "“I’m stuck” is a state on a specific resource",
          "A gate you set for how far the class may run ahead",
        ]}
        mock={<TracksMock />}
      />

      {/* ── Feature 2 ────────────────────────────────────────────────────── */}
      <Feature
        reversed
        title="Plans change in November."
        tail="Attach the new version."
        points={["Only real changes are proposed", "Student work follows every renumber"]}
        mock={<DiffMock />}
      />

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 py-12 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <SectionHeading title="Three steps" tail="to a running class." />
          </Reveal>
          <Reveal as="ol" className="mt-10 sm:mt-14 grid sm:grid-cols-3 gap-10 sm:gap-12">
            <Step
              n={1}
              title="Attach your materials"
              body="We build the curriculum. You approve it."
            />
            <Step
              n={2}
              title="Share the join code"
              body="Six digits. No roster to import."
            />
            <Step
              n={3}
              title="Watch the grid, not the inbox"
              body="See who’s done and who’s stuck."
            />
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 py-12 sm:py-20">
        <div className="max-w-5xl mx-auto grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <Reveal>
            <SectionHeading title="Questions" tail="worth asking first." />
          </Reveal>
          <Reveal className="divide-y divide-slate-200 dark:divide-slate-800">
            <Faq q="Is it free?">
              Yes.
            </Faq>
            <Faq q="Do I have to type the curriculum in?">
              No. Attach what you already have and we build it.
            </Faq>
            <Faq q="What happens to student work if I change the curriculum?">
              It moves with it. Nothing is lost.
            </Faq>
            <Faq q="Is student information ever sent anywhere?">
              No. Only the documents you attach are read.
            </Faq>
            <Faq q="Do students need accounts?">
              Yes — they sign up themselves with your class code.
            </Faq>
            <Faq q="What if I want to stop using it?">
              Delete your account from the profile menu. Everything goes with it.
            </Faq>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-6 py-16 sm:py-28">
        <Reveal className="max-w-3xl mx-auto sm:text-center">
          <h2 className="text-[2rem] sm:text-5xl font-medium tracking-[-0.04em] leading-[1.08]">
            <span className="block ink">See it with a real class.</span>
            <span className="block muted-ink">No sign-up.</span>
          </h2>
          <div className="mt-7 flex flex-wrap items-center sm:justify-center gap-2">
            <Link href="/demo" className="group btn btn-md btn-primary">
              Open the demo
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/?auth=signup" className="btn btn-md btn-secondary">
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
    <header className="h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 float-pane px-5 sm:px-6 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto h-full flex items-center justify-between">
        <Logo href="/" textClassName="text-sm" />
        <div className="flex items-center gap-1 sm:gap-2">
          <HoverNav
            links={[
              { href: "/demo", label: "Demo", className: "hidden sm:inline-flex" },
              { href: "/?auth=login", label: "Log in" },
            ]}
          />
          <Link href="/?auth=signup" className="btn btn-sm btn-primary">
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

function Feature({
  title,
  tail,
  body = [],
  points,
  mock,
  reversed = false,
}: {
  title: string;
  tail: string;
  body?: string[];
  points: string[];
  mock: React.ReactNode;
  reversed?: boolean;
}) {
  return (
    <section className="px-5 sm:px-6 py-12 sm:py-20">
      {/* On a phone the mock sits between the heading and the prose, so the
          first thing past the title is the thing itself rather than two
          paragraphs of grey. On a wide screen the text re-forms into one
          column beside it, which is why this is a grid with explicit
          placement rather than a flex row that merely wraps. */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 gap-7 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-6 lg:items-start">
        <Reveal className={reversed ? "lg:col-start-2 lg:row-start-1" : "lg:col-start-1 lg:row-start-1"}>
          <SectionHeading title={title} tail={tail} />
        </Reveal>

        <Reveal
          className={
            reversed
              ? "lg:row-span-2 lg:self-center lg:col-start-1 lg:row-start-1"
              : "lg:row-span-2 lg:self-center lg:col-start-2 lg:row-start-1"
          }
        >
          {mock}
        </Reveal>

        <Reveal className={reversed ? "lg:col-start-2 lg:row-start-2" : "lg:col-start-1 lg:row-start-2"}>
          {body.map((p, i) => (
            <p
              key={i}
              className="text-[15px] leading-relaxed text-slate-500 dark:text-slate-400 [&:not(:first-child)]:mt-3"
            >
              {p}
            </p>
          ))}
          <ul className={cn("space-y-2", body.length > 0 && "mt-5")}>
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                {point}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="group">
      <span className="block text-4xl font-medium tabular-nums text-slate-200 dark:text-slate-800 transition-colors duration-300 group-hover:text-primary dark:group-hover:text-primary-glow">
        {String(n).padStart(2, "0")}
      </span>
      <h3 className="mt-4 text-[15px] font-medium text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
        {body}
      </p>
    </li>
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

/** Two tones: the claim in ink, its second half in grey. */
function SectionHeading({ title, tail }: { title: string; tail: string }) {
  return (
    <h2 className="text-[1.6rem] sm:text-4xl font-medium tracking-[-0.035em] leading-[1.12] max-w-2xl">
      <span className="block ink">{title}</span>
      <span className="block muted-ink">{tail}</span>
    </h2>
  );
}
