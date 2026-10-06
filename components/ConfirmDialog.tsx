"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** What is about to happen, and whether it can be taken back. */
  body: ReactNode;
  confirmLabel: string;
  /** Red button for anything that destroys something. */
  danger?: boolean;
}

/**
 * The second ask, before something irreversible. It is a normal centred popup —
 * the page blurs, nothing darkens — and the cancel is the wider target of the
 * two, because the dangerous button should never be the one you hit by reflex.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  danger = false,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-md">
      <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        {body}
      </div>

      <div className="flex items-center justify-end gap-2 mt-5">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-md btn-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={cn(
            "btn btn-md",
            danger
              ? "bg-rose-600 hover:bg-rose-700 text-white border-0"
              : "btn-primary"
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
