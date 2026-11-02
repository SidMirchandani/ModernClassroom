"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { CurriculumUnit } from "./db/types";
import type { SectionRemap } from "./store";
import {
  applyChanges,
  buildChangeSet,
  undoRemaps,
  type ChangeSet,
  type CurriculumProposal,
} from "./curriculum-diff";
import {
  acceptedChangeIds,
  buildHunks,
  decisionOf,
  type Decision,
  type Decisions,
  type Hunk,
} from "./curriculum-review";
import {
  getFile,
  listChats,
  pruneChats,
  putFile,
  saveChat,
  titleFor,
  type AgentStep,
  type AssistantMessage,
  type Chat,
  type ChatFile,
  type ReviewState,
  type UserMessage,
} from "./curriculum-chat";
import { isDemoMode } from "./demo-seed";
import { takePendingImport } from "./pending-import";

/**
 * Reading a teacher's files into their curriculum — the one thing in the
 * curriculum the AI does. Every other edit is the teacher's own, by hand.
 *
 * An import runs in the import dialog, streams what it is doing, and ends in
 * a draft written over the curriculum for the teacher to accept or reject
 * row by row. One draft at a time; once its last row is decided, the
 * accepted ones are saved together, and the import can be undone for as long
 * as nothing else has changed the curriculum since.
 *
 * Imports are kept in this browser (IndexedDB, `curriculum-chat.ts`) — the
 * files, the draft and the decisions — so a reload mid-review loses nothing,
 * and the same files sent again against the same curriculum reuse the answer
 * instead of paying for it twice.
 */

export interface ImportReview {
  importId: string;
  set: ChangeSet;
  hunks: Hunk[];
  decisions: Decisions;
  /** Hunks still waiting for a decision. */
  left: number;
  applying: boolean;
  error: string;
  decide: (key: string, decision: Decision) => void;
  decideAll: (decision: Decision) => void;
  retry: () => void;
}

interface Options {
  classId: string;
  units: CurriculumUnit[];
  onApply: (units: CurriculumUnit[], remaps: SectionRemap[]) => Promise<void>;
  /** A draft arrived: the curriculum should be on screen to review it. */
  onDraft?: () => void;
}

/**
 * The demo's curriculum as the route needs it: everything but the
 * attachments, which can be whole files as data URLs.
 */
function slim(units: CurriculumUnit[]): CurriculumUnit[] {
  return units.map((unit) => ({
    ...unit,
    subunits: unit.subunits.map((section) => ({
      ...section,
      blocks: undefined,
      tracks: (section.tracks ?? []).map((track) => ({
        ...track,
        blocks: (track.blocks ?? []).map((block) => ({ ...block, attachments: [] })),
      })),
    })),
  }));
}

/**
 * The shape of a curriculum — ids, titles, dates, references, how many
 * activities each resource has, where each quiz sits — and nothing the store
 * adds or reorders on a save. Two curricula with the same shape are the same
 * curriculum as far as Undo is concerned.
 */
function shapeOf(units: CurriculumUnit[]): string {
  return JSON.stringify(
    units.map((u) => [
      u.id,
      u.title,
      (u.subunits ?? []).map((s) => [
        s.id,
        s.title,
        s.date ?? "",
        (s.tracks ?? []).map((t) => [t.id, t.reference ?? "", (t.blocks ?? []).length]),
      ]),
      (u.checkpoints ?? []).map((c) => [c.id, c.title, c.date ?? "", c.afterSectionId ?? ""]),
    ])
  );
}

function upsertStep(steps: AgentStep[], step: AgentStep): AgentStep[] {
  const at = steps.findIndex((s) => s.id === step.id);
  if (at < 0) return [...steps, step];
  // Whole, not merged: the server sends every field of a step each time, and
  // a field it drops (a finished step's "3 of 13") has to go.
  const next = [...steps];
  next[at] = step;
  return next;
}

