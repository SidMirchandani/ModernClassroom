import { cn } from "@/lib/utils";

interface AppNavbarProps {
  left: React.ReactNode;
  center?: React.ReactNode;
  right: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

/** Fixed-height app navbar — always h-14 so every view lines up. */
export function AppNavbar({
  left,
  center,
  right,
  sticky = false,
  className,
}: AppNavbarProps) {
  return (
    <header
      className={cn(
        "h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-5 sm:px-6",
        sticky && "sticky top-0 z-30",
        center
          ? "grid grid-cols-[1fr_auto_1fr] items-center gap-3"
          : "flex items-center justify-between gap-3",
        className
      )}
    >
      <div className="flex items-center min-w-0">{left}</div>
      {center && (
        <div className="flex items-center justify-center">{center}</div>
      )}
      <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0">
        {right}
      </div>
    </header>
  );
}
