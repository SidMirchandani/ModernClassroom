"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  History,
  Loader2,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Pencil,
  RotateCcw,
  Square,
  SquarePen,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import type { CurriculumUnit } from "@/lib/db/types";
import type { AgentStep, AssistantMessage, Chat, UserMessage } from "@/lib/curriculum-chat";
import type { Hunk } from "@/lib/curriculum-review";
import { AGENT_WIDTH, type AgentReview, type CurriculumAgent } from "@/lib/use-curriculum-agent";
import { isDemoMode } from "@/lib/demo-seed";
import { sampleTimeline } from "@/lib/sample-timeline";
import { Logo } from "@/components/Logo";
import { Popover } from "@/components/Popover";
import { ACCEPTED_MATERIALS, MAX_UPLOAD_MB, totalMegabytes } from "./MaterialsPicker";
import { cn } from "@/lib/utils";

/**
 * The curriculum chat, docked beside the class like an editor's agent panel.
 *
 * The conversation lives here; the work lands in the main space. Each turn
 * shows what the assistant is actually doing, line by line as the server
 * reports it — "Reading", "Planning", "Writing Unit 7" — then folds that away
 * into "Worked for 34s" once it is done, and types out what it has to say.
 * Notes, set apart, are never part of the curriculum. A draft appears as an
 * edit card whose Accept and Reject act on the same review the curriculum
 * shows.
 *
 * The teacher's messages are chat bubbles they can edit (which answers them
 * again from there) or copy; a message sent mid-turn queues. Docked on a wide
 * screen, as wide as its left edge is dragged, with the class making room
 * beside it; below that it covers the screen. Minimised, it leaves a tab on
 * the right edge to bring it back (or ⌘I / Ctrl+I).
 */

const iconButton =
  "w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors";

const smallAction =
  "h-6 px-1.5 inline-flex items-center gap-1 rounded-md text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors";

/** What a step's verb says while it runs, and once it has. */
const VERBS: Record<string, [string, string]> = {
  Read: ["Reading", "Read"],
  Think: ["Thinking", "Thought"],
  Plan: ["Planning", "Planned"],
  Write: ["Writing", "Wrote"],
  Check: ["Checking", "Checked"],
  Compare: ["Comparing", "Compared"],
  Retry: ["Retrying", "Retried"],
};

function verb(step: AgentStep): string {
  const forms = VERBS[step.label];
  if (!forms) return step.label;
  return step.status === "done" ? forms[1] : forms[0];
}

