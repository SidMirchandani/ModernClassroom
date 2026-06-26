import Link from "next/link";
import { cn } from "@/lib/utils";

export interface NavCapsuleTab {
  id: string;
  label: string;
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
  return (
    <div
      className={cn(
        "inline-flex items-center p-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50",
        className
      )}
    >
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
          "relative px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
          isActive
            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        );

        if (tab.href) {
          return (
            <Link key={tab.id} href={tab.href} className={tabClass}>
              {content}
            </Link>
          );
        }

        return (
          <button key={tab.id} type="button" onClick={tab.onClick} className={tabClass}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
