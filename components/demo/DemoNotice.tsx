"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DB_WRITE_EVENT } from "@/lib/db/client";
import {
  dismissDemoNotice,
  exitDemoMode,
  isDemoMode,
  isDemoNoticeDismissed,
} from "@/lib/demo-seed";

/**
 * The "nothing is saved" warning. It stays out of the way until the moment it
 * matters — the first time a change is written to the demo store — then slides
 * in over the page without dimming it or blocking a click.
 */
export function DemoNotice() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!isDemoMode() || isDemoNoticeDismissed()) return;

    const onWrite = () => {
      setMounted(true);
      // Paint it in the hidden state first so the transition has somewhere to
      // travel from; a single frame is enough.
      requestAnimationFrame(() => setShown(true));
    };

    window.addEventListener(DB_WRITE_EVENT, onWrite, { once: true });
    return () => window.removeEventListener(DB_WRITE_EVENT, onWrite);
  }, []);

  if (!mounted) return null;

  function close() {
    setShown(false);
    dismissDemoNotice();
    // Let the exit transition finish before the node goes away.
    setTimeout(() => setMounted(false), 200);
  }

  return (
    <div
      role="status"
      className={cn(
        "fixed inset-x-0 top-[6.75rem] z-[100] flex justify-center px-4 pointer-events-none",
        "transition-all duration-200 ease-out",
        shown ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      )}
    >
      <div className="pointer-events-auto flex items-start gap-3 w-[min(92vw,34rem)] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 float-pane-raised shadow-z5">
        <p className="text-sm text-slate-600 dark:text-slate-300 flex-1">
          This is a demo — you can explore freely, but nothing you change here will be
          saved.{" "}
          <button
            type="button"
            onClick={() => {
              exitDemoMode();
              router.replace("/");
            }}
            className="text-primary dark:text-primary-glow hover:underline font-medium"
          >
            Exit demo
          </button>
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="shrink-0 w-6 h-6 -mr-1 -mt-0.5 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
