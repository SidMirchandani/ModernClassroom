import type { CurriculumUnit } from "./db/types";
import type { CurriculumProposal } from "./curriculum-diff";
import type { Decisions } from "./curriculum-review";
import type { SectionRemap } from "./store/types";

/**
 * A class's imports — each one the files a teacher sent, a note, the work as
 * it happened, and the draft it made with the teacher's decisions on it —
 * kept so a reload mid-review loses nothing, so an import can be undone, and
 * so the same files sent again can reuse the answer.
 *
 * Kept in this browser's IndexedDB rather than on the server: an import
 * holds the teacher's own files, which can run to megabytes, and IndexedDB
 * stores them as they are — localStorage cannot hold a file at all. The
 * curriculum itself is what lives on the server; an import is how it got
 * there. (The records are still shaped as the two-message "chats" they began
 * as — what was sent, and what came back — and the database keeps its name.)
 */

export interface ChatFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

/** One thing the assistant did, shown as a line in its turn. */
export interface AgentStep {
  id: string;
  /** The verb — "Read", "Plan", "Write". */
  label: string;
  /** What it was done to — a file's name, "Unit 3: Linear Functions". */
  target: string;
  detail?: string;
  status: "run" | "done" | "fail";
  /** Shown when the step is opened: the units a plan found. */
  items?: string[];
}

export interface ReviewState {
  /**
   *   pending    — on the curriculum now, waiting for decisions
   *   applied    — the accepted part was saved
   *   rejected   — every hunk was rejected; nothing changed
   *   superseded — a follow-up replaced it with a revised draft
   */
  status: "pending" | "applied" | "rejected" | "superseded" | "undone";
  decisions: Decisions;
  accepted?: number;
  total?: number;
  /**
   * The curriculum just before this draft was applied, and the section moves
   * applying it made — what reverting to an earlier message puts back.
   */
  before?: CurriculumUnit[];
  remaps?: SectionRemap[];
  /** The curriculum's shape right after applying — Undo is only offered while it still has it. */
  after?: string;
}

export interface UserMessage {
  id: string;
  role: "user";
  at: number;
  text: string;
  fileIds: string[];
  /** A fingerprint of the files, note and curriculum it was read against — the same one reuses the answer. */
  cacheKey?: string;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  at: number;
  status: "running" | "done" | "failed" | "stopped";
  steps: AgentStep[];
  reply?: string;
  notes?: string[];
  error?: string;
  /** The draft as it stands after this turn — the whole of it, not just what changed. */
  proposal?: CurriculumProposal;
  review?: ReviewState;
  seconds?: number;
}

export type ChatMessage = UserMessage | AssistantMessage;

export interface Chat {
  id: string;
  classId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  files: ChatFile[];
}

const DB_NAME = "modern-classroom-chats";
const CHATS = "chats";
const FILES = "files";
/** Old chats are dropped past this, oldest first, files and all. */
const MAX_CHATS_PER_CLASS = 30;

let opening: Promise<IDBDatabase | null> | null = null;
/** When IndexedDB is unavailable (a private window), chats last the visit. */
const memoryChats = new Map<string, Chat>();
const memoryFiles = new Map<string, Blob>();

function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const chats = db.createObjectStore(CHATS, { keyPath: "id" });
        chats.createIndex("classId", "classId");
        // Files apart from the chat record, so saving a chat after every
        // turn does not write its megabytes again each time.
        db.createObjectStore(FILES);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listChats(classId: string): Promise<Chat[]> {
  const db = await open();
  let chats: Chat[];
  if (!db) {
    chats = [...memoryChats.values()].filter((c) => c.classId === classId);
  } else {
    try {
      const store = db.transaction(CHATS).objectStore(CHATS);
      chats = (await done(store.index("classId").getAll(classId))) as Chat[];
    } catch {
      chats = [];
    }
  }
  return chats.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveChat(chat: Chat): Promise<void> {
  const db = await open();
  if (!db) {
    memoryChats.set(chat.id, chat);
    return;
  }
  try {
    await done(db.transaction(CHATS, "readwrite").objectStore(CHATS).put(chat));
  } catch (err) {
    console.warn("Could not save the chat", err);
  }
}

export async function deleteChat(chat: Chat): Promise<void> {
  const db = await open();
  if (!db) {
    memoryChats.delete(chat.id);
    chat.files.forEach((f) => memoryFiles.delete(f.id));
    return;
  }
  try {
    const tx = db.transaction([CHATS, FILES], "readwrite");
    tx.objectStore(CHATS).delete(chat.id);
    chat.files.forEach((f) => tx.objectStore(FILES).delete(f.id));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Could not delete the chat", err);
  }
}

/**
 * Deletes every chat (and its files) for the classes `match` picks, in one
 * transaction — so a page that lists chats straight after still sees them
 * gone: IndexedDB runs a later transaction on the same store after this one.
 */
export async function clearChats(match: (classId: string) => boolean): Promise<void> {
  for (const [id, chat] of memoryChats) {
    if (!match(chat.classId)) continue;
    memoryChats.delete(id);
    chat.files.forEach((f) => memoryFiles.delete(f.id));
  }
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction([CHATS, FILES], "readwrite");
    const files = tx.objectStore(FILES);
    const walk = tx.objectStore(CHATS).openCursor();
    walk.onsuccess = () => {
      const cursor = walk.result;
      if (!cursor) return;
      const chat = cursor.value as Chat;
      if (match(chat.classId)) {
        chat.files.forEach((f) => files.delete(f.id));
        cursor.delete();
      }
      cursor.continue();
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Could not clear chats", err);
  }
}

/**
 * The demo starts clean every time, chats included: they belong to the visit,
 * like the rest of the demo's world, which is rebuilt on entry and dropped on
 * exit. Every demo class's id starts "demo-".
 */
export function clearDemoChats(): Promise<void> {
  return clearChats((classId) => classId.startsWith("demo-"));
}

/** Keeps a class to its most recent chats. */
export async function pruneChats(classId: string): Promise<void> {
  const chats = await listChats(classId);
  for (const chat of chats.slice(MAX_CHATS_PER_CLASS)) await deleteChat(chat);
}

export async function putFile(id: string, file: Blob): Promise<void> {
  const db = await open();
  if (!db) {
    memoryFiles.set(id, file);
    return;
  }
  try {
    await done(db.transaction(FILES, "readwrite").objectStore(FILES).put(file, id));
  } catch (err) {
    // Lost from storage, not from this visit: it is still sent from memory.
    memoryFiles.set(id, file);
    console.warn("Could not keep the file", err);
  }
}

export async function getFile(meta: ChatFile): Promise<File | null> {
  let blob: Blob | undefined = memoryFiles.get(meta.id);
  if (!blob) {
    const db = await open();
    if (db) {
      try {
        blob = (await done(db.transaction(FILES).objectStore(FILES).get(meta.id))) as Blob | undefined;
      } catch {
        blob = undefined;
      }
    }
  }
  if (!blob) return null;
  return blob instanceof File ? blob : new File([blob], meta.name, { type: meta.type });
}

/** A chat's name: what was first asked, or failing that, what was first sent. */
export function titleFor(text: string, files: { name: string }[]): string {
  const line = text.trim().split("\n")[0];
  if (line) return line.length > 60 ? `${line.slice(0, 57)}…` : line;
  if (files.length > 0) return files[0].name.replace(/\.[a-z0-9]+$/i, "");
  return "New chat";
}
