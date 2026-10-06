"use client";

import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/Modal";
import { store } from "@/lib/store";
import { deleteAccount } from "@/lib/auth-client";
import type { ClassSummary } from "@/lib/db/types";

/**
 * Closing an account is the one action in this app that destroys other
 * people's work: a class disappears with every student's progress in it. So
 * the dialog does not merely ask twice — it goes and counts what is about to
 * be lost, names it, and makes the person type the word. Nobody should be able
 * to do this by muscle memory.
 */
export function DeleteAccountDialog({
  open,
  onClose,
  userId,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onDeleted: () => void;
}) {
  const [taught, setTaught] = useState<ClassSummary[] | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setConfirmText("");
    setError("");
    let alive = true;
    store
      .listClassSummaries(userId)
      .then((all) => alive && setTaught(all.filter((c) => c.role === "teacher")))
      .catch(() => alive && setTaught([]));
    return () => {
      alive = false;
    };
  }, [open, userId]);

  const students = (taught ?? []).reduce((sum, c) => sum + c.studentCount, 0);
  const ready = confirmText.trim().toUpperCase() === "DELETE" && !busy;

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await deleteAccount();
      onDeleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The account could not be deleted"
      );
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Delete your account">
      <div className="space-y-4 text-sm">
        <p className="text-slate-600 dark:text-slate-300">
          This erases your account and everything attached to it, right away.
          There is no undo and no grace period.
        </p>

        {taught === null ? (
          <p className="flex items-center gap-2 text-slate-400 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Checking what this would delete…
          </p>
        ) : taught.length > 0 ? (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 p-3.5">
            <p className="flex items-start gap-2 font-semibold text-rose-700 dark:text-rose-300">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {taught.length} {taught.length === 1 ? "class you teach" : "classes you teach"}{" "}
                will be deleted
              </span>
            </p>
            <ul className="mt-2 ml-6 space-y-0.5 text-[13px] text-rose-700 dark:text-rose-300 list-disc">
              {taught.map((c) => (
                <li key={c.id}>
                  {c.name}
                  {c.studentCount > 0 && (
                    <span className="opacity-80">
                      {" "}
                      — {c.studentCount}{" "}
                      {c.studentCount === 1 ? "student" : "students"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {students > 0 && (
              <p className="mt-2.5 ml-6 text-[13px] text-rose-700 dark:text-rose-300">
                Every piece of work those students have done goes with them.
                Consider exporting anything you need first.
              </p>
            )}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-[13px]">
            You do not teach any classes, so no one else&apos;s work is affected.
            Classes you are enrolled in will simply lose you from the roster.
          </p>
        )}

        <div>
          <label
            htmlFor="confirm-delete"
            className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5"
          >
            Type <span className="font-mono font-semibold">DELETE</span> to confirm
          </label>
          <input
            id="confirm-delete"
            type="text"
            autoComplete="off"
            value={confirmText}
            disabled={busy}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-rose-400"
          />
        </div>

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="btn btn-md btn-secondary"
          >
            Keep my account
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={confirm}
            className="btn btn-md bg-rose-600 hover:bg-rose-700 text-white border-0"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete everything
          </button>
        </div>
      </div>
    </Modal>
  );
}
