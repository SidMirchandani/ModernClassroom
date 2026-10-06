import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  showText?: boolean;
  href?: string;
  className?: string;
  textClassName?: string;
}

export function Logo({
  size = 28,
  showText = true,
  href,
  className,
  textClassName,
}: LogoProps) {
  const content = (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* Native img so Next.js image optimizer does not flatten PNG transparency */}
      <img
        src="/Logo.png"
        alt="Modern Classroom"
        width={size}
        height={size}
        className="object-contain shrink-0 bg-transparent"
        style={{ width: size, height: size }}
        decoding="async"
      />
      {showText && (
        <span
          className={cn(
            "font-semibold text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap",
            textClassName
          )}
        >
          Modern Classroom
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
