"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, MessageSquare, XCircle } from "lucide-react";
import type { CurriculumUnit } from "@/lib/db/types";
import type { AgentStep } from "@/lib/curriculum-chat";
import type { CurriculumImporter } from "@/lib/use-curriculum-import";
import { Modal } from "@/components/Modal";
import { FileDrop, MAX_UPLOAD_MB, totalMegabytes } from "./FileDrop";
import { cn } from "@/lib/utils";

/**
 * Reading a teacher's file into their curriculum — the one place the
 * curriculum uses AI — as two plain steps a teacher who rarely touches
 * software can follow: choose the file (a large area and a button that says
 * exactly what it does), then watch a checklist tick off in whole sentences
 * until "Done — 14 changes found" and one button to look at them.
 *
 * The dialog can be closed while it reads; the work carries on and the
 * changes land on the curriculum when they are ready.
 */

type ItemState = "done" | "run" | "wait" | "fail";
interface Item {
  key: string;
  text: string;
  state: ItemState;
}

/**
 * The server's steps, as a teacher would say them, with the stages still to
 * come listed underneath, greyed — so the checklist shows how far there is
 * to go, not only how far it has got.
 */
function checklist(steps: AgentStep[], running: boolean): Item[] {
  const state = (s: AgentStep): ItemState => (s.status === "run" ? "run" : s.status === "fail" ? "fail" : "done");
  const items: Item[] = [];
  const seen = new Set<string>();

  for (const step of steps) {
    const done = step.status === "done";
    let text: string;
    if (step.id === "reuse") {
      text = "This is the same file as last time, so the earlier reading was used";
    } else if (step.id.startsWith("file:")) {
      text = `Opened ${step.target}${step.detail ? ` (${step.detail})` : ""}`;
      seen.add("open");
    } else if (step.id === "curriculum") {
      text = step.detail === "nothing yet" ? "Your class is empty — building it fresh" : `Looked at your current curriculum (${step.detail})`;
    } else if (step.id === "analyse") {
      text = done ? "Read your file" : step.status === "fail" ? "Couldn't finish reading your file" : "Reading your file";
      seen.add("read");
    } else if (step.id === "plan") {
      const n = step.detail ?? "";
      text = done ? `Found ${n}` : `Finding the units — ${n} so far`;
      seen.add("plan");
    } else if (step.id === "write") {
      text = done ? `Matched lessons and dates for ${step.target}` : `Matching lessons and dates — ${step.detail ?? step.target}`;
      seen.add("write");
    } else if (step.id === "retry") {
      text = "It needed a second try — still going";
    } else if (step.id === "check") {
      text = "Checked every unit";
    } else if (step.id === "compare") {
      text = `Compared with your current curriculum — ${step.detail}`;
      seen.add("compare");
    } else {
      text = `${step.label} ${step.target}`;
    }
    items.push({ key: step.id, text, state: state(step) });
  }

  if (running && !steps.some((s) => s.id === "reuse")) {
    const ahead: [string, string][] = [
      ["read", "Read your file"],
      ["plan", "Find the units"],
      ["write", "Match lessons and dates"],
      ["compare", "Compare with your current curriculum"],
    ];
    for (const [key, text] of ahead) {
      if (!seen.has(key)) items.push({ key: `wait:${key}`, text, state: "wait" });
    }
  }
  return items;
}

function ItemIcon({ state }: { state: ItemState }) {
  if (state === "done") return <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  if (state === "run") return <Loader2 className="w-5 h-5 shrink-0 animate-spin text-amber-500" />;
  if (state === "fail") return <XCircle className="w-5 h-5 shrink-0 text-rose-500" />;
  return <Circle className="w-5 h-5 shrink-0 text-slate-300 dark:text-slate-600" />;
}

