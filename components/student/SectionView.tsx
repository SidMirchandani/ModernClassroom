"use client";

import { useState } from "react";
import type { Section } from "@/lib/types";
import type { SectionActivityStatus, ActivityStatus } from "@/lib/types";
import { isActivityFinished, hasRevisionNotice } from "@/lib/progress";
import { getBlocksByType } from "@/lib/section-blocks";
import { BlockAttachmentsDisplay } from "@/components/teacher/SubunitContentEditor";
import { ActivityCard } from "./ActivityCard";
import { CheckCircle2, BookOpen, PenLine, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  section: Section;
  sectionProgress: SectionActivityStatus;
  sectionComplete: boolean;
  onUpdateActivity: (
    sectionId: string,
    activity: "learn" | "practice" | "extra",
    status: "done" | "help",
    proofUrl?: string
  ) => void;
  readOnly?: boolean;
}

function BlockList({
  blocks,
  attachmentColorClass,
}: {
  blocks: ReturnType<typeof getBlocksByType>;
  attachmentColorClass: string;
}) {
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">No content added yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <div key={block.id}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {block.title}
          </h3>
          {block.description?.trim() && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">
              {block.description}
            </p>
          )}
          <BlockAttachmentsDisplay
            attachments={block.attachments}
            colorClass={attachmentColorClass}
          />
        </div>
      ))}
    </div>
  );
}

export function SectionView({
  section,
  sectionProgress,
  sectionComplete,
  onUpdateActivity,
  readOnly = false,
}: Props) {
  const [expandedObjectives, setExpandedObjectives] = useState(true);

  const learnStatus = readOnly ? "available" : (sectionProgress.learn ?? "locked");
  const practiceStatus = readOnly ? "available" : (sectionProgress.practice ?? "locked");
  const extraStatus = readOnly ? "available" : (sectionProgress.extra ?? "locked");

  const learnBlocks = getBlocksByType(section, "learn");
  const practiceBlocks = getBlocksByType(section, "practice");
  const extraBlocks = getBlocksByType(section, "extra");
  const sentBackForReview = hasRevisionNotice(sectionProgress);

  return (
    <div className="w-full">
      {sentBackForReview && !readOnly && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Your teacher sent this section back for review. Update your work and submit again when
            you&apos;re ready.
          </p>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                Section {section.id}
              </span>
              {sectionComplete && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Complete
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {section.title}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 pt-1 shrink-0">
            {!readOnly && (
              <>
                <StatusDot status={learnStatus} label="L" />
                <StatusDot status={practiceStatus} label="P" />
                <StatusDot status={extraStatus} label="E" />
              </>
            )}
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setExpandedObjectives((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-2"
          >
            <span>{expandedObjectives ? "▾" : "▸"}</span>
            Learning Objectives ({section.objectives.length})
          </button>

          {expandedObjectives && (
            <ul className="space-y-1.5">
              {section.objectives.map((obj) => (
                <li
                  key={obj.id}
                  className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400"
                >
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-600 shrink-0" />
                  <span>{obj.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <ActivityCard
          icon={<BookOpen className="w-4 h-4" />}
          title="Learn"
          color="blue"
          status={learnStatus}
          locked={!readOnly && learnStatus === "locked"}
          lockedMessage="Complete the previous section to unlock"
          onStatusChange={(status) => onUpdateActivity(section.id, "learn", status)}
          readOnly={readOnly}
        >
          <BlockList
            blocks={learnBlocks}
            attachmentColorClass="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
          />
        </ActivityCard>

        <ActivityCard
          icon={<PenLine className="w-4 h-4" />}
          title="Practice"
          color="violet"
          status={practiceStatus}
          locked={!readOnly && practiceStatus === "locked"}
          lockedMessage={
            !isActivityFinished(learnStatus)
              ? "Complete Learn to unlock Practice"
              : "Complete the previous section to unlock"
          }
          requiresProof
          proofUrl={sectionProgress.practiceProofUrl}
          onStatusChange={(status, proofUrl) =>
            onUpdateActivity(section.id, "practice", status, proofUrl)
          }
          readOnly={readOnly}
        >
          <BlockList
            blocks={practiceBlocks}
            attachmentColorClass="border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900"
          />
        </ActivityCard>

        <ActivityCard
          icon={<Sparkles className="w-4 h-4" />}
          title="Extra Material"
          color="amber"
          status={extraStatus}
          locked={!readOnly && extraStatus === "locked"}
          lockedMessage={
            !isActivityFinished(practiceStatus)
              ? "Complete Practice to unlock extra resources"
              : "Complete the previous section to unlock"
          }
          onStatusChange={(status) => onUpdateActivity(section.id, "extra", status)}
          readOnly={readOnly}
        >
          <BlockList
            blocks={extraBlocks}
            attachmentColorClass="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
          />
        </ActivityCard>
      </div>
    </div>
  );
}

function StatusDot({ status, label }: { status: ActivityStatus; label: string }) {
  const colors: Record<ActivityStatus, string> = {
    locked: "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600",
    available:
      "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400",
    done: "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400",
    help: "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400",
  };
  return (
    <div
      className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
        colors[status]
      )}
      title={`${label}: ${status}`}
    >
      {status === "done" ? "✓" : status === "help" ? "?" : label}
    </div>
  );
}
