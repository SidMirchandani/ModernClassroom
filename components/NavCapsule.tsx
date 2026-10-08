"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSlidingPill } from "@/lib/use-sliding-pill";

export interface NavCapsuleTab {
  id: string;
  label: string;
  /** `data-tour` value, so the guided tour can press this tab itself. */
  tourId?: string;
  href?: string;
  onClick?: () => void;
  notify?: boolean;
}

interface NavCapsuleProps {
  tabs: NavCapsuleTab[];
  activeId: string;
  className?: string;
}

export function NavCapsule({ tabs, activeId, className }: NavCapsuleProps) {
  const { containerRef, pillStyle, ready } = useSlidingPill<HTMLDivElement>(activeId);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center p-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900",
        className
      )}
    >
      {/* One highlight that slides between tabs. Until it has measured, the
          active tab paints its own, so the first frame is never blank. */}
      {ready && (
        <span
          aria-hidden
          style={pillStyle}
          className="tab-pill rounded-full bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600"
        />
      )}
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const content = (
          <>
            <span>{tab.label}</span>
            {tab.notify && (
              <span
                className="absolute top-0 right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900"
                aria-label="Needs attention"
              />
            )}
          </>
        );
        const tabClass = cn(
          "relative z-[1] px-3 py-1 rounded-full text-xs font-medium transition-colors duration-300 whitespace-nowrap",
          isActive
            ? cn(
                "text-slate-900 dark:text-white",
                !ready && "bg-white dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-600"
              )
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        );

        if (tab.href) {
          return (
            <Link key={tab.id} href={tab.href} data-active={isActive} className={tabClass}>
              {content}
            </Link>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            onClick={tab.onClick}
            data-tour={tab.tourId}
            data-active={isActive}
            className={tabClass}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
