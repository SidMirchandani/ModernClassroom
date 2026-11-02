"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import {
  contentToAdd,
  type Change,
  type PlannedCheckpoint,
  type PlannedSection,
  type PlannedUnit,
  type ProposedActivity,
} from "@/lib/curriculum-diff";
import { decisionOf, reviewRows, type Decision, type Hunk } from "@/lib/curriculum-review";
import type { ImportReview } from "@/lib/use-curriculum-import";
import { TRACK_KIND_LABELS } from "@/lib/section-tracks";
import type { CheckpointKind } from "@/lib/types";
import { CHECKPOINT_KIND_META } from "@/components/CheckpointRow";
import { cn } from "@/lib/utils";

/**
 * A draft from an import, written over the curriculum the way an editor shows
 * an agent's edits: removed rows in red, added rows in green, a changed row as
 * the old line over the new one. Each hunk — one row — carries its own Reject
 * and Accept, and a bar at the bottom steps through what is left. A decided
 * hunk stops being a diff and reads as the curriculum it will be; when the
 * last one is decided, the accepted ones are saved together.
 *
 * Every row shows its date, so the year can be checked against the teacher's
 * own calendar at a glance.
 */

// ── what a row says, before and after ───────────────────────────────────────

interface SectionView {
  number: string;
  title: string;
  date: string | null;
  refs: string[];
  objectives?: boolean;
}

interface CheckpointView {
  kind: CheckpointKind;
  title: string;
  date: string | null;
  /** Shown only when the proposal moves it. */
  after?: string | null;
}

const changed = (changes: Change[], kind: Change["kind"], field?: string) =>
  changes.find((c) => c.kind === kind && (field === undefined || c.field === field));

function sectionBefore(section: PlannedSection): SectionView | null {
  const existing = section.existing;
  if (!existing) return null;
  return {
    number: existing.id,
    title: existing.title,
    date: existing.date || null,
    refs: section.tracks
      .filter((t) => t.existing?.reference)
      .map((t) => `${t.existing!.label} ${t.existing!.reference}`),
  };
}

function sectionAfter(section: PlannedSection, changes: Change[]): SectionView | null {
  const { existing, proposed } = section;
  if (!existing && proposed) {
    return {
      number: proposed.number,
      title: proposed.title,
      date: proposed.date || null,
      refs: (proposed.tracks ?? [])
        .filter((t) => t.reference)
        .map((t) => `${t.label || TRACK_KIND_LABELS[t.kind]} ${t.reference}`),
    };
  }
  if (!existing) return null;
  if (changed(changes, "section-remove")) return null;
  const before = sectionBefore(section)!;
  if (changes.length === 0) return before;

  const refs = section.tracks
    .map((track) => {
      if (track.existing) {
        const ref =
          changed(changes, "track-reference", `${track.existing.label} reference`)?.after ??
          track.existing.reference;
        return ref ? `${track.existing.label} ${ref}` : null;
      }
      const added = changes.find((c) => c.kind === "track-add" && c.after?.startsWith(track.label));
      return added?.after ? added.after.replace(" — ", " ") : null;
    })
    .filter((r): r is string => Boolean(r));

  return {
    number: changed(changes, "section-renumber")?.after ?? before.number,
    title: changed(changes, "section-title")?.after ?? before.title,
    date: changed(changes, "section-date")?.after ?? before.date,
    refs,
    objectives: Boolean(changed(changes, "section-objectives")),
  };
}

function checkpointBefore(checkpoint: PlannedCheckpoint): CheckpointView | null {
  const existing = checkpoint.existing;
  if (!existing) return null;
  return { kind: existing.kind, title: existing.title, date: existing.date || null };
}

function checkpointAfter(checkpoint: PlannedCheckpoint, changes: Change[]): CheckpointView | null {
  const { existing, proposed } = checkpoint;
  if (!existing && proposed) {
    return { kind: proposed.kind ?? "quiz", title: proposed.title, date: proposed.date || null };
  }
  if (!existing) return null;
  if (changed(changes, "checkpoint-remove")) return null;
  const field = (name: string) => changed(changes, "checkpoint-field", name)?.after;
  const moved = changed(changes, "checkpoint-field", "Sits after");
  return {
    kind: (field("Kind") as CheckpointKind | undefined) ?? existing.kind,
    title: field("Title") ?? existing.title,
    date: field("Date") ?? existing.date ?? null,
    after: moved ? moved.after : undefined,
  };
}

