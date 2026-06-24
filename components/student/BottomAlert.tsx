"use client";

import { useEffect } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}

export function BottomAlert({ message, visible, onDismiss }: Props) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss, message]);

  return (
    <div
      role="alert"
      className={cn(
        "fixed bottom-5 left-5 z-50 flex items-center gap-2.5 max-w-sm px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 transition-all duration-300",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-2 pointer-events-none"
      )}
    >
      <Lock className="w-4 h-4 text-red-500 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
