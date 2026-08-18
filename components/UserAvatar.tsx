import { cn } from "@/lib/utils";

type UserAvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<UserAvatarSize, string> = {
  xs: "w-5 h-5 text-[10px]",
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-xs",
  lg: "w-10 h-10 text-sm",
};

interface UserAvatarProps {
  initials: string;
  size?: UserAvatarSize;
  className?: string;
  bordered?: boolean;
}

export function UserAvatar({
  initials,
  size = "md",
  className,
  bordered = false,
}: UserAvatarProps) {
  return (
    <div
      className={cn(
        "rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center font-bold text-primary dark:text-primary-glow shrink-0",
        SIZE_CLASSES[size],
        bordered && "border border-slate-200 dark:border-slate-700",
        className
      )}
    >
      {initials}
    </div>
  );
}