// ── lines ───────────────────────────────────────────────────────────────────

type Tone = "add" | "del" | "same";

function Line({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start pr-3 py-1.5 text-sm",
        tone === "add" && "bg-emerald-500/[0.09] dark:bg-emerald-400/[0.10]",
        tone === "del" && "bg-rose-500/[0.08] dark:bg-rose-400/[0.10]"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "w-7 shrink-0 text-center select-none",
          tone === "add" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
        )}
      >
        {tone === "add" ? "+" : tone === "del" ? "−" : ""}
      </span>
      {tone !== "same" && <span className="sr-only">{tone === "add" ? "Added: " : "Removed: "}</span>}
      <div
        className={cn(
          "min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5",
          tone === "del" && "opacity-70 line-through decoration-rose-400/60"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function DateTag({ date }: { date: string | null }) {
  if (!date) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
      <CalendarDays className="w-3 h-3 shrink-0" />
      {date}
    </span>
  );
}

function SectionLine({
  view,
  tone,
  open,
  onToggle,
  fills,
}: {
  view: SectionView;
  tone: Tone;
  /** Its content is showing beneath it. */
  open?: boolean;
  onToggle?: () => void;
  /** The draft fills in content here — say so on the line itself. */
  fills?: boolean;
}) {
  return (
    <div
      onClick={(e) => {
        if (!onToggle) return;
        e.stopPropagation();
        onToggle();
      }}
      className={cn(onToggle && "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/30")}
    >
      <Line tone={tone}>
        <span className="w-10 shrink-0 text-xs text-slate-400 tabular-nums">{view.number}</span>
        <span className="text-slate-800 dark:text-slate-100">{view.title}</span>
        <DateTag date={view.date} />
        {view.refs.map((ref) => (
          <span key={ref} className="text-xs text-slate-400 dark:text-slate-500">
            {ref}
          </span>
        ))}
        {(fills || (view.objectives && tone === "add")) && (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">+ content</span>
        )}
        {onToggle && (
          <ChevronRight
            aria-label={open ? "Hide what is in it" : "Show what is in it"}
            className={cn(
              "ml-auto self-center w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200",
              open && "rotate-90"
            )}
          />
        )}
      </Line>
    </div>
  );
}

// ── what a subunit holds ────────────────────────────────────────────────────

interface Item {
  text: string;
  tone: Tone;
}

/** Shown as a diff while undecided; as what it will be, or what it was, once decided. */
type Show = "diff" | "after" | "before";

function keep(items: Item[], show: Show): Item[] {
  if (show === "diff") return items;
  return items
    .filter((i) => (show === "after" ? i.tone !== "del" : i.tone !== "add"))
    .map((i) => ({ ...i, tone: "same" as const }));
}

function activityText(title: string | undefined, instructions: string | null | undefined): string {
  return [title?.trim(), instructions?.trim()].filter(Boolean).join(" — ");
}

function proposedActivity(a: ProposedActivity | null | undefined): string {
  return a ? activityText(a.title, a.instructions) : "";
}

function ItemList({ items }: { items: Item[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item, i) => (
        <li
          key={i}
          className={cn(
            "flex items-baseline gap-1.5 text-xs leading-relaxed rounded px-1 -mx-1",
            item.tone === "add" && "bg-emerald-500/[0.09] text-emerald-900 dark:text-emerald-100",
            item.tone === "del" && "bg-rose-500/[0.08] text-slate-500 line-through decoration-rose-400/60",
            item.tone === "same" && "text-slate-600 dark:text-slate-300"
          )}
        >
          <span aria-hidden className="w-2.5 shrink-0 text-center text-slate-400">
            {item.tone === "add" ? "+" : item.tone === "del" ? "−" : "•"}
          </span>
          <span className="min-w-0">{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Everything a subunit holds — its objectives, and on each resource the
 * reference, targets, and the Learn and Practice activities — with what the
 * draft adds marked as it is in the rows above. Opened from the row.
 */
function SectionDetail({
  section,
  changes,
  show,
}: {
  section: PlannedSection;
  changes: Change[];
  show: Show;
}) {
  const { existing, proposed } = section;
  const isNew = !existing;
  const addAll = (texts: string[]): Item[] => texts.filter(Boolean).map((text) => ({ text, tone: "add" }));
  const same = (texts: string[]): Item[] => texts.filter(Boolean).map((text) => ({ text, tone: "same" }));

  const objectivesChange = changes.find((c) => c.kind === "section-objectives");
  const objectives: Item[] = isNew
    ? addAll(proposed?.objectives ?? [])
    : objectivesChange
      ? [
          ...(existing.objectives ?? []).map((o) => ({ text: o.text, tone: "del" as const })),
          ...addAll(proposed?.objectives ?? []),
        ]
      : same((existing.objectives ?? []).map((o) => o.text));

  const tracks = section.tracks
    .map((track) => {
      const label = track.existing?.label ?? track.label;
      const fresh = !track.existing;
      // A new resource on an existing subunit is only added if its own row
      // was proposed; one on a new subunit comes with the subunit.
      if (fresh && !isNew && !changes.some((c) => c.kind === "track-add" && c.after?.startsWith(track.label))) {
        return null;
      }

      const refChange = changes.find((c) => c.kind === "track-reference" && c.field === `${label} reference`);
      const reference: Item[] = fresh
        ? addAll([track.proposed?.reference ?? ""])
        : refChange
          ? [
              ...(track.existing!.reference ? [{ text: track.existing!.reference, tone: "del" as const }] : []),
              { text: refChange.after ?? "", tone: "add" as const },
            ]
          : same([track.existing!.reference ?? ""]);

      const filling =
        !fresh && track.proposed && changes.some((c) => c.kind === "track-content" && c.field === `${label} content`)
          ? contentToAdd(track.existing!, track.proposed)
          : null;

      const blocksOf = (step: "learn" | "practice") =>
        (track.existing?.blocks ?? [])
          .filter((b) => b.type === step)
          .map((b) => activityText(b.title, b.description));

      const targets: Item[] = fresh
        ? addAll(track.proposed?.objectives ?? [])
        : [...same((track.existing!.objectives ?? []).map((o) => o.text)), ...addAll(filling?.objectives ?? [])];
      const learn: Item[] = fresh
        ? addAll([proposedActivity(track.proposed?.learn)])
        : [...same(blocksOf("learn")), ...addAll([proposedActivity(filling?.learn)])];
      const practice: Item[] = fresh
        ? addAll([proposedActivity(track.proposed?.practice)])
        : [...same(blocksOf("practice")), ...addAll([proposedActivity(filling?.practice)])];

      return {
        key: `${track.kind}:${label}`,
        label,
        reference: keep(reference, show),
        targets: keep(targets, show),
        learn: keep(learn, show),
        practice: keep(practice, show),
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const shownObjectives = keep(objectives, show);
  const empty =
    shownObjectives.length === 0 &&
    tracks.every((t) => !t.targets.length && !t.learn.length && !t.practice.length && !t.reference.length);

  return (
    <div className="fade-in ml-7 mr-3 my-1.5 pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-3 py-1">
      {empty && <p className="text-xs text-slate-400">Nothing in it yet.</p>}

      {shownObjectives.length > 0 && (
        <div>
          <p className="eyebrow-muted mb-1">Objectives</p>
          <ItemList items={shownObjectives} />
        </div>
      )}

      {tracks.map((track) => {
        const has = track.targets.length || track.learn.length || track.practice.length || track.reference.length;
        if (!has) return null;
        return (
          <div key={track.key} className="space-y-1.5">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {track.label}
              {track.reference.length === 1 && track.reference[0].tone === "same" && (
                <span className="font-normal text-slate-400"> · {track.reference[0].text}</span>
              )}
            </p>
            {!(track.reference.length === 1 && track.reference[0].tone === "same") && track.reference.length > 0 && (
              <ItemList items={track.reference} />
            )}
            {[
              ["Targets", track.targets],
              ["Learn", track.learn],
              ["Practice", track.practice],
            ].map(([name, items]) =>
              (items as Item[]).length > 0 ? (
                <div key={name as string} className="flex gap-2">
                  <span className="w-14 shrink-0 text-[11px] text-slate-400 pt-px">{name as string}</span>
                  <div className="min-w-0 flex-1">
                    <ItemList items={items as Item[]} />
                  </div>
                </div>
              ) : null
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckpointLine({ view, tone }: { view: CheckpointView; tone: Tone }) {
  const meta = CHECKPOINT_KIND_META[view.kind];
  return (
    <Line tone={tone}>
      {/* At least the section numbers' width, so titles line up — but never
          less than the word: "Checkpoint" ran into its own title. */}
      <span className={cn("min-w-10 shrink-0 text-xs", meta.accent)}>{meta.label}</span>
      <span className={cn("font-medium", meta.accent)}>{view.title}</span>
      <DateTag date={view.date} />
      {view.after !== undefined && (
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {view.after ? `after ${view.after}` : "at the start of the unit"}
        </span>
      )}
    </Line>
  );
}

function UnitLine({ title, detail, tone }: { title: string; detail?: string; tone: Tone }) {
  return (
    <Line tone={tone}>
      <span className="font-medium text-primary dark:text-primary-glow">{title}</span>
      {detail && <span className="text-xs text-slate-400 dark:text-slate-500">{detail}</span>}
    </Line>
  );
}

// ── a hunk ──────────────────────────────────────────────────────────────────

function Kbd({ children }: { children: ReactNode }) {
  return <span className="hidden md:inline opacity-60 font-normal">{children}</span>;
}

function HunkBox({
  hunk,
  current,
  keys,
  onSelect,
  onDecide,
  children,
}: {
  hunk: Hunk;
  current: boolean;
  keys: { accept: string; reject: string } | null;
  onSelect: () => void;
  onDecide: (decision: Decision) => void;
  children: ReactNode;
}) {
  return (
    <div
      id={`hunk-${hunk.key}`}
      onClick={onSelect}
      className={cn(
        "relative mb-5 scroll-mt-40 scroll-mb-28 outline outline-1 -outline-offset-1 transition-[outline-color] duration-200",
        current ? "outline-primary/50" : "outline-transparent"
      )}
    >
      {children}
      {hunk.destructive && (
        <p className="pl-7 pr-3 pb-1.5 bg-rose-500/[0.08] dark:bg-rose-400/[0.10] text-[11px] text-rose-700 dark:text-rose-300">
          Accepting removes it from the curriculum. Work students did under it is kept, and comes back if it returns.
        </p>
      )}
      <div className="absolute right-2 -bottom-3.5 z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDecide("rejected");
          }}
          className="h-6 px-2 inline-flex items-center gap-1.5 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 shadow-sm transition-colors"
        >
          Reject {current && keys && <Kbd>{keys.reject}</Kbd>}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDecide("accepted");
          }}
          className="h-6 px-2 inline-flex items-center gap-1.5 rounded-md text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
        >
          Accept {current && keys && <Kbd>{keys.accept}</Kbd>}
        </button>
      </div>
    </div>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

// ── the review ──────────────────────────────────────────────────────────────

export function CurriculumReview({ review }: { review: ImportReview }) {
  const { set, hunks, decisions } = review;
  const byKey = useMemo(() => new Map(hunks.map((h) => [h.key, h])), [hunks]);
  const open = hunks.filter((h) => !decisionOf(h, decisions));

  const [currentKey, setCurrentKey] = useState<string | null>(null);
  // Subunits opened to show what is in them.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setOpened((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [scrollTo, setScrollTo] = useState<{ key: string } | null>(null);
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  // The current hunk is the one chosen, while it is still open; otherwise the
  // next open one after it, so deciding a hunk moves on down the page.
  const current = useMemo(() => {
    const at = currentKey ? hunks.findIndex((h) => h.key === currentKey) : -1;
    if (at >= 0 && !decisionOf(hunks[at], decisions)) return hunks[at];
    return hunks.slice(at + 1).find((h) => !decisionOf(h, decisions)) ?? open[0] ?? null;
  }, [currentKey, hunks, decisions, open]);
  const position = current ? open.indexOf(current) : -1;

  useEffect(() => {
    if (!scrollTo) return;
    document
      .getElementById(`hunk-${scrollTo.key}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [scrollTo]);

  const go = useCallback(
    (step: 1 | -1) => {
      if (open.length === 0) return;
      const next = open[(Math.max(0, position) + step + open.length) % open.length];
      setCurrentKey(next.key);
      setScrollTo({ key: next.key });
    },
    [open, position]
  );

  const decideOne = useCallback(
    (hunk: Hunk, decision: Decision) => {
      review.decide(hunk.key, decision);
      setCurrentKey(hunk.key);
      const at = open.indexOf(hunk);
      const next = open[at + 1] ?? open[at - 1];
      if (next && next !== hunk) setScrollTo({ key: next.key });
    },
    [review, open]
  );

  // The editor's keys: ⌘⏎ / ⌘⌫ for the current hunk, with ⇧ for all of them,
  // ⌥↑ / ⌥↓ to move. Not while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || review.applying) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "Enter" || e.key === "Backspace")) {
        const decision: Decision = e.key === "Enter" ? "accepted" : "rejected";
        e.preventDefault();
        if (e.shiftKey) review.decideAll(decision);
        else if (current) decideOne(current, decision);
      } else if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        go(e.key === "ArrowDown" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [review, current, decideOne, go]);

  const keys = { accept: mac ? "⌘⏎" : "Ctrl+⏎", reject: mac ? "⌘⌫" : "Ctrl+⌫" };

  function box(hunk: Hunk, children: ReactNode) {
    return (
      <HunkBox
        key={hunk.key}
        hunk={hunk}
        current={current === hunk}
        keys={keys}
        onSelect={() => setCurrentKey(hunk.key)}
        onDecide={(decision) => decideOne(hunk, decision)}
      >
        {children}
      </HunkBox>
    );
  }

  /** A row: a hunk while open; once decided, the line it leaves behind. */
  function row<V>(
    key: string,
    before: V | null,
    after: V | null,
    draw: (view: V, tone: Tone) => ReactNode,
    hunk: Hunk | undefined,
    /** What is inside the row, when it has been opened. */
    detail?: (show: Show) => ReactNode,
    /** Only what is inside changes: one line, not the same line twice. */
    sameLine = false
  ) {
    if (!hunk) {
      return before || after ? (
        <div key={key}>
          {draw((before ?? after)!, "same")}
          {detail?.("before")}
        </div>
      ) : null;
    }
    const decision = decisionOf(hunk, decisions);
    if (decision === "accepted") {
      return after ? (
        <div key={key}>
          {draw(after, "same")}
          {detail?.("after")}
        </div>
      ) : null;
    }
    if (decision === "rejected") {
      return before ? (
        <div key={key}>
          {draw(before, "same")}
          {detail?.("before")}
        </div>
      ) : null;
    }
    return box(
      hunk,
      <>
        {before && !sameLine && draw(before, "del")}
        {after && draw(after, "add")}
        {detail?.("diff")}
      </>
    );
  }

  function renderRows(unit: PlannedUnit, tone?: Tone) {
    return reviewRows(unit).map((r) => {
      if (r.kind === "section") {
        const key = `sec|${unit.key}|${r.section.key}`;
        const hunk = byKey.get(key);
        const changes = hunk?.changes ?? [];
        const view = sectionAfter(r.section, changes);
        const open = opened.has(key);
        const fills = changes.some((c) => c.kind === "track-content");
        const detail = (show: Show) =>
          open ? <SectionDetail section={r.section} changes={changes} show={show} /> : null;
        if (tone) {
          return view ? (
            <div key={key}>
              <SectionLine view={view} tone={tone} open={open} onToggle={() => toggle(key)} />
              {detail(tone === "add" ? "diff" : "after")}
            </div>
          ) : null;
        }
        const before = sectionBefore(r.section);
        const sameLine =
          before !== null &&
          view !== null &&
          JSON.stringify({ ...before, objectives: undefined }) === JSON.stringify({ ...view, objectives: undefined });
        return row(
          key,
          before,
          view,
          // The line that will remain carries the toggle: the new one in a
          // diff, the only one otherwise.
          (v, t) => (
            <SectionLine
              view={v}
              tone={t}
              open={open}
              fills={fills && t !== "del"}
              onToggle={t === "del" ? undefined : () => toggle(key)}
            />
          ),
          hunk,
          detail,
          sameLine
        );
      }
      const key = `cp|${unit.key}|${r.checkpoint.key}`;
      const hunk = byKey.get(key);
      const view = checkpointAfter(r.checkpoint, hunk?.changes ?? []);
      if (tone) return view ? <CheckpointLine key={key} view={view} tone={tone} /> : null;
      return row(
        key,
        checkpointBefore(r.checkpoint),
        view,
        (v, t) => <CheckpointLine view={v} tone={t} />,
        hunk
      );
    });
  }

  function renderUnit(unit: PlannedUnit) {
    const unitHunk = byKey.get(`unit|${unit.key}`);
    const touched = hunks.some((h) => h.unitKey === unit.key);
    const sections = (unit.proposed?.sections.length ?? unit.existing?.subunits.length ?? 0);
    const detail = `${sections} subunit${sections === 1 ? "" : "s"}`;

    // A unit the draft does not touch stays one quiet line.
    if (!touched) {
      return (
        <div key={unit.key} className="py-1">
          <UnitLine title={unit.existing?.title ?? unit.proposed?.title ?? "Unit"} detail={`${detail} · no changes`} tone="same" />
        </div>
      );
    }

    // A new unit is one hunk: all of it, or none of it.
    if (!unit.existing && unit.proposed && unitHunk) {
      const decision = decisionOf(unitHunk, decisions);
      if (decision === "rejected") return null;
      const tone: Tone = decision === "accepted" ? "same" : "add";
      const body = (
        <>
          <UnitLine title={unit.proposed.title} detail={`${detail} · new`} tone={tone} />
          {renderRows(unit, tone)}
        </>
      );
      return (
        <div key={unit.key} className="py-1">
          {decision ? body : box(unitHunk, body)}
        </div>
      );
    }

    const titleBefore = unit.existing?.title ?? "";
    const titleAfter = unitHunk ? (changed(unitHunk.changes, "unit-title")?.after ?? titleBefore) : titleBefore;
    return (
      <div key={unit.key} className="py-1">
        {row(
          `unit|${unit.key}`,
          titleBefore,
          titleAfter,
          (title, tone) => <UnitLine title={title} detail={tone === "del" ? undefined : detail} tone={tone} />,
          unitHunk
        )}
        {renderRows(unit)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Curriculum</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {open.length > 0
            ? `${open.length} of ${hunks.length} to review`
            : review.applying
              ? "Saving…"
              : `${hunks.length} reviewed`}
        </span>
      </div>

      <div className="card divide-y divide-slate-100 dark:divide-slate-800/60 py-1">
        {set.plan.units.map(renderUnit)}
      </div>

      {/* The editor's review bar: where you are, and everything at once. */}
      <div className="sticky bottom-4 z-20 mt-4 flex justify-center pointer-events-none">
        <div className="pointer-events-auto float-pane-raised rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg flex items-center gap-1 p-1 text-xs">
          {review.applying ? (
            <span className="h-7 px-3 inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving to your curriculum…
            </span>
          ) : review.error && open.length === 0 ? (
            <>
              <span className="h-7 px-2 inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
                {review.error}
              </span>
              <button type="button" onClick={review.retry} className="btn btn-sm btn-primary h-7">
                Try again
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={open.length < 2}
                aria-label="Previous change"
                className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <span className="min-w-[4.5rem] text-center tabular-nums text-slate-600 dark:text-slate-300">
                {position + 1} of {open.length}
              </span>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={open.length < 2}
                aria-label="Next change"
                className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" aria-hidden />
              <button
                type="button"
                onClick={() => review.decideAll("rejected")}
                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Reject all <Kbd>{mac ? "⇧⌘⌫" : "Ctrl+⇧+⌫"}</Kbd>
              </button>
              <button
                type="button"
                onClick={() => review.decideAll("accepted")}
                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Accept all <Kbd>{mac ? "⇧⌘⏎" : "Ctrl+⇧+⏎"}</Kbd>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
