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
  carryDecisions,
  decisionOf,
  describeHunk,
  type Decision,
  type Decisions,
  type Hunk,
} from "./curriculum-review";
import {
  deleteChat as removeChat,
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
  type ChatMessage,
  type Mention,
  type ReviewState,
  type UserMessage,
} from "./curriculum-chat";
import { isDemoMode } from "./demo-seed";
import { takePendingImport } from "./pending-import";

/**
 * The curriculum chat, as one hook: the class's conversations, the turn in
 * progress, and the draft under review.
 *
 * It lives in the class view rather than the chat panel because its two
 * halves are on different parts of the screen — the conversation in the
 * sidebar, the draft written over the curriculum in the main space — and
 * both have to read the same decisions.
 *
 * There is only ever one draft under review per class, whichever chat made
 * it: it is what is on the curriculum, so it is also what a follow-up in any
 * chat is about.
 */

/** Vercel refuses a body over 4.5 MB; the chat resends a conversation's files within this. */
const MAX_SEND_BYTES = 4 * 1024 * 1024;
const WIDTH_KEY = "modern-classroom-agent-width";
/** The panel's width when docked, dragged by its left edge. */
export const AGENT_WIDTH = { initial: 400, min: 320, max: 760 } as const;
/** Docked beside the class at this width and up; below it, the panel covers the page. */
const DOCK_QUERY = "(min-width: 1024px)";
/** What the class keeps beside a docked panel, however wide it is dragged. */
const MIN_CONTENT = 520;

/** A width the screen can actually give, leaving the class room beside it. */
export function clampWidth(width: number): number {
  const room =
    typeof window === "undefined" ? AGENT_WIDTH.max : document.documentElement.clientWidth - MIN_CONTENT;
  return Math.round(Math.max(AGENT_WIDTH.min, Math.min(width, AGENT_WIDTH.max, room)));
}

/** A message sent while a turn was running, waiting for it to finish. */
export interface QueuedMessage {
  id: string;
  text: string;
  files: File[];
  mentions: Mention[];
}

export interface AgentReview {
  chatId: string;
  messageId: string;
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
  /** Points the next message at this change. */
  mention: (key: string) => void;
  mentioned: ReadonlySet<string>;
}

interface Options {
  classId: string;
  units: CurriculumUnit[];
  onApply: (units: CurriculumUnit[], remaps: SectionRemap[]) => Promise<void>;
  /** A draft arrived: the main space should show it. */
  onDraft?: () => void;
}

