"use client";

import { useState } from "react";
import type { Section } from "@/lib/types";
import type { SectionActivityStatus, ActivityStatus } from "@/lib/types";
import { isActivityFinished } from "@/lib/progress";
import { ActivityCard } from "./ActivityCard";
import { CheckCircle2, BookOpen, PenLine, Sparkles } from "lucide-react";
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
}

export function SectionView({
  section,
  sectionProgress,
  sectionComplete,
  onUpdateActivity,
}: Props) {
  const [expandedObjectives, setExpandedObjectives] = useState(true);

  const learnStatus = sectionProgress.learn ?? "locked";
  const practiceStatus = sectionProgress.practice ?? "locked";
  const extraStatus = sectionProgress.extra ?? "locked";

  return (
    <div className="w-full">
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
            <StatusDot status={learnStatus} label="L" />
            <StatusDot status={practiceStatus} label="P" />
            <StatusDot status={extraStatus} label="E" />
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
          locked={learnStatus === "locked"}
          lockedMessage="Complete the previous section to unlock"
          onStatusChange={(status) => onUpdateActivity(section.id, "learn", status)}
        >
          <div className="space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Review these resources to learn the material for this section.
            </p>
            <div className="flex flex-wrap gap-2">
              {section.learnResources.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                >
                  {r.label} ↗
                </a>
              ))}
            </div>
          </div>
        </ActivityCard>

        <ActivityCard
          icon={<PenLine className="w-4 h-4" />}
          title="Practice"
          color="violet"
          status={practiceStatus}
          locked={practiceStatus === "locked"}
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
        >
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {section.practiceDescription}
          </p>
        </ActivityCard>

        <ActivityCard
          icon={<Sparkles className="w-4 h-4" />}
          title="Extra Material"
          color="amber"
          status={extraStatus}
          locked={extraStatus === "locked"}
          lockedMessage={
            !isActivityFinished(practiceStatus)
              ? "Complete Practice to unlock extra resources"
              : "Complete the previous section to unlock"
          }
          onStatusChange={(status) => onUpdateActivity(section.id, "extra", status)}
        >
          <div className="space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Optional enrichment resources and tools.
            </p>
            <div className="flex flex-wrap gap-2">
              {section.extraMaterials.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                >
                  {r.label} ↗
                </a>
              ))}
            </div>
          </div>
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
