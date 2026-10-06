"use client";

import { useEffect, useState } from "react";
import { CloudOff, Loader2, TriangleAlert } from "lucide-react";
import { isDemoMode } from "@/lib/demo-seed";
import { SYNC_EVENT, outbox, type SyncState } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * The one place the connection shows. Silent while everything is on the
 * server; otherwise it says what is true — your changes are safe on this
 * device and will go up when they can. Never a spinner in the way of work.
 */
export function SyncStatus() {
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => {
    if (isDemoMode()) return;
    setState(outbox.current());
    const onSync = (e: Event) => setState((e as CustomEvent<SyncState>).detail);
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, []);

  if (!state || state.status === "synced") return null;

  const label =
    state.status === "offline"
      ? state.pending > 0
        ? `Offline — ${state.pending} change${state.pending === 1 ? "" : "s"} saved on this device`
        : "Offline — changes will be saved on this device"
      : state.status === "pending"
        ? `Syncing ${state.pending} change${state.pending === 1 ? "" : "s"}…`
        : "Some changes couldn't be saved";

  const Icon =
    state.status === "offline" ? CloudOff : state.status === "pending" ? Loader2 : TriangleAlert;

  return (
    <div
      role="status"
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium whitespace-nowrap",
        state.status === "offline" &&
          "border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400",
        state.status === "pending" &&
          "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400",
        state.status === "error" &&
          "border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400"
      )}
    >
      <Icon className={cn("w-3.5 h-3.5 shrink-0", state.status === "pending" && "animate-spin")} />
      <span className="hidden md:inline">{label}</span>
    </div>
  );
}