function ago(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Types a reply out as it arrives, catching up faster the further behind it
 * is — so a reply that streams in word by word reads as typing, and one that
 * lands all at once still unrolls in a second or so. Off without motion.
 */
function useTypewriter(text: string, active: boolean): string {
  const [shown, setShown] = useState(active ? 0 : text.length);
  const shownRef = useRef(shown);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!active || still) {
      shownRef.current = text.length;
      setShown(text.length);
      return;
    }
    if (shownRef.current > text.length) shownRef.current = 0;
    let frame = 0;
    const tick = () => {
      const gap = text.length - shownRef.current;
      if (gap <= 0) return;
      shownRef.current += Math.max(1, Math.ceil(gap / 14));
      setShown(shownRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, active]);

  return text.slice(0, Math.min(shown, text.length));
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={smallAction}
      aria-label="Copy"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── a turn's steps ──────────────────────────────────────────────────────────

function StepRow({ step }: { step: AgentStep }) {
  const [opened, setOpened] = useState<boolean | null>(null);
  const items = step.items ?? [];
  // A plan stays open while it is being written, so the units can be watched
  // arriving; once done it folds away unless the teacher opens it.
  const expanded = items.length > 0 && (opened ?? step.status === "run");
  const content = (
    <>
      <span className="w-4 h-5 shrink-0 inline-flex items-center justify-center">
        {step.status === "run" ? (
          <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
        ) : step.status === "fail" ? (
          <X className="w-3 h-3 text-rose-500" />
        ) : (
          <Check className="w-3 h-3 text-slate-300 dark:text-slate-600" />
        )}
      </span>
      <span
        className={cn(
          "shrink-0 font-medium",
          step.status === "run"
            ? "shimmer-text text-slate-800 dark:text-slate-100"
            : step.status === "fail"
              ? "text-slate-400"
              : "text-slate-600 dark:text-slate-300"
        )}
      >
        {verb(step)}
      </span>
      <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">{step.target}</span>
      {step.detail && (
        <span className="shrink-0 text-slate-400 dark:text-slate-500 tabular-nums">· {step.detail}</span>
      )}
      {items.length > 0 && (
        <ChevronRight
          className={cn("w-3 h-3 shrink-0 text-slate-400 transition-transform duration-200", expanded && "rotate-90")}
        />
      )}
    </>
  );

  return (
    <li>
      {items.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpened(!expanded)}
          aria-expanded={expanded}
          className="w-full flex items-center gap-1.5 text-[13px] leading-6 text-left hover:opacity-80"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-1.5 text-[13px] leading-6">{content}</div>
      )}
      {expanded && (
        <ul className="fade-in ml-2 mt-0.5 mb-1.5 pl-3.5 border-l border-slate-200 dark:border-slate-800 space-y-0.5">
          {items.map((item, i) => (
            <li key={i} className="text-xs leading-5 text-slate-500 dark:text-slate-400 truncate">
              {item}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * The work of a turn: in full while it runs; folded into one line —
 * "Worked for 34s" — once it is over, opened again on a click.
 */
function Steps({ message, actions }: { message: AssistantMessage; actions?: ReactNode }) {
  const [opened, setOpened] = useState(false);
  const running = message.status === "running";
  const idle = running && !message.steps.some((s) => s.status === "run");

  if (running) {
    return (
      <ul className="space-y-px">
        {message.steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
        {idle && (
          <li className="flex items-center gap-1.5 text-[13px] leading-6">
            <span className="w-4 inline-flex justify-center">
              <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
            </span>
            <span className="font-medium shimmer-text text-slate-800 dark:text-slate-100">
              {message.reply ? "Writing" : "Working"}
            </span>
          </li>
        )}
      </ul>
    );
  }

  if (message.steps.length === 0) return null;
  const summary =
    message.status === "stopped"
      ? `Stopped after ${message.seconds ?? 0}s`
      : message.status === "failed"
        ? `Stopped by an error after ${message.seconds ?? 0}s`
        : `Worked for ${message.seconds ?? 0}s`;

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpened((o) => !o)}
          aria-expanded={opened}
          className="inline-flex items-center gap-1 text-[13px] leading-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          {summary}
          <ChevronRight className={cn("w-3 h-3 transition-transform duration-200", opened && "rotate-90")} />
        </button>
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
      {opened && (
        <ul className="fade-in mt-1 space-y-px">
          {message.steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── the edit card ───────────────────────────────────────────────────────────

/** "+3 −1" per unit, the way an editor counts a file's lines. */
function unitCounts(review: AgentReview) {
  const byUnit = new Map<string, { title: string; plus: number; minus: number }>();
  const titleOf = (key: string) => {
    const unit = review.set.plan.units.find((u) => u.key === key);
    return unit?.proposed?.title ?? unit?.existing?.title ?? "Unit";
  };
  const weigh = (hunk: Hunk) => {
    if (hunk.changes.some((c) => c.kind === "unit-add")) {
      const unit = review.set.plan.units.find((u) => u.key === hunk.unitKey);
      return { plus: 1 + (unit?.sections.length ?? 0) + (unit?.checkpoints.length ?? 0), minus: 0 };
    }
    const adds = hunk.changes.every((c) => c.before === null);
    const removes = hunk.changes.every((c) => c.after === null);
    return { plus: removes ? 0 : 1, minus: adds ? 0 : 1 };
  };
  for (const hunk of review.hunks) {
    const entry = byUnit.get(hunk.unitKey) ?? { title: titleOf(hunk.unitKey), plus: 0, minus: 0 };
    const { plus, minus } = weigh(hunk);
    entry.plus += plus;
    entry.minus += minus;
    byUnit.set(hunk.unitKey, entry);
  }
  return [...byUnit.values()];
}

function EditCard({
  message,
  review,
  onReview,
}: {
  message: AssistantMessage;
  review: AgentReview | null;
  onReview: () => void;
}) {
  const state = message.review!;
  const live = state.status === "pending" && review?.messageId === message.id ? review : null;
  const [showAll, setShowAll] = useState(false);
  const units = live ? unitCounts(live) : [];
  const shown = showAll ? units : units.slice(0, 6);

  const status = live
    ? live.applying
      ? "Saving…"
      : `${live.left} of ${live.hunks.length} to review`
    : state.status === "applied"
      ? `Accepted ${state.accepted} of ${state.total}`
      : state.status === "rejected"
        ? "Rejected"
        : state.status === "superseded"
          ? "Replaced by a newer draft"
          : "No longer on screen";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden">
      <button
        type="button"
        onClick={live ? onReview : undefined}
        disabled={!live}
        className="w-full flex items-center gap-2 px-3 h-10 text-[13px] text-left enabled:hover:bg-slate-50 dark:enabled:hover:bg-slate-800/40 transition-colors"
      >
        <Table2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
        <span className="font-medium text-slate-800 dark:text-slate-100">Curriculum</span>
        <span
          className={cn(
            "ml-auto text-xs tabular-nums",
            state.status === "applied" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
          )}
        >
          {status}
        </span>
      </button>

      {live && (
        <>
          <ul className="border-t border-slate-100 dark:border-slate-800 px-3 py-2 space-y-1">
            {shown.map((unit, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{unit.title}</span>
                <span className="ml-auto shrink-0 tabular-nums">
                  {unit.plus > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{unit.plus}</span>}
                  {unit.minus > 0 && <span className="ml-1.5 text-rose-500">−{unit.minus}</span>}
                </span>
              </li>
            ))}
            {units.length > shown.length && (
              <li>
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {units.length - shown.length} more
                </button>
              </li>
            )}
          </ul>
          <div className="border-t border-slate-100 dark:border-slate-800 px-2 py-1.5 flex items-center gap-1">
            <button
              type="button"
              onClick={onReview}
              className="h-7 px-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Review
            </button>
            <button
              type="button"
              disabled={live.applying}
              onClick={() => live.decideAll("rejected")}
              className="ml-auto h-7 px-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              Reject all
            </button>
            <button
              type="button"
              disabled={live.applying}
              onClick={() => live.decideAll("accepted")}
              className="h-7 px-2.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors"
            >
              Accept all
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── messages ────────────────────────────────────────────────────────────────

function FileChip({ name }: { name: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 max-w-full h-7 pl-2 pr-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
      <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" />
      <span className="truncate max-w-[13rem] text-slate-700 dark:text-slate-200">{name}</span>
    </li>
  );
}

/** The teacher's own message: a bubble on the right, editable in place. */
function UserTurn({
  message,
  chat,
  busy,
  onEdit,
}: {
  message: UserMessage;
  chat: Chat;
  busy: boolean;
  onEdit: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const files = message.fileIds
    .map((id) => chat.files.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 200)}px`;
  }, [draft, editing]);

  function save() {
    const text = draft.trim();
    if (!text && files.length === 0) return;
    setEditing(false);
    if (text !== message.text) onEdit(text);
  }

  return (
    <div className="group flex flex-col items-end gap-1.5 pl-6">
      {files.length > 0 && (
        <ul className="flex flex-wrap justify-end gap-1.5">
          {files.map((file) => (
            <FileChip key={file.id} name={file.name} />
          ))}
        </ul>
      )}

      {editing ? (
        <div className="w-full rounded-2xl border border-primary/50 bg-white dark:bg-slate-900 shadow-[0_0_0_4px_rgb(var(--primary)/0.1)]">
          <textarea
            ref={areaRef}
            autoFocus
            rows={1}
            value={draft}
            aria-label="Edit message"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                setEditing(false);
                setDraft(message.text);
              }
            }}
            className="block w-full resize-none bg-transparent border-0 px-3.5 pt-2.5 pb-1 text-sm leading-relaxed text-slate-900 dark:text-slate-100 focus-visible:!shadow-none focus-visible:outline-none"
          />
          <div className="flex items-center justify-end gap-1 px-2 pb-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(message.text);
              }}
              className="btn btn-sm btn-ghost h-7"
            >
              Cancel
            </button>
            <button type="button" onClick={save} disabled={busy} className="btn btn-sm btn-primary h-7">
              Send
            </button>
          </div>
        </div>
      ) : (
        message.text && (
          // Edit and Copy sit beside the bubble, shown on hover — beside, not
          // under, so they take no height of their own between messages.
          <div className="max-w-full flex items-end gap-1">
            <div className="shrink-0 flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => {
                  setDraft(message.text);
                  setEditing(true);
                }}
                disabled={busy}
                className={smallAction}
                aria-label="Edit"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <CopyButton text={message.text} />
            </div>
            <div className="min-w-0 rounded-2xl rounded-br-md bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-sm leading-relaxed text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">
              {message.text}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function AssistantTurn({
  message,
  live,
  last,
  busy,
  review,
  onReview,
  onRetry,
}: {
  message: AssistantMessage;
  /** This visit's newest turn: its reply types out. */
  live: boolean;
  last: boolean;
  busy: boolean;
  review: AgentReview | null;
  onReview: () => void;
  onRetry: () => void;
}) {
  const reply = message.reply ?? "";
  const typed = useTypewriter(reply, live);
  const typing = live && (typed.length < reply.length || (message.status === "running" && reply !== ""));
  const done = message.status !== "running";

  return (
    <div className="group space-y-2">
      {/* An earlier reply's Copy rides on its "Worked for" line, shown on
          hover, so it adds no height between messages; the latest reply
          keeps its actions in a row of their own, always shown. */}
      <Steps
        message={message}
        actions={
          !last && done && reply ? (
            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <CopyButton text={reply} />
            </div>
          ) : undefined
        }
      />

      {message.review && done && <EditCard message={message} review={review} onReview={onReview} />}

      {reply && (
        <div className="space-y-2.5 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
          {typed.split(/\n{2,}/).map((paragraph, i, all) => (
            <p key={i} className="whitespace-pre-wrap break-words">
              {paragraph}
              {typing && i === all.length - 1 && (
                <span
                  aria-hidden
                  className="inline-block w-[2px] h-[1.05em] ml-0.5 -mb-[0.15em] bg-slate-800 dark:bg-slate-100 animate-pulse"
                />
              )}
            </p>
          ))}
        </div>
      )}

      {/* Set apart and labelled, so nobody reads it as part of the draft: it
          is not in the curriculum and accepting never adds it. */}
      {done && !typing && message.notes && message.notes.length > 0 && (
        <div className="fade-in rounded-xl border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2.5 flex gap-2.5">
          <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
              Note · not added to your curriculum
            </p>
            {message.notes.map((note, i) => (
              <p key={i} className="text-sm text-slate-700 dark:text-slate-200">
                {note}
              </p>
            ))}
          </div>
        </div>
      )}

      {message.status === "failed" && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{message.error}</p>
      )}

      {last && done && !typing && (
        <div className="flex items-center gap-0.5 -ml-1.5 -mt-1">
          {reply && <CopyButton text={reply} />}
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className={smallAction}
            aria-label={message.status === "done" ? "Answer again" : "Try again"}
            title={message.status === "done" ? "Answer again" : "Try again"}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {message.status !== "done" && <span>Try again</span>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── the composer ────────────────────────────────────────────────────────────

function Composer({
  files,
  onFilesChange,
  onAttach,
  running,
  onSend,
  onStop,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onAttach: () => void;
  running: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const tooLarge = totalMegabytes(files) > MAX_UPLOAD_MB;
  const canSend = !tooLarge && (text.trim() !== "" || files.length > 0);

  // Grows with what is typed, to a point, then scrolls.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 180)}px`;
  }, [text]);

  function submit() {
    if (!canSend) return;
    onSend(text);
    setText("");
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:border-primary/50 focus-within:shadow-[0_0_0_4px_rgb(var(--primary)/0.1)]">
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="fade-in inline-flex items-center gap-1.5 max-w-full h-7 pl-2 pr-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs"
            >
              <FileText className="w-3 h-3 shrink-0 text-slate-400" />
              <span className="truncate max-w-[11rem] text-slate-700 dark:text-slate-200">{file.name}</span>
              <button
                type="button"
                onClick={() => onFilesChange(files.filter((_, i) => i !== index))}
                className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={areaRef}
        rows={1}
        value={text}
        aria-label="Message"
        placeholder={running ? "Queue a message" : "Message"}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        className="block w-full resize-none bg-transparent border-0 px-3.5 pt-3 pb-1 text-sm leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:!shadow-none focus-visible:outline-none"
      />
      <div className="flex items-center gap-1 px-2 pb-2">
        <button type="button" onClick={onAttach} className={iconButton} aria-label="Attach files" title="Attach files">
          <Paperclip className="w-4 h-4" />
        </button>
        {tooLarge && (
          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
            Over {MAX_UPLOAD_MB} MB — remove a file
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {running && (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              title="Stop"
              className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-80 transition-opacity"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
            </button>
          )}
          {(!running || canSend) && (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label={running ? "Queue" : "Send"}
              title={running ? "Queue — sends when this reply is done" : "Send"}
              className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-80 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 transition-[opacity,background-color]"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── the panel ───────────────────────────────────────────────────────────────

function Suggestion({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-left text-sm text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
    >
      <span className="text-slate-400 shrink-0">{icon}</span>
      {children}
    </button>
  );
}

export function AgentPanel({
  agent,
  units,
  onReview,
}: {
  agent: CurriculumAgent;
  units: CurriculumUnit[];
  onReview: () => void;
}) {
  const { open, setOpen, activeChat, chats, running, review, docked, width } = agent;
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [demoClass, setDemoClass] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Follows the conversation down while the teacher is at the bottom of it,
  // and leaves them be once they have scrolled up to read.
  const stick = useRef(true);

  // The sample is the demo's own: a real class is built from real files.
  useEffect(() => setDemoClass(isDemoMode() && agent.classId.startsWith("demo-")), [agent.classId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  });

  useEffect(() => {
    stick.current = true;
  }, [activeChat?.id]);

  function send(text: string, extra: File[] = []) {
    stick.current = true;
    void agent.send(text, [...files, ...extra]);
    setFiles([]);
  }

  const messages = activeChat?.messages ?? [];
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  // Working: amber. Something new to look at: blue.
  const dot = running ? "bg-amber-500 animate-pulse" : agent.unseen || review ? "bg-blue-500" : null;

  let body: ReactNode;
  if (!agent.loaded) {
    // Saved chats are a moment away; an empty state now would flash.
    body = null;
  } else if (messages.length === 0) {
    body = (
      <div className="min-h-full flex flex-col items-center justify-center text-center px-6 py-10">
        <Logo size={44} showText={false} />
        <h3 className="mt-4 text-base font-medium text-slate-900 dark:text-slate-100">
          {units.length === 0 ? "Build this class from your files" : "Change your curriculum"}
        </h3>
        <p className="mt-1.5 max-w-[19rem] text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Attach a time line, syllabus or plan, or just ask. Nothing changes until you accept it.
        </p>
        <div className="mt-6 w-full max-w-[17rem] space-y-2">
          <Suggestion icon={<Paperclip className="w-4 h-4" />} onClick={() => inputRef.current?.click()}>
            Attach files
          </Suggestion>
          {units.length > 0 && (
            <Suggestion
              icon={<MessageSquare className="w-4 h-4" />}
              onClick={() => send("Summarize this curriculum for me.")}
            >
              Summarize this curriculum
            </Suggestion>
          )}
          {demoClass && units.length > 0 && (
            <Suggestion icon={<FileText className="w-4 h-4" />} onClick={() => send("", [sampleTimeline(units)])}>
              Try a sample time line
            </Suggestion>
          )}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="space-y-4">
        {messages.map((message) =>
          message.role === "user" ? (
            <UserTurn
              key={message.id}
              message={message}
              chat={activeChat!}
              busy={running}
              onEdit={(text) => {
                stick.current = true;
                void agent.editMessage(message.id, text);
              }}
            />
          ) : (
            <AssistantTurn
              key={message.id}
              message={message}
              live={message.id === agent.liveId}
              last={message.id === lastAssistant?.id}
              busy={running}
              review={review}
              onReview={onReview}
              onRetry={() => agent.retry(message.id)}
            />
          )
        )}
      </div>
    );
  }

  /**
   * The left edge is a handle: drag it to widen or narrow the docked panel,
   * double-click it to put it back. The class beside it follows the width
   * live, so a drag never leaves anything underneath the panel.
   */
  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    if (!docked || e.button !== 0) return;
    e.preventDefault();
    agent.setResizing(true);
    // Followed on the window, not the handle: the pointer leaves a 12px strip
    // the moment it moves.
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    let last = width;
    const move = (event: PointerEvent) => {
      // The page's own width, not the window's: the scrollbar is not page.
      last = document.documentElement.clientWidth - event.clientX;
      agent.setWidth(last, false);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      agent.setWidth(last);
      agent.setResizing(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  return (
    <>
      {/* Minimised, the panel leaves a tab on the edge of the screen just
          below the navbar — where it went, and how to bring it back. On a
          phone it sits below the tab capsule's row. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        tabIndex={open ? -1 : 0}
        aria-hidden={open}
        aria-label="Open chat"
        title="Open chat (Ctrl+I)"
        className={cn(
          // As narrow as the page's side margin, so it never sits over the
          // class as the page scrolls under it; it reaches out when pointed at.
          "fixed right-0 z-30 top-[7.25rem] sm:top-[4.5rem] h-11 w-6 hover:w-10 focus-visible:w-10 inline-flex items-center justify-center",
          "rounded-l-xl border border-r-0 border-slate-200 dark:border-slate-700 float-pane-raised shadow-md",
          "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
          "transition-[transform,width,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-full pointer-events-none" : "translate-x-0"
        )}
      >
        <PanelRightOpen className="w-3.5 h-3.5 shrink-0" />
        {dot && <span className={cn("absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full", dot)} aria-hidden />}
      </button>

      <aside
        aria-label="Chat"
        inert={!open}
        style={docked ? { width } : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          setFiles((current) => [...current, ...Array.from(e.dataTransfer.files)].slice(0, 10));
        }}
        className={cn(
          "fixed top-14 right-0 bottom-0 z-40 flex flex-col",
          // Docked it is as wide as it was dragged; otherwise it is the whole
          // screen — never a panel half over the page.
          !docked && "w-full",
          "bg-white dark:bg-[#0b0f16] border-l border-slate-200 dark:border-slate-800",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {docked && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat"
            aria-valuenow={width}
            tabIndex={0}
            onPointerDown={startResize}
            onDoubleClick={() => agent.setWidth(AGENT_WIDTH.initial)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                agent.setWidth(width + (e.key === "ArrowLeft" ? 24 : -24));
              }
            }}
            className={cn(
              "group absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize touch-none outline-none",
              "after:absolute after:inset-y-0 after:left-[5px] after:w-0.5 after:transition-colors after:duration-150",
              agent.resizing
                ? "after:bg-primary/60"
                : "hover:after:bg-primary/40 focus-visible:after:bg-primary/60"
            )}
          />
        )}

        <div className="h-12 shrink-0 flex items-center gap-2 pl-4 pr-1.5 border-b border-slate-200 dark:border-slate-800">
          <Logo size={18} showText={false} />
          <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {activeChat?.title ?? "New chat"}
          </span>
          {running && (
            <span className="shrink-0 inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden />
              Working
            </span>
          )}
          <div className="flex items-center">
            <button
              type="button"
              onClick={agent.newChat}
              disabled={running || !activeChat}
              className={iconButton}
              aria-label="New chat"
              title="New chat"
            >
              <SquarePen className="w-4 h-4" />
            </button>
            <Popover
              label={<History className="w-4 h-4" />}
              triggerClassName={iconButton}
              triggerTitle="Past chats"
              width={300}
            >
              {(close) =>
                chats.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-500">No chats yet</p>
                ) : (
                  <div className="p-1.5">
                    <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-medium text-slate-400">Past chats</p>
                    <ul className="max-h-80 overflow-y-auto">
                      {chats.map((chat) => (
                        <li key={chat.id} className="group flex items-center">
                          <button
                            type="button"
                            disabled={running}
                            onClick={() => {
                              agent.selectChat(chat.id);
                              close();
                            }}
                            className={cn(
                              "flex-1 min-w-0 flex items-center gap-2 h-9 px-2.5 rounded-lg text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50",
                              chat.id === activeChat?.id && "bg-slate-100 dark:bg-slate-800"
                            )}
                          >
                            <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-200">
                              {chat.title}
                            </span>
                            <span className="shrink-0 text-xs text-slate-400 tabular-nums">{ago(chat.updatedAt)}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => agent.deleteChat(chat.id)}
                            disabled={running && chat.id === activeChat?.id}
                            className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-rose-500 transition-opacity"
                            aria-label={`Delete ${chat.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              }
            </Popover>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={iconButton}
              aria-label="Minimise chat"
              title="Minimise (Ctrl+I)"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-5"
        >
          {body}
        </div>

        <div className="shrink-0 px-3 pb-3 pt-2 space-y-2">
          {/* Sent mid-turn: each goes out, in order, as the turn before it ends. */}
          {agent.queue.length > 0 && (
            <ul className="space-y-1.5">
              {agent.queue.map((item) => (
                <li
                  key={item.id}
                  className="fade-in flex items-center gap-2 pl-3 pr-1 h-9 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs"
                >
                  <Clock3 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="shrink-0 text-slate-400">Queued</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                    {item.text || item.files.map((f) => f.name).join(", ")}
                  </span>
                  {!running && (
                    <button
                      type="button"
                      onClick={() => agent.sendQueued(item.id)}
                      className={smallAction}
                      aria-label="Send now"
                      title="Send now"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => agent.unqueue(item.id)}
                    className={smallAction}
                    aria-label="Remove from queue"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Composer
            files={files}
            onFilesChange={setFiles}
            onAttach={() => inputRef.current?.click()}
            running={running}
            onSend={(text) => send(text)}
            onStop={agent.stop}
          />
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_MATERIALS}
            className="hidden"
            onChange={(e) => {
              setFiles((current) => [...current, ...Array.from(e.target.files ?? [])].slice(0, 10));
              e.target.value = "";
            }}
          />
        </div>

        {dragging && (
          <div className="absolute inset-2 top-14 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-medium text-primary dark:text-primary-glow">Drop to attach</span>
          </div>
        )}
      </aside>
    </>
  );
}
