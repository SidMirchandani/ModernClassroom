import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * What Modern Classroom does, acted out behind the headline. A pacing guide is
 * read, its lessons travel through Modern Classroom into Google Classroom and
 * appear there on their dates, students turn work in, and the marks fill a grid.
 *
 * All of it is drawn here and moved by CSS (`.hs-*` in globals.css), so it needs
 * no JavaScript and no pictures. It uses no shadows, and with less motion asked
 * for it holds still with everything showing. Decorative: the headline says it.
 * Behind it all, the pieces of a class keep floating up the panel (`Drift`).
 */

function Card({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={16}
      className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
      strokeWidth={1.5}
    />
  );
}

/** A dashed line that crawls the way the lessons go. */
function Wire({ d, slow = false }: { d: string; slow?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      strokeWidth={2}
      strokeDasharray="4 9"
      strokeLinecap="round"
      className={cn("hs-wire stroke-slate-300 dark:stroke-slate-600", slow && "hs-wire-slow")}
    />
  );
}

/** Something travelling along a line, starting `delay` seconds into the loop. */
function Traveller({
  path,
  delay,
  children,
}: {
  path: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <g
      className="hs-travel"
      style={{ offsetPath: `path("${path}")`, animationDelay: `${delay}s` } as React.CSSProperties}
    >
      {children}
    </g>
  );
}

function LessonChip({ label, width = 104 }: { label: string; width?: number }) {
  return (
    <>
      <rect x={-width / 2} y={-15} width={width} height={30} rx={15} className="fill-primary" />
      <text textAnchor="middle" y={4.5} fontSize={13} fontWeight={500} className="fill-white">
        {label}
      </text>
    </>
  );
}

function PageDot() {
  return <rect x={-12} y={-15} width={24} height={30} rx={5} className="fill-primary" />;
}

