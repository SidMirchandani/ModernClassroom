"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DemoContextValue {
  notifyDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemoNotice() {
  const ctx = useContext(DemoContext);
  return ctx?.notifyDemo ?? (() => {});
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notifyDemo = useCallback(() => {
    setVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <DemoContext.Provider value={{ notifyDemo }}>
      <div className="min-h-screen">
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[min(92vw,28rem)] px-4 py-3 rounded-xl border shadow-lg",
            "bg-amber-50 border-amber-200 text-amber-900",
            "dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100",
            "transition-all duration-300 ease-out",
            visible
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-3 pointer-events-none"
          )}
        >
          <div className="flex items-start gap-2.5 text-sm">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p>
              This is a demo — you can explore freely, but nothing you change here will be
              saved.
            </p>
          </div>
        </div>
        {children}
      </div>
    </DemoContext.Provider>
  );
}
