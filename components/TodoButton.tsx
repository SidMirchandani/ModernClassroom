"use client";

import { useState } from "react";
import { ClipboardCheck, ListChecks } from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  groupTodos,
  urgentTodoCount,
  TODO_BUCKET_LABEL,
  type TodoItem,
} from "@/lib/todos";
import { cn } from "@/lib/utils";

interface Props {
  items: TodoItem[];
  /** Name each item's class — only worth the room when several are mixed. */
  showClass?: boolean;
  /** Sits on the blue class strip rather than on the white page. */
  onPrimary?: boolean;
  onOpenItem?: (item: TodoItem) => void;
}

/**
 * What is past due, due this week and due next week. The same button serves one
 * class (from its strip) and every class you are enrolled in (from the
 * dashboard), and opens the list as a centred popup.
 */
export function TodoButton({ items, showClass = false, onPrimary = false, onOpenItem }: Props) {
  const [open, setOpen] = useState(false);
  const groups = groupTodos(items);
  const urgent = urgentTodoCount(items);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="What's due"
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors shrink-0",
          onPrimary
            ? "text-white/90 hover:text-white bg-white/10 hover:bg-white/20"
            : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-primary/50 hover:text-primary dark:hover:text-primary-glow"
        )}
      >
        <ListChecks className="w-3.5 h-3.5" />
        To-Do
        {urgent > 0 && (
          <span
            className={cn(
              "ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[11px] font-bold tabular-nums",
              onPrimary
                ? "bg-white text-primary"
                : "bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400"
            )}
          >
            {urgent}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="To-Do" className="max-w-md">
        {groups.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 dark:text-slate-400 text-center">
            Nothing due in the next two weeks.
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.bucket}>
                <p
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-[0.08em] leading-[1.25] mb-2",
                    group.bucket === "past"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {TODO_BUCKET_LABEL[group.bucket]}
                </p>

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const clickable = Boolean(onOpenItem);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={!clickable}
                        onClick={() => {
                          onOpenItem?.(item);
                          setOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-start gap-2.5 px-2 py-2 -mx-2 rounded-lg text-left transition-colors",
                          clickable
                            ? "hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                            : "cursor-default"
                        )}
                      >
                        <span className="w-4 shrink-0 flex justify-center pt-1">
                          {item.kind === "checkpoint" ? (
                            <ClipboardCheck className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug">
                            {item.kind === "section" && (
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {item.id}{" "}
                              </span>
                            )}
                            <span className="text-slate-600 dark:text-slate-300">
                              {item.title}
                            </span>
                          </span>
                          <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {showClass && `${item.className} · `}Due {item.dueLabel}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