function CheckDot() {
  return (
    <>
      <circle r={11} className="fill-emerald-500" />
      <path d="M-5 0 L-1.5 3.5 L5 -3.5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** The file being read. */
function GuideCard({ x, y, w }: { x: number; y: number; w: number }) {
  const lines = [0.86, 0.62, 0.76, 0.5];
  return (
    <g className="hs-sway">
      <Card x={x} y={y} w={w} h={152} />
      <rect x={x + 18} y={y + 18} width={22} height={28} rx={4} className="fill-primary/15" />
      <text x={x + 50} y={y + 37} fontSize={15} fontWeight={500} className="fill-slate-800 dark:fill-slate-100">
        Pacing Guide.pdf
      </text>
      {lines.map((part, i) => (
        <rect
          key={i}
          x={x + 18}
          y={y + 66 + i * 18}
          width={(w - 36) * part}
          height={7}
          rx={3.5}
          className="hs-line fill-slate-200 dark:fill-slate-700"
          style={{ animationDelay: `${i * 0.28}s` }}
        />
      ))}
      <rect x={x + 10} y={y + 58} width={w - 20} height={3} rx={1.5} className="hs-scan fill-primary" />
    </g>
  );
}

/** Lessons landing in Google Classroom, each on its own date. */
function ClassroomCard({ x, y, w }: { x: number; y: number; w: number }) {
  const rows = [
    { label: "3.1 Slope", date: "Oct 12" },
    { label: "3.2 Lines", date: "Oct 13" },
    { label: "3.3 Best Fit", date: "Oct 14" },
    { label: "Quiz 3A", date: "Oct 15" },
  ];
  return (
    <g className="hs-sway" style={{ animationDelay: "-2s" }}>
      <Card x={x} y={y} w={w} h={214} />
      <text x={x + 18} y={y + 32} fontSize={15} fontWeight={500} className="fill-slate-800 dark:fill-slate-100">
        Google Classroom
      </text>
      {rows.map((row, i) => (
        <g key={row.label} className="hs-row" style={{ animationDelay: `${2.8 + i * 0.75}s` }}>
          <rect x={x + 12} y={y + 48 + i * 39} width={w - 24} height={32} rx={9} className="fill-slate-50 dark:fill-slate-800" />
          <text x={x + 24} y={y + 69 + i * 39} fontSize={13} className="fill-slate-700 dark:fill-slate-200">
            {row.label}
          </text>
          <text x={x + w - 24} y={y + 69 + i * 39} fontSize={12} textAnchor="end" className="fill-emerald-600 dark:fill-emerald-400">
            {row.date}
          </text>
        </g>
      ))}
    </g>
  );
}

/** The grid filling in as work comes back. */
function GridCard({ x, y }: { x: number; y: number }) {
  const students = ["AT", "BC", "CN"];
  const marks = ["18", "20", "17"];
  return (
    <g className="hs-sway" style={{ animationDelay: "-3.5s" }}>
      <Card x={x} y={y} w={232} h={172} />
      <text x={x + 18} y={y + 31} fontSize={15} fontWeight={500} className="fill-slate-800 dark:fill-slate-100">
        Who Turned In What
      </text>
      {students.map((who, i) => (
        <g key={who}>
          <circle cx={x + 34} cy={y + 67 + i * 39} r={14} className="fill-primary/15" />
          <text x={x + 34} y={y + 71 + i * 39} fontSize={10} fontWeight={600} textAnchor="middle" className="fill-primary dark:fill-primary-glow">
            {who}
          </text>
          <rect x={x + 60} y={y + 56 + i * 39} width={70} height={22} rx={7} className="fill-slate-100 dark:fill-slate-800" />
          <rect
            x={x + 60}
            y={y + 56 + i * 39}
            width={70}
            height={22}
            rx={7}
            className="hs-cell fill-emerald-500/20"
            style={{ animationDelay: `${7.0 + i * 0.4}s` }}
          />
          <text
            x={x + 180}
            y={y + 72 + i * 39}
            fontSize={13}
            fontWeight={500}
            textAnchor="middle"
            className="hs-cell fill-slate-800 dark:fill-slate-100"
            style={{ animationDelay: `${7.2 + i * 0.4}s` }}
          >
            {marks[i]} / 20
          </text>
        </g>
      ))}
    </g>
  );
}

function Students({ x, y, gap, r = 24 }: { x: number; y: number; gap: number; r?: number }) {
  const names = ["AT", "BC", "CN", "DK"];
  return (
    <g>
      {names.map((who, i) => (
        <g key={who} className="hs-bob" style={{ animationDelay: `${i * -0.8}s` }}>
          <circle cx={x + i * gap} cy={y} r={r} className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700" strokeWidth={1.5} />
          <text x={x + i * gap} y={y + 4.5} fontSize={r * 0.54} fontWeight={600} textAnchor="middle" className="fill-slate-600 dark:fill-slate-300">
            {who}
          </text>
          <g transform={`translate(${x + i * gap + r * 0.72} ${y - r * 0.72})`}>
            <g className="hs-tick" style={{ animationDelay: `${5.2 + i * 0.4}s` }}>
              <CheckDot />
            </g>
          </g>
        </g>
      ))}
    </g>
  );
}

function Hub({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const orbit = r * 1.42;
  return (
    <g className="hs-hub">
      <circle cx={cx} cy={cy} r={r} className="hs-ring fill-primary/10" style={{ transformOrigin: `${cx}px ${cy}px` }} />
      <g className="hs-orbit" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx} cy={cy} r={orbit} fill="none" strokeWidth={1.5} strokeDasharray="3 9" strokeLinecap="round" className="stroke-slate-200 dark:stroke-slate-700" />
        <circle cx={cx + orbit} cy={cy} r={r * 0.11} className="fill-primary" />
        <circle cx={cx - orbit * 0.5} cy={cy + orbit * 0.866} r={r * 0.09} className="fill-emerald-500" />
        <circle cx={cx - orbit * 0.5} cy={cy - orbit * 0.866} r={r * 0.07} className="fill-primary/40" />
      </g>
      <circle cx={cx} cy={cy} r={r} className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700" strokeWidth={1.5} />
      <image data-hero-hub href="/Logo.png" x={cx - r * 0.62} y={cy - r * 0.62} width={r * 1.24} height={r * 1.24} />
    </g>
  );
}

const CHIP = "whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500";

const FLOATERS: { at: string; time: number; start: number; sway: number; wide?: boolean; what: React.ReactNode }[] = [
  { at: "3%", time: 21, start: -3, sway: 34, what: <span className={CHIP}>3.1 Slope</span> },
  { at: "10%", time: 17, start: -11, sway: -22, wide: true, what: <span className="block h-3 w-3 rounded-full bg-primary/20" /> },
  { at: "17%", time: 24, start: -16, sway: 40, what: <span className="block h-10 w-8 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" /> },
  { at: "24%", time: 19, start: -6, sway: -30, wide: true, what: <span className={CHIP}>Oct 14</span> },
  { at: "32%", time: 26, start: -20, sway: 26, what: <span className="block h-2.5 w-2.5 rounded-full bg-emerald-500/30" /> },
  { at: "40%", time: 20, start: -1, sway: -36, wide: true, what: <span className={CHIP}>Quiz 3A</span> },
  { at: "47%", time: 23, start: -13, sway: 24, what: <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15"><Check className="h-3.5 w-3.5 text-emerald-600/70" /></span> },
  { at: "55%", time: 18, start: -8, sway: -26, wide: true, what: <span className="block h-4 w-4 rounded-full bg-primary/15" /> },
  { at: "62%", time: 25, start: -18, sway: 38, what: <span className={CHIP}>18 / 20</span> },
  { at: "69%", time: 16, start: -4, sway: -20, wide: true, what: <span className="block h-10 w-8 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" /> },
  { at: "76%", time: 22, start: -10, sway: 30, what: <span className={CHIP}>3.2 Lines</span> },
  { at: "83%", time: 19, start: -15, sway: -34, wide: true, what: <span className="block h-3 w-3 rounded-full bg-emerald-500/25" /> },
  { at: "89%", time: 24, start: -7, sway: 22, what: <span className={CHIP}>Oct 12</span> },
  { at: "95%", time: 20, start: -17, sway: -28, wide: true, what: <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10"><Check className="h-3.5 w-3.5 text-primary/60" /></span> },
];

/** Pieces of a class floating up the panel, faint enough to read words over. */
function Drift() {
  return (
    <>
      {FLOATERS.map((f) => (
        <span
          key={f.at}
          className={cn("hs-float absolute top-full", f.wide && "hidden md:block")}
          style={
            {
              left: f.at,
              animationDuration: `${f.time}s`,
              animationDelay: `${f.start}s`,
              "--sway": `${f.sway}px`,
            } as React.CSSProperties
          }
        >
          {f.what}
        </span>
      ))}
    </>
  );
}

export function HeroScene() {
  // Wide: the journey runs across the top, with the people and the grid down the
  // sides of the headline, and the turned-in work arcing back above it.
  const fileToHub = "M 330 150 C 430 80, 540 80, 640 140";
  const hubToClass = "M 760 140 C 860 80, 970 80, 1070 150";
  const classToKids = "M 1215 282 C 1232 310, 1232 335, 1215 362";
  const kidsToGrid = "M 1080 408 C 850 330, 560 330, 300 380";

  // Phones: both cards along the top, the journey dipping through the logo.
  const phoneIn = "M 92 112 C 100 165, 135 190, 168 190";
  const phoneOut = "M 222 190 C 255 190, 292 175, 300 152";

  return (
    <div aria-hidden className="hero-scene-in absolute inset-0 pointer-events-none select-none">
      <Drift />

      {/* Wide screens */}
      <svg viewBox="0 0 1400 780" preserveAspectRatio="xMidYMin meet" className="hidden md:block absolute inset-0 w-full h-full overflow-visible">
        <Wire d={fileToHub} />
        <Wire d={hubToClass} />
        <g className="hs-drop">
          <Wire d={classToKids} slow />
        </g>
        <g className="hs-arc">
          <Wire d={kidsToGrid} slow />
        </g>

        {/* Under the cards, so they leave from and arrive behind them. */}
        {[0.2, 0.95, 1.7, 2.45].map((d) => (
          <Traveller key={d} path={fileToHub} delay={d}>
            <PageDot />
          </Traveller>
        ))}
        {["3.1 Slope", "3.2 Lines", "3.3 Best Fit", "Quiz 3A"].map((label, i) => (
          <Traveller key={label} path={hubToClass} delay={1.3 + i * 0.75}>
            <LessonChip label={label} />
          </Traveller>
        ))}
        <g className="hs-arc">
          {[5.4, 5.8, 6.2].map((d) => (
            <Traveller key={d} path={kidsToGrid} delay={d}>
              <CheckDot />
            </Traveller>
          ))}
        </g>

        <GuideCard x={80} y={70} w={250} />
        <Hub cx={700} cy={150} r={56} />
        <ClassroomCard x={1070} y={60} w={260} />
        <g className="hs-right">
          <Students x={1100} y={410} gap={68} />
        </g>
        <g className="hs-left">
          <GridCard x={70} y={340} />
        </g>
      </svg>

      {/* Phones: the same journey, top down, above the headline. */}
      <svg viewBox="0 0 390 400" preserveAspectRatio="xMidYMin meet" className="md:hidden absolute inset-x-0 top-0 w-full">
        <Wire d={phoneIn} />
        <Wire d={phoneOut} />
        {[0.2, 1.1, 2.0].map((d) => (
          <Traveller key={d} path={phoneIn} delay={d}>
            <g transform="scale(0.5)">
              <PageDot />
            </g>
          </Traveller>
        ))}
        {[1.2, 2.1, 3.0].map((d) => (
          <Traveller key={d} path={phoneOut} delay={d}>
            <g transform="scale(0.5)">
              <PageDot />
            </g>
          </Traveller>
        ))}
        <g transform="translate(14 16) scale(0.62)">
          <GuideCard x={0} y={0} w={250} />
        </g>
        <g transform="translate(214 16) scale(0.62)">
          <ClassroomCard x={0} y={0} w={260} />
        </g>
        <Hub cx={195} cy={190} r={30} />
        <g className="hs-students">
          <Students x={90} y={285} gap={70} r={22} />
        </g>
      </svg>
    </div>
  );
}
