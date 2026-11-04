"use client";

import { Check, Palette } from "lucide-react";
import { Popover } from "@/components/Popover";
import { ACCENT_LIST, type AccentId } from "@/lib/class-appearance";
import { cn } from "@/lib/utils";

/** Choosing a banner's colour, from the same set as everywhere else in the app. */
export function ColorPicker({
  value,
  title,
  onPick,
}: {
  value: AccentId;
  title: string;
  onPick: (color: AccentId) => void;
}) {
  return (
    <Popover
      width={196}
      align="right"
      triggerTitle={title}
      triggerClassName={(open) =>
        cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors hover:bg-white/20",
          open && "bg-white/20"
        )
      }
      label={<Palette className="w-[18px] h-[18px]" />}
      panelClassName="p-3"
    >
      {(close) => (
        <div className="grid grid-cols-4 gap-2">
          {ACCENT_LIST.map((accent) => {
            const active = accent.id === value;
            return (
              <button
                key={accent.id}
                type="button"
                title={accent.label}
                aria-label={accent.label}
                aria-pressed={active}
                onClick={() => {
                  close();
                  if (!active) onPick(accent.id);
                }}
                className={cn(
                  "w-9 h-9 rounded-lg inline-flex items-center justify-center text-white transition-transform hover:scale-105",
                  accent.swatch
                )}
              >
                {active && <Check className="w-4 h-4" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
