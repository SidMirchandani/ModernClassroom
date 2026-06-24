"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import type { ActivityStatus } from "@/lib/types";
import {
  Lock,
  CheckCircle2,
  HelpCircle,
  Upload,
  X,
  Image,
  ChevronDown,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: ReactNode;
  title: string;
  color: "blue" | "violet" | "amber";
  status: ActivityStatus;
  locked: boolean;
  lockedMessage: string;
  children: ReactNode;
  requiresProof?: boolean;
  proofUrl?: string;
  onStatusChange: (status: "done" | "help", proofUrl?: string) => void;
}

const colorMap = {
  blue: {
    icon: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900",
    border: "border-slate-200 dark:border-slate-800",
    header: "border-blue-100 dark:border-blue-900/50",
  },
  violet: {
    icon: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-100 dark:bg-violet-900",
    border: "border-slate-200 dark:border-slate-800",
    header: "border-violet-100 dark:border-violet-900/50",
  },
  amber: {
    icon: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900",
    border: "border-slate-200 dark:border-slate-800",
    header: "border-amber-100 dark:border-amber-900/50",
  },
};

type DisplayStatus = "locked" | "in-progress" | "done" | "help";

const STATUS_STYLES: Record<
  DisplayStatus,
  { label: string; classes: string; icon: ReactNode }
> = {
  locked: {
    label: "Locked",
    classes:
      "bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800",
    icon: <Lock className="w-3 h-3" />,
  },
  "in-progress": {
    label: "In Progress",
    classes:
      "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
    icon: <Clock className="w-3 h-3" />,
  },
  done: {
    label: "Done",
    classes:
      "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  help: {
    label: "Help!",
    classes:
      "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800",
    icon: <HelpCircle className="w-3 h-3" />,
  },
};

function toDisplayStatus(status: ActivityStatus): DisplayStatus {
  if (status === "locked") return "locked";
  if (status === "available") return "in-progress";
  if (status === "done") return "done";
  return "help";
}

function StatusDropdown({
  displayStatus,
  onSelect,
  requiresProof,
  hasProof,
}: {
  displayStatus: DisplayStatus;
  onSelect: (status: "done" | "help") => void;
  requiresProof?: boolean;
  hasProof?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const style = STATUS_STYLES[displayStatus];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (displayStatus === "locked") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
          style.classes
        )}
      >
        {style.icon}
        {style.label}
      </span>
    );
  }

  const options: { value: "done" | "help"; label: string; disabled?: boolean }[] = [];

  if (displayStatus === "in-progress") {
    options.push(
      { value: "done", label: "Done", disabled: requiresProof && !hasProof },
      { value: "help", label: "Help!" }
    );
  } else if (displayStatus === "done") {
    options.push({ value: "help", label: "Help!" });
  } else if (displayStatus === "help") {
    options.push({ value: "done", label: "Done", disabled: requiresProof && !hasProof });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-opacity hover:opacity-80",
          style.classes
        )}
      >
        {style.icon}
        {style.label}
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden z-30">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => {
                if (!opt.disabled) {
                  onSelect(opt.value);
                  setOpen(false);
                }
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors",
                opt.disabled
                  ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              {STATUS_STYLES[opt.value === "done" ? "done" : "help"].icon}
              {opt.label}
            </button>
          ))}
          {requiresProof && !hasProof && displayStatus !== "done" && (
            <p className="px-3 py-2 text-[10px] text-slate-400 dark:text-slate-600 border-t border-slate-100 dark:border-slate-800">
              Upload proof to mark as Done
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ActivityCard({
  icon,
  title,
  color,
  status,
  locked,
  lockedMessage,
  children,
  requiresProof,
  proofUrl,
  onStatusChange,
}: Props) {
  const [uploadedFile, setUploadedFile] = useState<string | null>(proofUrl ?? null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const c = colorMap[color];

  useEffect(() => {
    if (proofUrl) setUploadedFile(proofUrl);
  }, [proofUrl]);

  const displayStatus = toDisplayStatus(status);
  const isDone = status === "done";
  const isHelp = status === "help";

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedFile(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleStatusSelect = (next: "done" | "help") => {
    if (next === "done" && requiresProof && !uploadedFile) return;
    onStatusChange(next, next === "done" ? uploadedFile ?? undefined : undefined);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden transition-opacity",
        c.border,
        locked && "opacity-60"
      )}
    >
      <div className={cn("flex items-center gap-3 px-5 py-4 border-b", c.header)}>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", c.iconBg)}>
          <span className={c.icon}>{icon}</span>
        </div>
        <span className="font-semibold text-slate-900 dark:text-slate-100">{title}</span>

        <div className="ml-auto shrink-0">
          <StatusDropdown
            displayStatus={displayStatus}
            onSelect={handleStatusSelect}
            requiresProof={requiresProof}
            hasProof={!!uploadedFile}
          />
        </div>
      </div>

      <div className="px-5 py-4">
        {locked ? (
          <p className="text-sm text-slate-400 dark:text-slate-600 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            {lockedMessage}
          </p>
        ) : (
          <div className="space-y-4">
            <div>{children}</div>

            {requiresProof && !isDone && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Proof of Completion
                </p>
                {uploadedFile ? (
                  <div className="relative inline-block">
                    <img
                      src={uploadedFile}
                      alt="Proof of completion"
                      className="max-h-32 rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setUploadedFile(null)}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors",
                      dragging
                        ? "border-blue-400 bg-blue-50 dark:bg-blue-950"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Upload className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Upload screenshot
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">
                        Drag & drop or click to browse
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {requiresProof && isDone && uploadedFile && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Image className="w-3 h-3" />
                  Submitted Proof
                </p>
                <img
                  src={uploadedFile}
                  alt="Submitted proof"
                  className="max-h-24 rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
                />
              </div>
            )}

            {isHelp && (
              <p className="text-xs text-slate-400 dark:text-slate-600">
                Help! — your teacher will follow up. You can continue to the next step.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
