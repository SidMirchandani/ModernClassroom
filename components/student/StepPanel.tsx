"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import type { ActivityStatus, ContentBlock, TrackStep } from "@/lib/types";
import { AttachmentList } from "@/components/AttachmentList";
import { Popover } from "@/components/Popover";
import { ATTACHMENT_CLASS } from "@/lib/section-tracks";
import { STATUS_CHIP, STATUS_LABEL, type ProgressStatus } from "@/lib/status-styles";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  HelpCircle,
  Image as ImageIcon,
  Lock,
  PenLine,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DisplayStatus = "locked" | "in-progress" | "done" | "help";

/**
 * A step has four states, and they are the same four the rest of the app names
 * — so the wording and the colour come from the one vocabulary rather than
 * being spelled again here. Only the icon is local.
 */
const SHARED_STATUS: Record<DisplayStatus, ProgressStatus> = {
  locked: "locked",
  "in-progress": "in-progress",
  done: "complete",
  help: "help",
};

const STATUS_ICON: Record<DisplayStatus, ReactNode> = {
  locked: <Lock className="w-3 h-3" />,
  "in-progress": <Clock className="w-3 h-3" />,
  done: <CheckCircle2 className="w-3 h-3" />,
  help: <HelpCircle className="w-3 h-3" />,
};

function statusStyle(status: DisplayStatus) {
  const shared = SHARED_STATUS[status];
  return {
    label: STATUS_LABEL[shared],
    classes: STATUS_CHIP[shared],
    icon: STATUS_ICON[status],
  };
}

export function toDisplayStatus(status: ActivityStatus): DisplayStatus {
  if (status === "locked") return "locked";
  if (status === "available") return "in-progress";
  if (status === "done") return "done";
  return "help";
}

export function StatusPill({ status }: { status: ActivityStatus }) {
  const style = statusStyle(toDisplayStatus(status));
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
  const style = statusStyle(displayStatus);

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
    <Popover
      width={176}
      align="right"
      panelClassName="overflow-hidden"
      triggerClassName={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-opacity hover:opacity-80",
        style.classes
      )}
      label={(open) => (
        <>
          {style.icon}
          {style.label}
          <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
        </>
      )}
    >
      {(close) => (
        <>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => {
                if (!opt.disabled) {
                  onSelect(opt.value);
                  close();
                }
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors",
                opt.disabled
                  ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              {STATUS_ICON[opt.value === "done" ? "done" : "help"]}
              {opt.label}
            </button>
          ))}
          {requiresProof && !hasProof && displayStatus !== "done" && (
            <p className="px-3 py-2 text-[10px] text-slate-400 dark:text-slate-600 border-t border-slate-100 dark:border-slate-800">
              Upload proof to mark as Done
            </p>
          )}
        </>
      )}
    </Popover>
  );
}

function BlockList({
  blocks,
}: {
  blocks: ContentBlock[];
}) {
  if (blocks.length === 0) {
    return <p className="text-sm text-slate-400 italic">No content added yet.</p>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <div key={block.id}>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {block.title}
          </h4>
          {block.description?.trim() && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">
              {block.description}
            </p>
          )}
          <AttachmentList
            attachments={block.attachments}
            colorClass={ATTACHMENT_CLASS}
          />
        </div>
      ))}
    </div>
  );
}

interface Props {
  step: TrackStep;
  status: ActivityStatus;
  blocks: ContentBlock[];
  locked: boolean;
  lockedMessage: string;
  requiresProof?: boolean;
  proofUrl?: string;
  onStatusChange: (status: "done" | "help", proofUrl?: string) => void;
  readOnly?: boolean;
}

/** One step of a resource track — the reading, or the deliverable that follows it. */
export function StepPanel({
  step,
  status,
  blocks,
  locked,
  lockedMessage,
  requiresProof,
  proofUrl,
  onStatusChange,
  readOnly = false,
}: Props) {
  const [uploadedFile, setUploadedFile] = useState<string | null>(proofUrl ?? null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUploadedFile(proofUrl ?? null);
  }, [proofUrl]);

  const displayStatus = toDisplayStatus(status);
  const isDone = status === "done";
  const isHelp = status === "help";
  const showLocked = locked && !readOnly;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setUploadedFile(e.target?.result as string);
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
    <div className={cn("transition-opacity", showLocked && "opacity-60")}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {step === "learn" ? (
            <BookOpen className="w-3.5 h-3.5" />
          ) : (
            <PenLine className="w-3.5 h-3.5" />
          )}
          {step === "learn" ? "Learn" : "Practice"}
        </span>
        {!readOnly && (
          <div className="ml-auto shrink-0">
            <StatusDropdown
              displayStatus={displayStatus}
              onSelect={handleStatusSelect}
              requiresProof={requiresProof}
              hasProof={!!uploadedFile}
            />
          </div>
        )}
      </div>

      {showLocked ? (
        <p className="text-sm text-slate-400 dark:text-slate-600 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          {lockedMessage}
        </p>
      ) : (
        <div className="space-y-4">
          <BlockList blocks={blocks} />

          {requiresProof && !isDone && !readOnly && (
            <div>
              <p className="eyebrow-muted mb-2">
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
                      ? "border-primary bg-white dark:bg-slate-900 border border-primary/30"
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
                      Drag &amp; drop or click to browse
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
                <ImageIcon className="w-3 h-3" />
                Submitted Proof
              </p>
              <img
                src={uploadedFile}
                alt="Submitted proof"
                className="max-h-24 rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
              />
            </div>
          )}

          {isHelp && !readOnly && (
            <p className="text-xs text-slate-400 dark:text-slate-600">
              Help! — your teacher will follow up. You can keep going in the other resources.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
