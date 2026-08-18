"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ListChecks } from "lucide-react";
import {
  ACCENT_LIST,
  CLASS_ICONS,
  classIcon,
  type AccentId,
  type ClassIconId,
} from "@/lib/class-appearance";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
  code: string;
  color?: AccentId;
  icon?: ClassIconId;
  onChange: (patch: { name?: string; color?: AccentId; icon?: ClassIconId }) => void;
}

/**
 * How the class presents itself. The three settings a teacher running six
 * periods actually needs to tell them apart at a glance — what it is called,
 * what glyph stands for it, and what colour it wears — with the student class
 * strip shown live underneath, because that is where the colour lands.
 */
export function ClassCustomize({ name, code, color, icon, onChange }: Props) {
  const [draftName, setDraftName] = useState(name);
  const [copied, setCopied] = useState(false);

  // The name can also be edited from the page heading, so the field has to
  // follow the class rather than own it.
  useEffect(() => setDraftName(name), [name]);

  const Icon = classIcon(icon);

  function commitName() {
    const next = draftName.trim();
    if (!next || next === name) {
      setDraftName(name);
      return;
    }
    onChange({ name: next });
  }

  function copyCode() {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6 max-w-3xl animate-content-in">
      <div className="card p-5 space-y-4">
        <div>
          <div className="eyebrow">Details</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            The name students see in their class list and at the top of every page.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 min-w-0">
            <span className="eyebrow-muted">Class name</span>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setDraftName(name);
              }}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary"
            />
          </label>

          <div className="sm:w-44 shrink-0">
            <span className="eyebrow-muted">Class code</span>
            <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 panel-inset">
              <span className="flex-1 font-mono text-sm tracking-[0.15em] tabular-nums text-slate-600 dark:text-slate-300">
                {code}
              </span>
              <button
                type="button"
                onClick={copyCode}
                title="Copy class code"
                aria-label="Copy class code"
                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-primary dark:hover:text-primary-glow transition-colors"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <div className="eyebrow">Icon</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Stands in for the class wherever it is listed.
          </p>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {CLASS_ICONS.map((entry) => {
            const Glyph = entry.icon;
            const active = (icon ?? "grid") === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onChange({ icon: entry.id })}
                title={entry.label}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors",
                  active
                    ? "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                <Glyph
                  className={cn(
                    "w-5 h-5",
                    active
                      ? "text-primary dark:text-primary-glow"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-none">
                  {entry.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div data-tour="customize-color" className="card p-5 space-y-4">
        <div>
          <div className="eyebrow">Color</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Colours this class only — for you and for every student in it.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {ACCENT_LIST.map((entry) => {
            const active = (color ?? "blue") === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onChange({ color: entry.id })}
                title={entry.label}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-2 h-9 pl-2 pr-3 rounded-xl border text-xs font-medium transition-colors",
                  active
                    ? "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                <span className={cn("w-5 h-5 rounded-lg", entry.swatch)} />
                {entry.label}
              </button>
            );
          })}
        </div>

        {/* The strip as a student sees it — the only place the colour carries
            real weight, so the choice is made against the real thing. */}
        <div>
          <span className="eyebrow-muted">Student view</span>
          <div className="mt-1.5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="h-11 px-4 flex items-center gap-3 bg-primary/[0.85] dark:bg-primary-900/[0.85]">
              <Icon className="w-4 h-4 text-white shrink-0" />
              <span className="text-sm font-semibold text-white truncate">
                {draftName || name}
              </span>
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-white text-primary">
                Class Dashboard
              </span>
              <span className="flex-1" />
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white/90 bg-white/10">
                <ListChecks className="w-3.5 h-3.5" />
                To-Do
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