/** An import is stored as a chat of two messages: what was sent, and what came back. */
function partsOf(chat: Chat): { user: UserMessage | null; result: AssistantMessage | null } {
  return {
    user: (chat.messages.find((m) => m.role === "user") as UserMessage | undefined) ?? null,
    result: (chat.messages.find((m) => m.role === "assistant") as AssistantMessage | undefined) ?? null,
  };
}

/**
 * A fingerprint of everything an import's answer depends on: the files'
 * bytes, the note, and the curriculum it is read against. The same
 * fingerprint means the same question — its answer can be reused.
 */
async function fingerprint(files: File[], note: string, units: CurriculumUnit[]): Promise<string | null> {
  try {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [encoder.encode(note.trim()), encoder.encode(JSON.stringify(slim(units)))];
    for (const file of files) {
      parts.push(encoder.encode(`\u0000${file.name}\u0000`));
      parts.push(new Uint8Array(await file.arrayBuffer()));
    }
    const total = parts.reduce((n, p) => n + p.length, 0);
    const all = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      all.set(p, at);
      at += p.length;
    }
    const digest = await crypto.subtle.digest("SHA-256", all);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // No fingerprint, no reuse — the import still runs.
    return null;
  }
}

export function useCurriculumImport({ classId, units, onApply, onDraft }: Options) {
  const [imports, setImports] = useState<Chat[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  // The import shown in the dialog: the one running, or the last one started.
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Imports run across awaits; they read and write through these, not stale closures.
  const classIdRef = useRef(classId);
  classIdRef.current = classId;
  const importsRef = useRef<Chat[]>([]);
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const abortRef = useRef<AbortController | null>(null);
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;

  const commit = useCallback((chat: Chat, persist: boolean) => {
    // An import from the class the teacher just left still finishes and is
    // saved — but never into this class's list.
    if (chat.classId !== classIdRef.current) {
      if (persist) void saveChat(chat);
      return;
    }
    const exists = importsRef.current.some((c) => c.id === chat.id);
    importsRef.current = exists
      ? importsRef.current.map((c) => (c.id === chat.id ? chat : c))
      : [chat, ...importsRef.current];
    setImports(importsRef.current);
    if (persist) void saveChat(chat);
  }, []);

  const patchResult = useCallback(
    (chatId: string, patch: (m: AssistantMessage) => AssistantMessage, persist = false) => {
      const chat = importsRef.current.find((c) => c.id === chatId);
      if (!chat) return;
      commit(
        {
          ...chat,
          updatedAt: Date.now(),
          messages: chat.messages.map((m) => (m.role === "assistant" ? patch(m) : m)),
        },
        persist
      );
    },
    [commit]
  );

  // ── the class's imports ────────────────────────────────────────────────
  useEffect(() => {
    let live = true;
    importsRef.current = [];
    setImports([]);
    setCurrentId(null);
    setLoaded(false);
    void listChats(classId).then((list) => {
      if (!live) return;
      // An import cut off by a reload never finished; say so instead of spinning.
      const settled = list.map((chat) => ({
        ...chat,
        messages: chat.messages.map((m) =>
          m.role === "assistant" && m.status === "running"
            ? {
                ...m,
                status: "stopped" as const,
                steps: m.steps.map((s) => (s.status === "run" ? { ...s, status: "fail" as const } : s)),
              }
            : m
        ),
      }));
      importsRef.current = settled;
      setImports(settled);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [classId]);

  const current = useMemo(() => {
    const chat = imports.find((c) => c.id === currentId) ?? null;
    return chat ? { chat, ...partsOf(chat) } : null;
  }, [imports, currentId]);

  // ── the draft under review ─────────────────────────────────────────────
  const pending = useMemo(() => {
    let found: { chat: Chat; result: AssistantMessage } | null = null;
    for (const chat of imports) {
      const { result } = partsOf(chat);
      if (!result || result.review?.status !== "pending" || !result.proposal) continue;
      if (!found || result.at > found.result.at) found = { chat, result };
    }
    return found;
  }, [imports]);

  const set = useMemo(
    () => (pending?.result.proposal ? buildChangeSet(units, pending.result.proposal) : null),
    [pending?.result.proposal, units]
  );
  const hunks = useMemo(() => (set ? buildHunks(set) : []), [set]);
  const decisions = useMemo(() => pending?.result.review?.decisions ?? {}, [pending?.result.review?.decisions]);
  const left = hunks.filter((h) => !decisionOf(h, decisions)).length;

  const setReview = useCallback(
    (chatId: string, review: ReviewState) => patchResult(chatId, (m) => ({ ...m, review }), true),
    [patchResult]
  );

  const decide = useCallback(
    (key: string, decision: Decision) => {
      if (!pending) return;
      const hunk = hunks.find((h) => h.key === key);
      if (!hunk) return;
      setApplyError("");
      setReview(pending.chat.id, {
        ...pending.result.review!,
        decisions: { ...decisions, [key]: { decision, signature: hunk.signature } },
      });
    },
    [pending, hunks, decisions, setReview]
  );

  const decideAll = useCallback(
    (decision: Decision) => {
      if (!pending) return;
      const next = { ...decisions };
      for (const hunk of hunks) {
        if (!decisionOf(hunk, next)) next[hunk.key] = { decision, signature: hunk.signature };
      }
      setApplyError("");
      setReview(pending.chat.id, { ...pending.result.review!, decisions: next });
    },
    [pending, hunks, decisions, setReview]
  );

  /**
   * Once the last hunk is decided, the accepted ones go in together — through
   * `applyCurriculum`, so a renumber moves the work filed under it in the same
   * write. The curriculum as it stood is kept with the import, for Undo.
   */
  const failedRef = useRef<string | null>(null);
  const finish = useCallback(
    async (force = false) => {
      if (!pending || !set || hunks.length === 0 || left > 0 || applying) return;
      const attempt = `${pending.result.id}:${JSON.stringify(decisions)}`;
      if (!force && failedRef.current === attempt) return;

      const ids = acceptedChangeIds(hunks, decisions);
      const accepted = hunks.filter((h) => decisionOf(h, decisions) === "accepted").length;
      if (ids.size === 0) {
        setReview(pending.chat.id, { ...pending.result.review!, status: "rejected", accepted: 0, total: hunks.length });
        return;
      }
      setApplying(true);
      setApplyError("");
      try {
        const before = structuredClone(unitsRef.current);
        const { units: next, remaps } = applyChanges(unitsRef.current, set, ids);
        await onApply(next, remaps);
        failedRef.current = null;
        setReview(pending.chat.id, {
          ...pending.result.review!,
          status: "applied",
          accepted,
          total: hunks.length,
          before,
          remaps,
          after: shapeOf(next),
        });
      } catch (err) {
        failedRef.current = attempt;
        const message = err instanceof Error ? err.message : "";
        setApplyError(
          /stale/i.test(message)
            ? "The curriculum changed while you were reviewing. Update from your files again."
            : "Those changes could not be saved"
        );
      } finally {
        setApplying(false);
      }
    },
    [pending, set, hunks, left, applying, decisions, onApply, setReview]
  );

  useEffect(() => {
    void finish();
  }, [finish]);

  // ── undo ───────────────────────────────────────────────────────────────
  /**
   * The last import whose changes were saved, while undoing it is still safe:
   * only as long as the curriculum has the shape that import left. Any edit
   * since — by hand or another import — and Undo is gone, rather than
   * quietly throwing that edit away.
   */
  const lastApplied = useMemo(() => {
    const applied = imports
      .map((chat) => ({ chat, result: partsOf(chat).result }))
      .filter((x) => x.result?.review?.status === "applied")
      .sort((a, b) => b.result!.at - a.result!.at)[0];
    return applied ?? null;
  }, [imports]);

  const canUndo = Boolean(
    lastApplied?.result?.review?.before &&
      lastApplied.result.review.after &&
      lastApplied.result.review.after === shapeOf(units)
  );

  const undo = useCallback(async () => {
    if (!lastApplied) return;
    const review = lastApplied.result!.review!;
    setApplying(true);
    setApplyError("");
    try {
      await onApply(review.before!, undoRemaps([review.remaps ?? []]));
      setReview(lastApplied.chat.id, { ...review, status: "undone", before: undefined, remaps: undefined, after: undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setApplyError(
        /stale/i.test(message)
          ? "The curriculum changed elsewhere — reload, then try again."
          : "The curriculum could not be put back."
      );
    } finally {
      setApplying(false);
    }
  }, [lastApplied, onApply, setReview]);

  // ── an import ──────────────────────────────────────────────────────────
  const run = useCallback(
    async (chatId: string) => {
      let chat = importsRef.current.find((c) => c.id === chatId)!;
      const { user } = partsOf(chat);
      if (!user) return;
      const result: AssistantMessage = {
        id: uuidv4(),
        role: "assistant",
        at: Date.now(),
        status: "running",
        steps: [],
      };
      chat = { ...chat, updatedAt: Date.now(), messages: [user, result] };
      commit(chat, true);
      setCurrentId(chat.id);

      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);
      const started = Date.now();
      const patch = (fn: (m: AssistantMessage) => AssistantMessage, persist = false) =>
        patchResult(chatId, fn, persist);

      /** The answer is in: written over the curriculum for review, or "nothing to change". */
      const land = (proposal: CurriculumProposal | null, reply: string, notes: string[], extra: AgentStep[] = []) => {
        const seconds = Math.round((Date.now() - started) / 1000);
        const draftSet = proposal ? buildChangeSet(unitsRef.current, proposal) : null;
        const count = draftSet ? buildHunks(draftSet).length : 0;
        const compare: AgentStep = {
          id: "compare",
          label: "Compare",
          target: "with what you already have",
          detail: count === 0 ? "nothing to change" : `${count} change${count === 1 ? "" : "s"}`,
          status: "done",
        };
        patch(
          (m) => ({
            ...m,
            status: "done",
            steps: [...extra, compare].reduce(upsertStep, m.steps),
            reply,
            notes,
            seconds,
            ...(proposal && count > 0
              ? { proposal, review: { status: "pending" as const, decisions: {} } }
              : {}),
          }),
          true
        );
        if (count > 0) onDraftRef.current?.();
      };

      try {
        const files = (await Promise.all(chat.files.map(getFile))).filter((f): f is File => f !== null);

        // The same files and note against the same curriculum: the answer is
        // already here. No request, no cost, no wait.
        const key = await fingerprint(files, user.text, unitsRef.current);
        if (key) {
          const live = importsRef.current.find((c) => c.id === chatId)!;
          commit(
            { ...live, messages: live.messages.map((m) => (m.role === "user" ? { ...m, cacheKey: key } : m)) },
            true
          );
          const earlier = importsRef.current
            .filter((c) => c.id !== chatId)
            .map(partsOf)
            .find((p) => p.user?.cacheKey === key && p.result?.status === "done");
          if (earlier?.result) {
            land(earlier.result.proposal ?? null, earlier.result.reply ?? "", earlier.result.notes ?? [], [
              {
                id: "reuse",
                label: "Read",
                target: "your files",
                detail: "unchanged since you last sent them — reused that reading",
                status: "done",
              },
            ]);
            return;
          }
        }

        const body = new FormData();
        for (const file of files) body.append("files", file, file.name);
        body.append("classId", classId);
        body.append("message", user.text);
        if (isDemoMode()) {
          body.append("demo", "1");
          body.append("units", JSON.stringify(slim(unitsRef.current)));
        }

        const response = await fetch("/api/curriculum/import", {
          method: "POST",
          body,
          signal: controller.signal,
        });

        if (!response.ok || !response.body || !/ndjson/.test(response.headers.get("content-type") ?? "")) {
          // Not every failure is ours to word: the platform answers an
          // oversized upload or a timed-out function with its own page.
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            payload.error ??
              (response.status === 413
                ? "Those files are too large to send — keep them under 4 MB"
                : response.status === 504
                  ? "That took too long. Try again, or with fewer files."
                  : "Something went wrong — try again")
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        while (!finished) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as
              | ({ t: "step" } & AgentStep)
              | { t: "reply"; text: string }
              | { t: "done"; proposal: CurriculumProposal | null; reply: string; notes: string[] }
              | { t: "error"; error: string };

            if (event.t === "reply") {
              patch((m) => ({ ...m, reply: event.text }));
              continue;
            }
            if (event.t === "step") {
              const { t, ...step } = event;
              void t;
              patch((m) => ({ ...m, steps: upsertStep(m.steps, step) }));
              continue;
            }
            if (event.t === "error") throw new Error(event.error);

            finished = true;
            land(event.proposal, event.reply, event.notes);
          }
        }

        if (!finished) throw new Error("The answer was cut off — try again");
      } catch (err) {
        const stopped = err instanceof DOMException && err.name === "AbortError";
        patch(
          (m) => ({
            ...m,
            status: stopped ? "stopped" : "failed",
            error: stopped ? undefined : err instanceof Error ? err.message : "Something went wrong — try again",
            steps: m.steps.map((s) => (s.status === "run" ? { ...s, status: "fail" as const } : s)),
            seconds: Math.round((Date.now() - started) / 1000),
          }),
          true
        );
      } finally {
        abortRef.current = null;
        setRunning(false);
        void pruneChats(classId);
      }
    },
    [classId, commit, patchResult]
  );

  /** Reads these files, with an optional note, into a draft. */
  const start = useCallback(
    async (files: File[], note: string) => {
      if (abortRef.current || files.length === 0) return;
      const metas: ChatFile[] = await Promise.all(
        files.map(async (file) => {
          const id = uuidv4();
          await putFile(id, file);
          return { id, name: file.name, type: file.type, size: file.size };
        })
      );
      const now = Date.now();
      const user: UserMessage = {
        id: uuidv4(),
        role: "user",
        at: now,
        text: note.trim(),
        fileIds: metas.map((m) => m.id),
      };
      const chat: Chat = {
        id: uuidv4(),
        classId,
        title: titleFor(note, files),
        createdAt: now,
        updatedAt: now,
        messages: [user],
        files: metas,
      };
      commit(chat, true);
      setApplyError("");
      await run(chat.id);
    },
    [classId, commit, run]
  );

  /** Runs a failed or stopped import again. */
  const retry = useCallback(() => {
    if (abortRef.current || !current) return;
    void run(current.chat.id);
  }, [current, run]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // A class created from the teacher's materials arrives with them waiting:
  // the import dialog opens and starts reading straight away. Checked once —
  // the ref survives React's double-run of effects in development.
  const handoffChecked = useRef(false);
  useEffect(() => {
    if (!loaded || handoffChecked.current) return;
    handoffChecked.current = true;
    const handed = takePendingImport(classId);
    if (!handed) return;
    setDialogOpen(true);
    void start(handed.files, handed.instructions);
  }, [loaded, classId, start]);

  const review: ImportReview | null =
    pending && set && hunks.length > 0
      ? {
          importId: pending.chat.id,
          set,
          hunks,
          decisions,
          left,
          applying,
          error: applyError,
          decide,
          decideAll,
          retry: () => void finish(true),
        }
      : null;

  return {
    loaded,
    running,
    dialogOpen,
    setDialogOpen,
    /** The import shown in the dialog. */
    current,
    start,
    stop,
    retry,
    review,
    /** Undo the last import's saved changes — only while nothing has changed since. */
    undo: canUndo ? undo : null,
    /** How many changes the last saved import made, for its Undo banner. */
    lastAppliedCount: canUndo ? (lastApplied?.result?.review?.accepted ?? 0) : 0,
    applying,
    applyError,
  };
}

export type CurriculumImporter = ReturnType<typeof useCurriculumImport>;
