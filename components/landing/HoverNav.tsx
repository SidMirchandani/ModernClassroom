"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
  className?: string;
}

/**
 * Nav links that share one hover highlight, which glides from link to link
 * as the pointer moves along the bar instead of each link lighting on its own
 * — the way Vercel's header behaves. Leaving the bar fades the highlight out
 * where it stands, so coming back fades it in there rather than sliding it
 * across from the left edge.
 */
export function HoverNav({ links }: { links: NavLink[] }) {
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const [shown, setShown] = useState(false);

  return (
    <div className="relative flex items-center" onMouseLeave={() => setShown(false)}>
      <span
        aria-hidden="true"
        className="hover-pill"
        style={{
          left: box?.left ?? 0,
          width: box?.width ?? 0,
          opacity: shown && box ? 1 : 0,
          // The first appearance should not slide in from nowhere.
          transitionProperty: shown ? undefined : "opacity",
        }}
      />
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onMouseEnter={(e) => {
            setBox({ left: e.currentTarget.offsetLeft, width: e.currentTarget.offsetWidth });
            setShown(true);
          }}
          className={cn(
            "relative z-[1] h-8 px-2.5 sm:px-3 inline-flex items-center whitespace-nowrap rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors",
            link.className
          )}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
