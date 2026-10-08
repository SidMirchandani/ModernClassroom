import { Check, CloudOff, HelpCircle, Lock, Radio, ShieldCheck } from "lucide-react";
import { STATUS_CHIP } from "@/lib/status-styles";
import { cn } from "@/lib/utils";

/**
 * What the app does, as five small working pieces of it — each standing on a
 * faint grey plotting grid that fades into the page, with no card around it,
 * and a title and a line of copy beneath with the key words in ink.
 * Every vignette is something the product really shows — the same chips, the
 * same sync wording. Decorative, so `aria-hidden`; the copy carries the meaning.
 *
 * They answer the cursor: the grid brightens beneath the pointer, the icon
 * takes the colour, and each vignette plays its change on hover — a
 * student finishing, a help flag raised, a queue of offline changes landing.
 */
export function Bento() {
  return (
    <div className="grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-6">
      <Tile
        className="sm:col-span-2 lg:col-span-4"
        icon={<Radio className="w-4 h-4" />}
        title="Live"
        body={
          <>
            Progress lands on your grid as it happens.
          </>
        }
      >
        <LiveVignette />
      </Tile>

      <Tile
        className="lg:col-span-2"
        icon={<HelpCircle className="w-4 h-4" />}
        title="Stuck is a state"
        body={
          <>
            Students flag the exact resource.
          </>
        }
      >
        <div className="flex flex-col items-center gap-2" aria-hidden="true">
          <div className="flex items-center gap-1.5">
            <MiniChip status="complete">T</MiniChip>
            <span className="relative h-6 min-w-[2rem]">
              <span className="swap-a absolute inset-0">
                <MiniChip status="in-progress">ON</MiniChip>
              </span>
              <span className="swap-b absolute inset-0">
                <MiniChip status="help">ON</MiniChip>
              </span>
            </span>
            <MiniChip status="not-started">DA</MiniChip>
            <MiniChip status="not-started">EX</MiniChip>
          </div>
          <span className="swap-b text-[10.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Carson W. needs help · AP Classroom
          </span>
        </div>
      </Tile>

      <Tile
        className="lg:col-span-2"
        icon={<CloudOff className="w-4 h-4" />}
        title="Offline"
        body={
          <>
            Syncs when the wifi is back.
          </>
        }
      >
        {/* The same two states the real status pill moves between. */}
        <div className="relative h-7 w-48" aria-hidden="true">
          <span className="swap-a absolute inset-0 inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Offline · 3 changes waiting
          </span>
          <span className="swap-b absolute inset-0 inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <Check className="w-3 h-3 text-primary" />
            All changes saved
          </span>
        </div>
      </Tile>

      <Tile
        className="lg:col-span-2"
        icon={<ShieldCheck className="w-4 h-4" />}
        title="Row-level security"
        body={
          <>
            Students only ever see their own work.
          </>
        }
      >
        <pre
          aria-hidden="true"
          className="w-full whitespace-pre-wrap text-[10.5px] leading-[1.6] font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-slate-500 dark:text-slate-400 transition-colors duration-300 group-hover:border-primary/40"
        >
          <span className="text-primary dark:text-primary-glow">policy</span> &quot;progress: own or teacher&quot;
          {"\n"}
          <span className="transition-colors duration-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
            {"  "}
            <span className="text-primary dark:text-primary-glow">using</span> (student_id = auth.uid()
            {"\n"}    or private.is_class_teacher(class_id))
          </span>
        </pre>
      </Tile>

      <Tile
        className="lg:col-span-2"
        icon={<Lock className="w-4 h-4" />}
        title="No tracking"
        body={
          <>
            No analytics, no ads.
          </>
        }
      >
        <div className="flex items-baseline gap-2.5" aria-hidden="true">
          <span className="text-5xl font-medium tracking-[-0.04em] leading-none text-slate-900 dark:text-slate-100">
            0
          </span>
          <span className="text-[11px] leading-tight text-slate-400">
            trackers, ads or
            <br />
            third-party scripts
          </span>
        </div>
      </Tile>
    </div>
  );
}

function Tile({
  className,
  icon,
  title,
  body,
  children,
}: {
  className?: string;
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // No card: the vignette sits on a grid that fades into the page, with the
    // words beneath it — whitespace, not a border, says where one ends.
    <div className={cn("group flex flex-col", className)}>
      <div
        data-pointer
        className="relative min-h-[7.5rem] flex items-center justify-center px-4"
      >
        <span className="line-grid" aria-hidden="true" />
        <span className="line-grid-hot" aria-hidden="true" />
        <div className="relative">{children}</div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-slate-400 dark:text-slate-500 transition-colors duration-300 group-hover:text-primary dark:group-hover:text-primary-glow">
        {icon}
        <h3 className="text-[15px] font-medium text-slate-900 dark:text-slate-100">{title}</h3>
      </div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400 [&_b]:font-normal [&_b]:text-slate-900 dark:[&_b]:text-slate-100">
        {body}
      </p>
    </div>
  );
}

function MiniChip({
  status,
  children,
}: {
  status: keyof typeof STATUS_CHIP;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center h-6 min-w-[2rem] px-1.5 rounded-md border text-[10px] font-bold",
        STATUS_CHIP[status]
      )}
    >
      {children}
    </span>
  );
}

/** One row of the teacher's grid, with Maya finishing 3.4 on a loop. */
function LiveVignette() {
  return (
    <div className="flex items-center gap-2.5" aria-hidden="true">
      <span className="w-7 h-7 shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 text-[10px] font-bold flex items-center justify-center">
        MI
      </span>
      <span className="hidden sm:inline text-[12px] font-medium text-slate-600 dark:text-slate-300 w-14 shrink-0">
        Maya I.
      </span>
      <div className="flex items-center gap-1.5">
        {["3.1", "3.2", "3.3"].map((n) => (
          <span
            key={n}
            className={cn(
              "h-6 w-9 sm:w-11 rounded-md border flex items-center justify-center",
              STATUS_CHIP.complete
            )}
          >
            <Check className="w-3 h-3" />
          </span>
        ))}
        <span className="relative h-6 w-9 sm:w-11">
          <span
            className={cn(
              "swap-a absolute inset-0 rounded-md border text-[10px] font-semibold flex items-center justify-center",
              STATUS_CHIP["in-progress"]
            )}
          >
            Active
          </span>
          <span
            className={cn(
              "swap-b absolute inset-0 rounded-md border flex items-center justify-center",
              STATUS_CHIP.complete
            )}
          >
            <Check className="w-3 h-3" />
          </span>
        </span>
      </div>
      <span className="swap-b hidden sm:inline text-[10.5px] text-slate-400 whitespace-nowrap">
        just now
      </span>
    </div>
  );
}