/**
 * The demo's curriculum as the route needs it: every activity's title and
 * instructions — the format a new subunit is written to — but none of the
 * attachments, which can be whole files as data URLs. Dropping the activities
 * too once left the demo with no format to copy at all.
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

/** The conversation as the model is told it: what was said, and what came of it. */
function historyOf(messages: ChatMessage[], files: ChatFile[]) {
  return messages.flatMap<{ role: "teacher" | "assistant"; text: string }>((message) => {
    if (message.role === "user") {
      const names = message.fileIds
        .map((id) => files.find((f) => f.id === id)?.name)
        .filter(Boolean);
      const about = (message.mentions ?? []).map((m) => m.label);
      const text = [
        message.text,
        names.length > 0 ? `(attached: ${names.join(", ")})` : "",
        about.length > 0 ? `(about: ${about.join("; ")})` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return text ? [{ role: "teacher" as const, text }] : [];
    }
    if (message.status !== "done") return [];
    const outcome =
      message.review?.status === "applied"
        ? `(The teacher accepted ${message.review.accepted} of ${message.review.total} of these changes.)`
        : message.review?.status === "rejected"
          ? "(The teacher rejected this draft.)"
          : "";
    const text = [message.reply, ...(message.notes ?? []).map((n) => `Note: ${n}`), outcome]
      .filter(Boolean)
      .join("\n");
    return text ? [{ role: "assistant" as const, text }] : [];
  });
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

/** The newest draft still under review, across every chat in the class. */
function findPending(chats: Chat[]): { chat: Chat; message: AssistantMessage } | null {
  let found: { chat: Chat; message: AssistantMessage } | null = null;
  for (const chat of chats) {
    for (const message of chat.messages) {
      if (message.role !== "assistant" || message.review?.status !== "pending" || !message.proposal) {
        continue;
      }
      if (!found || message.at > found.message.at) found = { chat, message };
    }
  }
  return found;
}

export function useCurriculumAgent({ classId, units, onApply, onDraft }: Options) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [open, setOpenState] = useState(false);
  const [width, setWidthState] = useState<number>(AGENT_WIDTH.initial);
  const [docked, setDocked] = useState(false);
  const [resizing, setResizing] = useState(false);
  // The width the teacher chose; what is shown is this, clamped to the window.
  const preferredRef = useRef<number>(AGENT_WIDTH.initial);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  // Changes in the draft the next message is about.
  const [mentions, setMentions] = useState<Mention[]>([]);
  // A turn finished while the panel was minimised: its tab shows a dot.
  const [unseen, setUnseen] = useState(false);
  // The turn this visit started most recently — the one whose reply types out.
  const [liveId, setLiveId] = useState<string | null>(null);
  const openRef = useRef(false);
  openRef.current = open;

  // Turns run across awaits; they read and write through these, not stale closures.
  const classIdRef = useRef(classId);
  classIdRef.current = classId;
  const chatsRef = useRef<Chat[]>([]);
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const abortRef = useRef<AbortController | null>(null);
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;

  const commit = useCallback((chat: Chat, persist: boolean) => {
    // A turn from the class the teacher just left still finishes and is
    // saved — but into its own class's list, never into this one's.
    if (chat.classId !== classIdRef.current) {
      if (persist) void saveChat(chat);
      return;
    }
    const exists = chatsRef.current.some((c) => c.id === chat.id);
    chatsRef.current = exists
      ? chatsRef.current.map((c) => (c.id === chat.id ? chat : c))
      : [chat, ...chatsRef.current];
    setChats(chatsRef.current);
    if (persist) void saveChat(chat);
  }, []);

  const patchMessage = useCallback(
    (chatId: string, messageId: string, patch: (m: AssistantMessage) => AssistantMessage, persist = false) => {
      const chat = chatsRef.current.find((c) => c.id === chatId);
      if (!chat) return;
      commit(
        {
          ...chat,
          updatedAt: Date.now(),
          messages: chat.messages.map((m) =>
            m.id === messageId && m.role === "assistant" ? patch(m) : m
          ),
        },
        persist
      );
    },
    [commit]
  );

  // ── open or minimised ──────────────────────────────────────────────────
  // Every class opens with the chat docked beside it. Not remembered: it is
  // how the class is worked on, so it should be there on arrival rather than
  // wherever it was last left. On a phone, where it would cover the class
  // whole, it starts minimised instead.
  useEffect(() => {
    setOpenState(window.matchMedia(DOCK_QUERY).matches);
  }, []);

  // Docked or covering, and a width that still fits when the window shrinks.
  useEffect(() => {
    let saved = NaN;
    try {
      saved = Number(window.localStorage.getItem(WIDTH_KEY));
    } catch {
      saved = NaN;
    }
    if (Number.isFinite(saved) && saved > 0) preferredRef.current = saved;
    const query = window.matchMedia(DOCK_QUERY);
    const fit = () => {
      setDocked(query.matches);
      setWidthState(clampWidth(preferredRef.current));
    };
    fit();
    query.addEventListener("change", fit);
    window.addEventListener("resize", fit);
    return () => {
      query.removeEventListener("change", fit);
      window.removeEventListener("resize", fit);
    };
  }, []);

  /** While dragging, `persist` is false; the width is remembered when the drag ends. */
  const setWidth = useCallback((next: number, persist = true) => {
    const value = clampWidth(next);
    setWidthState(value);
    if (!persist) return;
    preferredRef.current = value;
    try {
      window.localStorage.setItem(WIDTH_KEY, String(value));
    } catch {
      // A private window keeps it for the visit.
    }
  }, []);

  useEffect(() => {
    if (open) setUnseen(false);
  }, [open]);

  const setOpen = useCallback((next: boolean | ((was: boolean) => boolean)) => {
    setOpenState(next);
  }, []);

  // ── the class's chats ──────────────────────────────────────────────────
  useEffect(() => {
    let live = true;
    // Another class's chats are never on screen, not even for the moment
    // this one's take to load.
    chatsRef.current = [];
    setChats([]);
    setActiveId(null);
    setLoaded(false);
    void listChats(classId).then((list) => {
      if (!live) return;
      // A turn cut off by a reload never finished; say so instead of spinning.
      const settled = list.map((chat) => ({
        ...chat,
        messages: chat.messages.map((m) =>
          m.role === "assistant" && m.status === "running"
            ? { ...m, status: "stopped" as const, steps: m.steps.map((s) => (s.status === "run" ? { ...s, status: "fail" as const } : s)) }
            : m
        ),
      }));
      chatsRef.current = settled;
      setChats(settled);
      setActiveId(settled[0]?.id ?? null);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [classId]);

  const activeChat = chats.find((c) => c.id === activeId) ?? null;

  // ── the draft under review ─────────────────────────────────────────────
  const pending = useMemo(() => findPending(chats), [chats]);
  const set = useMemo(
    () => (pending?.message.proposal ? buildChangeSet(units, pending.message.proposal) : null),
    [pending?.message.proposal, units]
  );
  const hunks = useMemo(() => (set ? buildHunks(set) : []), [set]);
  const decisions = useMemo(() => pending?.message.review?.decisions ?? {}, [pending?.message.review?.decisions]);
  const left = hunks.filter((h) => !decisionOf(h, decisions)).length;

  const setReview = useCallback(
    (target: { chat: Chat; message: AssistantMessage }, review: ReviewState) =>
      patchMessage(target.chat.id, target.message.id, (m) => ({ ...m, review }), true),
    [patchMessage]
  );

  const decide = useCallback(
    (key: string, decision: Decision) => {
      if (!pending) return;
      const hunk = hunks.find((h) => h.key === key);
      if (!hunk) return;
      setApplyError("");
      setReview(pending, {
        ...pending.message.review!,
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
      setReview(pending, { ...pending.message.review!, decisions: next });
    },
    [pending, hunks, decisions, setReview]
  );

  /**
   * Once the last hunk is decided, the accepted ones go in together — through
   * `applyCurriculum`, so a renumber moves the work filed under it in the same
   * write. A failed save stays on screen, decided, until the teacher retries.
   */
  const failedRef = useRef<string | null>(null);
  const finish = useCallback(
    async (force = false) => {
      if (!pending || !set || hunks.length === 0 || left > 0 || applying) return;
      const attempt = `${pending.message.id}:${JSON.stringify(decisions)}`;
      if (!force && failedRef.current === attempt) return;

      const ids = acceptedChangeIds(hunks, decisions);
      const accepted = hunks.filter((h) => decisionOf(h, decisions) === "accepted").length;
      if (ids.size === 0) {
        setReview(pending, { ...pending.message.review!, status: "rejected", accepted: 0, total: hunks.length });
        return;
      }
      setApplying(true);
      setApplyError("");
      try {
        // The curriculum as it stood, kept with the draft: an edit to an
        // earlier message can put it back, the way an editor restores a
        // checkpoint.
        const before = structuredClone(unitsRef.current);
        const { units: next, remaps } = applyChanges(unitsRef.current, set, ids);
        await onApply(next, remaps);
        failedRef.current = null;
        setReview(pending, {
          ...pending.message.review!,
          status: "applied",
          accepted,
          total: hunks.length,
          before,
          remaps,
        });
      } catch (err) {
        failedRef.current = attempt;
        const message = err instanceof Error ? err.message : "";
        setApplyError(
          /stale/i.test(message)
            ? "The curriculum changed while you were reviewing. Ask again to redo the draft."
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

  // ── a turn ─────────────────────────────────────────────────────────────
  const runTurn = useCallback(
    async (chatId: string, user: UserMessage) => {
      let chat = chatsRef.current.find((c) => c.id === chatId)!;
      const turnAt = chat.messages.findIndex((m) => m.id === user.id);
      const assistant: AssistantMessage = {
        id: uuidv4(),
        role: "assistant",
        at: Date.now(),
        status: "running",
        steps: [],
      };
      chat = {
        ...chat,
        updatedAt: Date.now(),
        messages: [...chat.messages.slice(0, turnAt + 1), assistant],
      };
      commit(chat, true);

      const controller = new AbortController();
      abortRef.current = controller;
      setLiveId(assistant.id);
      setRunning(true);
      const started = Date.now();
      const patch = (fn: (m: AssistantMessage) => AssistantMessage, persist = false) =>
        patchMessage(chatId, assistant.id, fn, persist);

      try {
        // The whole conversation's files go with every turn — a follow-up
        // ("you missed unit 13") needs them as much as the first read did.
        // Newest first, as many as fit under the platform's limit.
        const body = new FormData();
        let size = 0;
        for (const meta of [...chat.files].reverse()) {
          if (size + meta.size > MAX_SEND_BYTES) continue;
          const file = await getFile(meta);
          if (!file) continue;
          size += meta.size;
          body.append("files", file, meta.name);
        }
        body.append("classId", classId);
        body.append("message", user.text);
        body.append("history", JSON.stringify(historyOf(chat.messages.slice(0, turnAt), chat.files)));
        if (user.mentions?.length) {
          body.append("mentions", JSON.stringify(user.mentions.map(({ label, detail }) => ({ label, detail }))));
        }
        const underReview = findPending(chatsRef.current);
        if (underReview?.message.proposal) {
          body.append("draft", JSON.stringify(underReview.message.proposal));
          // Where the teacher has got to with it — so "fix the ones I
          // rejected" means something.
          const draftSet = buildChangeSet(unitsRef.current, underReview.message.proposal);
          const decided = underReview.message.review?.decisions ?? {};
          body.append(
            "review",
            JSON.stringify(
              buildHunks(draftSet).map((hunk) => ({
                ...describeHunk(hunk, draftSet),
                decision: decisionOf(hunk, decided) ?? "undecided",
              }))
            )
          );
        }
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
            const seconds = Math.round((Date.now() - started) / 1000);
            if (!event.proposal) {
              patch((m) => ({ ...m, status: "done", reply: event.reply, notes: event.notes, seconds }), true);
              continue;
            }

            // A new draft replaces the one under review. Decisions carry over
            // only to hunks that still propose exactly the same thing.
            const previous = findPending(chatsRef.current);
            const draftSet = buildChangeSet(unitsRef.current, event.proposal);
            const draftHunks = buildHunks(draftSet);
            const carried = previous?.message.review
              ? carryDecisions(draftHunks, previous.message.review.decisions)
              : {};
            if (previous) {
              setReview(previous, { ...previous.message.review!, status: "superseded" });
            }
            const compare: AgentStep = {
              id: "compare",
              label: "Compare",
              target: "with what you already have",
              detail:
                draftHunks.length === 0
                  ? "nothing to change"
                  : `${draftHunks.length} change${draftHunks.length === 1 ? "" : "s"}`,
              status: "done",
            };
            patch(
              (m) => ({
                ...m,
                status: "done",
                steps: upsertStep(m.steps, compare),
                reply: event.reply,
                notes: event.notes,
                seconds,
                ...(draftHunks.length > 0
                  ? {
                      proposal: event.proposal!,
                      review: { status: "pending" as const, decisions: carried },
                    }
                  : {}),
              }),
              true
            );
            if (draftHunks.length > 0) onDraftRef.current?.();
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
        if (!openRef.current) setUnseen(true);
        setRunning(false);
        void pruneChats(classId);
      }
    },
    [classId, commit, patchMessage, setReview]
  );

  /** Sends a message, with any new files, in the open chat — or a new one. */
  const send = useCallback(
    async (text: string, files: File[], options: { fresh?: boolean; mentions?: Mention[] } = {}) => {
      const about = options.mentions ?? mentionsRef.current;
      if (!options.mentions) {
        mentionsRef.current = [];
        setMentions([]);
      }
      // Mid-turn, a message waits its turn rather than being refused.
      if (abortRef.current) {
        if (text.trim() || files.length > 0 || about.length > 0) {
          setQueue((q) => [...q, { id: uuidv4(), text, files, mentions: about }]);
        }
        return;
      }
      holdQueue.current = false;
      const base =
        (!options.fresh && chatsRef.current.find((c) => c.id === activeId)) || null;
      const metas: ChatFile[] = await Promise.all(
        files.map(async (file) => {
          const id = uuidv4();
          await putFile(id, file);
          return { id, name: file.name, type: file.type, size: file.size };
        })
      );
      const user: UserMessage = {
        id: uuidv4(),
        role: "user",
        at: Date.now(),
        text: text.trim(),
        fileIds: metas.map((m) => m.id),
        ...(about.length > 0 ? { mentions: about } : {}),
      };
      const now = Date.now();
      const chat: Chat = base
        ? { ...base, updatedAt: now, messages: [...base.messages, user], files: [...base.files, ...metas] }
        : {
            id: uuidv4(),
            classId,
            title: titleFor(text, files),
            createdAt: now,
            updatedAt: now,
            messages: [user],
            files: metas,
          };
      commit(chat, true);
      setActiveId(chat.id);
      await runTurn(chat.id, user);
    },
    [activeId, classId, commit, runTurn]
  );

  // The queue goes out one message per turn, in order, as each turn ends.
  // Stopping a turn holds it: a stop means "wait", so nothing queued sends
  // itself until the teacher sends something, or sends a queued one.
  const holdQueue = useRef(false);
  useEffect(() => {
    if (running || holdQueue.current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    void send(next.text, next.files, { mentions: next.mentions });
  }, [running, queue, send]);

  const unqueue = useCallback((id: string) => {
    setQueue((q) => q.filter((m) => m.id !== id));
  }, []);

  const mentionsRef = useRef<Mention[]>([]);
  const mention = useCallback(
    (key: string) => {
      if (!set || mentionsRef.current.some((m) => m.key === key)) return;
      const hunk = hunks.find((h) => h.key === key);
      if (!hunk) return;
      mentionsRef.current = [...mentionsRef.current, { key, ...describeHunk(hunk, set) }];
      setMentions(mentionsRef.current);
      setOpen(true);
    },
    [set, hunks, setOpen]
  );
  const unmention = useCallback((key: string) => {
    mentionsRef.current = mentionsRef.current.filter((m) => m.key !== key);
    setMentions(mentionsRef.current);
  }, []);
  /** The open changes, for the composer's @ list. */
  const openChanges = useMemo(
    () =>
      set
        ? hunks
            .filter((h) => !decisionOf(h, decisions))
            .map((h) => ({ key: h.key, ...describeHunk(h, set) }))
        : [],
    [set, hunks, decisions]
  );

  const sendQueued = useCallback(
    (id: string) => {
      if (abortRef.current) return;
      const item = queue.find((m) => m.id === id);
      if (!item) return;
      holdQueue.current = false;
      setQueue((q) => q.filter((m) => m.id !== id));
      void send(item.text, item.files, { mentions: item.mentions });
    },
    [queue, send]
  );

  /**
   * Rewrites an earlier message and answers it again, the way a chat app's
   * edit does: everything after it is dropped — a draft it made included —
   * and the conversation goes on from the new wording.
   */
  /** The drafts accepted after a message, oldest first — what reverting to it undoes. */
  const appliedAfter = useCallback((messageId: string) => {
    const chat = chatsRef.current.find((c) => c.messages.some((m) => m.id === messageId));
    if (!chat) return [];
    const at = chat.messages.findIndex((m) => m.id === messageId);
    return chat.messages
      .slice(at + 1)
      .filter(
        (m): m is AssistantMessage =>
          m.role === "assistant" && m.review?.status === "applied" && Array.isArray(m.review.before)
      );
  }, []);

  /** Whether editing this message could also put the curriculum back. */
  const canRevert = useCallback((messageId: string) => appliedAfter(messageId).length > 0, [appliedAfter]);

  /**
   * Rewrites an earlier message and answers it again from there. With
   * `revert`, the curriculum first goes back to how it stood before that
   * message: the earliest accepted draft after it kept a copy, and the
   * section moves every accepted draft made are undone in reverse, so student
   * work follows its sections back. Anything changed since — the teacher's
   * own edits too — goes with it; the edit box says so before they choose.
   */
  const editMessage = useCallback(
    async (messageId: string, text: string, options: { revert?: boolean } = {}) => {
      if (abortRef.current) return;
      const chat = chatsRef.current.find((c) => c.messages.some((m) => m.id === messageId));
      if (!chat) return;
      const at = chat.messages.findIndex((m) => m.id === messageId);
      const original = chat.messages[at];
      if (original.role !== "user") return;
      const user: UserMessage = { ...original, text: text.trim(), at: Date.now() };
      if (!user.text && user.fileIds.length === 0) return;

      if (options.revert) {
        const applied = appliedAfter(messageId);
        if (applied.length > 0) {
          const undo = undoRemaps(applied.map((m) => m.review!.remaps ?? []));
          try {
            await onApply(applied[0].review!.before!, undo);
            // The class re-renders with it in a moment; the turn that follows
            // starts now, and must read the curriculum as it is after the revert.
            unitsRef.current = applied[0].review!.before!;
          } catch (err) {
            const message = err instanceof Error ? err.message : "";
            setApplyError(
              /stale/i.test(message)
                ? "The curriculum changed elsewhere — reload, then try again."
                : "The curriculum could not be put back."
            );
            return;
          }
        }
      }

      commit({ ...chat, updatedAt: Date.now(), messages: [...chat.messages.slice(0, at), user] }, true);
      await runTurn(chat.id, user);
    },
    [appliedAfter, commit, onApply, runTurn]
  );

  /** Runs a failed or stopped turn again, from the message that asked for it. */
  const retry = useCallback(
    (assistantId: string) => {
      if (abortRef.current || !activeChat) return;
      const at = activeChat.messages.findIndex((m) => m.id === assistantId);
      const user = activeChat.messages
        .slice(0, at)
        .reverse()
        .find((m): m is UserMessage => m.role === "user");
      if (user) void runTurn(activeChat.id, user);
    },
    [activeChat, runTurn]
  );

  const stop = useCallback(() => {
    holdQueue.current = true;
    abortRef.current?.abort();
  }, []);

  const newChat = useCallback(() => {
    if (abortRef.current) return;
    setActiveId(null);
  }, []);

  const selectChat = useCallback((id: string) => {
    if (abortRef.current) return;
    setActiveId(id);
  }, []);

  const deleteChat = useCallback(
    (id: string) => {
      const chat = chatsRef.current.find((c) => c.id === id);
      if (!chat || (abortRef.current && id === activeId)) return;
      chatsRef.current = chatsRef.current.filter((c) => c.id !== id);
      setChats(chatsRef.current);
      if (id === activeId) setActiveId(null);
      void removeChat(chat);
    },
    [activeId]
  );

  // A class created from the teacher's materials arrives with them waiting:
  // open the chat and start reading straight away, so the first thing the
  // teacher sees in their new class is the work happening. Checked once —
  // the ref survives React's double-run of effects in development.
  const handoffChecked = useRef(false);
  useEffect(() => {
    if (!loaded || handoffChecked.current) return;
    handoffChecked.current = true;
    const handed = takePendingImport(classId);
    if (!handed) return;
    setOpen(true);
    void send(handed.instructions, handed.files, { fresh: true });
  }, [loaded, classId, send, setOpen]);

  const review: AgentReview | null =
    pending && set && hunks.length > 0
      ? {
          chatId: pending.chat.id,
          messageId: pending.message.id,
          set,
          hunks,
          decisions,
          left,
          applying,
          error: applyError,
          decide,
          decideAll,
          retry: () => void finish(true),
          mention,
          mentioned: new Set(mentions.map((m) => m.key)),
        }
      : null;

  return {
    classId,
    loaded,
    chats,
    activeChat,
    running,
    open,
    setOpen,
    /** Docked beside the class (wide screens) rather than covering it. */
    docked,
    width,
    setWidth,
    /** A drag is under way: whatever follows the width should not animate. */
    resizing,
    setResizing,
    send,
    stop,
    retry,
    editMessage,
    canRevert,
    mentions,
    mention,
    unmention,
    openChanges,
    /** Why a revert or a save did not happen. */
    applyError,
    queue,
    unqueue,
    sendQueued,
    /** A turn ended while the panel was minimised, and it has not been opened since. */
    unseen,
    liveId,
    newChat,
    selectChat,
    deleteChat,
    review,
  };
}

export type CurriculumAgent = ReturnType<typeof useCurriculumAgent>;
