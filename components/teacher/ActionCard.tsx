import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one shape for a card that tells a teacher about something and offers the
 * next step. The icon always sits in the same small tile, and it appears once:
 * the button beside it carries words only.
 */
export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "w-10 h-10 shrink-0 rounded-xl inline-flex items-center justify-center bg-primary/10 text-primary dark:text-primary-glow",
        className
      )}
    >
      <Icon className="w-5 h-5" />
    </span>
  );
}

export function ActionCard({
  icon,
  title,
  action,
  children,
  below,
  working = false,
}: {
  icon: LucideIcon;
  title?: React.ReactNode;
  /** The next step, at the card's right. */
  action?: React.ReactNode;
  /** One or two sentences beside the icon. */
  children?: React.ReactNode;
  /** Anything longer, under the heading row. */
  below?: React.ReactNode;
  /** Something is happening: the whole card says so. */
  working?: boolean;
}) {
  return (
    <section aria-busy={working} className={cn("card px-5 py-5 cq-sm:px-6 space-y-5", working && "card-working")}>
      <div className="flex flex-col cq-sm:flex-row cq-sm:items-center gap-4">
        <IconTile icon={icon} />
        <div className="min-w-0 flex-1">
          {title && <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{title}</h3>}
          {children && (
            <div className={cn("text-[15px] leading-relaxed text-slate-600 dark:text-slate-300", title && "mt-1")}>
              {children}
            </div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {below}
    </section>
  );
}