export function ImportDialog({
  importer,
  units,
}: {
  importer: CurriculumImporter;
  units: CurriculumUnit[];
}) {
  const { dialogOpen, setDialogOpen, current, running, review } = importer;
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  // Whether the dialog is showing an import — running, or just finished —
  // rather than the first step of a new one.
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (running) setShowing(true);
  }, [running]);

  const empty = units.length === 0;
  const result = current?.result ?? null;
  const tooLarge = totalMegabytes(files) > MAX_UPLOAD_MB;
  const reviewing = review !== null && review.importId !== current?.chat.id;
  const view: "choose" | "working" | "result" = running ? "working" : showing && result ? "result" : "choose";

  function close() {
    setDialogOpen(false);
    // A finished import is not shown again on the next open: that is step 1.
    if (!running) setShowing(false);
  }

  function begin(chosen: File[] = files) {
    if (chosen.length === 0) return;
    void importer.start(chosen, note);
    setFiles([]);
    setNote("");
  }

  const changes = review && review.importId === current?.chat.id ? review.hunks.length : 0;
  const items = result ? checklist(result.steps, running) : [];

  return (
    <Modal
      open={dialogOpen}
      onClose={close}
      title={empty ? "Build your curriculum from a file" : "Update your curriculum from a file"}
      className="max-w-xl"
    >
      {/* Where they are, always: two steps, numbered. */}
      <div className="flex items-center gap-2 mb-5 text-sm">
        {[
          ["1", "Choose your file", view === "choose"],
          ["2", "We read it", view !== "choose"],
        ].map(([n, label, on], i) => (
          <div key={n as string} className="flex items-center gap-2">
            {i > 0 && <span className="w-8 border-t border-slate-300 dark:border-slate-600" aria-hidden />}
            <span
              className={cn(
                "w-7 h-7 rounded-full inline-flex items-center justify-center text-sm font-medium",
                on
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              )}
            >
              {n}
            </span>
            <span className={on ? "font-medium text-slate-900 dark:text-slate-100" : "text-slate-500"}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {view === "choose" && (
        <div className="space-y-5">
          {reviewing ? (
            <p className="rounded-xl bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-[15px] text-amber-900 dark:text-amber-200">
              You still have changes from your last file to look at. Accept or reject those first, then come
              back here.
            </p>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                Upload your pacing guide, calendar or syllabus. We&apos;ll show you every change before
                anything is saved.
              </p>
              <FileDrop files={files} onFilesChange={setFiles} />
              {files.length > 0 && (
                <label className="block space-y-1.5">
                  <span className="text-[15px] font-medium text-slate-800 dark:text-slate-100">
                    Anything we should know? <span className="font-normal text-slate-500">(optional)</span>
                  </span>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="block w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-[15px] leading-relaxed focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              )}
              <div className="flex items-center justify-between gap-3 pt-1">
                <span />
                <button
                  type="button"
                  disabled={files.length === 0 || tooLarge}
                  onClick={() => begin()}
                  className="btn btn-lg btn-primary"
                >
                  {empty ? "Build my curriculum" : "Read my file"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {view !== "choose" && result && (
        <div className="space-y-5">
          {view === "working" && (
            <p className="text-[15px] text-slate-600 dark:text-slate-300">
              This usually takes under a minute. You can close this window — we&apos;ll keep going.
            </p>
          )}

          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.key} className="flex items-start gap-3 text-[15px] leading-snug">
                <ItemIcon state={item.state} />
                <span
                  className={cn(
                    item.state === "wait" && "text-slate-400 dark:text-slate-500",
                    item.state === "run" && "font-medium text-slate-900 dark:text-slate-100",
                    item.state === "done" && "text-slate-700 dark:text-slate-200",
                    item.state === "fail" && "text-rose-700 dark:text-rose-300"
                  )}
                >
                  {item.text}
                </span>
              </li>
            ))}
          </ul>

          {view === "result" && result.status === "done" && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/20 px-4 py-4 flex items-start gap-3">
              <CheckCircle2 className="w-7 h-7 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-emerald-900 dark:text-emerald-100">
                  {changes > 0
                    ? `Done — ${changes} change${changes === 1 ? "" : "s"} found`
                    : result.proposal
                      ? "Done"
                      : "Done — your file matches what you already have"}
                </p>
                {result.reply && (
                  <p className="mt-1 text-[15px] leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">
                    {result.reply}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Set apart and labelled, so nobody reads it as part of the changes. */}
          {view === "result" && result.notes && result.notes.length > 0 && (
            <div className="rounded-xl border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 flex gap-3">
              <MessageSquare className="w-5 h-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div className="min-w-0 space-y-1.5">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  A note for you — this isn&apos;t added to your curriculum
                </p>
                {result.notes.map((n, i) => (
                  <p key={i} className="text-[15px] text-slate-700 dark:text-slate-200">
                    {n}
                  </p>
                ))}
              </div>
            </div>
          )}

          {view === "result" && result.status === "failed" && (
            <p className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-[15px] text-rose-800 dark:text-rose-200">
              {result.error}
            </p>
          )}
          {view === "result" && result.status === "stopped" && (
            <p className="text-[15px] text-slate-600 dark:text-slate-300">Stopped. Nothing was changed.</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            {view === "working" && (
              <>
                <button type="button" onClick={importer.stop} className="btn btn-lg btn-ghost">
                  Stop
                </button>
                <button type="button" onClick={close} className="btn btn-lg btn-secondary">
                  Close and keep going
                </button>
              </>
            )}
            {view === "result" && (result.status === "failed" || result.status === "stopped") && (
              <>
                <button type="button" onClick={() => setShowing(false)} className="btn btn-lg btn-secondary">
                  Choose a different file
                </button>
                <button type="button" onClick={importer.retry} className="btn btn-lg btn-primary">
                  Try again
                </button>
              </>
            )}
            {view === "result" && result.status === "done" && changes > 0 && (
              <button type="button" onClick={close} className="btn btn-lg btn-primary">
                Look at the changes
              </button>
            )}
            {view === "result" && result.status === "done" && changes === 0 && (
              <button type="button" onClick={close} className="btn btn-lg btn-secondary">
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
