"use client";

import { useEffect, useRef, useState } from "react";
import type { CurriculumUnit } from "@/lib/db/types";
import type { SectionRemap } from "@/lib/store";
import {
  applyChanges,
  buildChangeSet,
  type ChangeSet,
  type CurriculumProposal,
} from "@/lib/curriculum-diff";
import { isDemoMode } from "@/lib/demo-seed";
import { CurriculumDiff } from "./CurriculumDiff";
import { CurriculumImport } from "./CurriculumImport";
import { CurriculumTable } from "./CurriculumTable";

interface CurriculumPanelProps {
  classId: string;
  units: CurriculumUnit[];
  importInstructions?: string;
  onUpdate: (units: CurriculumUnit[]) => void;
  onSaveInstructions: (text: string) => void;
  onApply: (units: CurriculumUnit[], remaps: SectionRemap[]) => Promise<void>;
  getSubunitHref?: (subunitId: string) => string;
}

/**
 * The Curriculum tab: the import above, the curriculum below, and — once a
 * proposal exists — the proposal written over that same curriculum until the
 * teacher has said yes or no to each part of it. The table is the one place
 * changes are reviewed, so there is never a second version of the truth on
 * screen to compare against.
 */

/** What the model needs to see. Blocks and attachments are neither. */
function slim(units: CurriculumUnit[]): CurriculumUnit[] {
  return units.map((unit) => ({
    ...unit,
    subunits: unit.subunits.map((section) => ({
      ...section,
      blocks: undefined,
      tracks: (section.tracks ?? []).map((track) => ({ ...track, blocks: [] })),
    })),
  }));
}

export function CurriculumPanel({
  classId,
  units,
  importInstructions,
  onUpdate,
  onSaveInstructions,
  onApply,
  getSubunitHref,
}: CurriculumPanelProps) {
  const [demo, setDemo] = useState(false);
  const [instructions, setInstructions] = useState(importInstructions ?? "");
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [set, setSet] = useState<ChangeSet | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [approved, setApproved] = useState<ReadonlySet<string>>(new Set());
  // Lets the teacher abort a read that is taking too long. Held in a ref so
  // the cancel button is not re-wiring itself on every render.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setDemo(isDemoMode()), []);

  function cancel() {
    abortRef.current?.abort();
  }

  async function generate(files: File[]) {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      body.append("classId", classId);
      body.append("instructions", instructions);
      if (demo) {
        body.append("demo", "1");
        body.append("units", JSON.stringify(slim(units)));
      }

      const response = await fetch("/api/curriculum/import", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        proposal?: CurriculumProposal;
        error?: string;
      };
      if (!response.ok || !payload.proposal) {
        throw new Error(payload.error || "The import could not be completed");
      }

      // Nothing is approved to begin with. The teacher decides, not the model.
      setSet(buildChangeSet(units, payload.proposal));
      setNotes(payload.proposal.notes ?? []);
      setApproved(new Set());
    } catch (err) {
      // An abort is the teacher's own decision, not a failure to report.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "The import could not be completed");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setApproved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply() {
    if (!set) return;
    setApplying(true);
    setError("");
    try {
      const { units: next, remaps } = applyChanges(units, set, approved);
      await onApply(next, remaps);
      setSet(null);
      setNotes([]);
      setApproved(new Set());
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        /stale/i.test(message)
          ? "The curriculum changed while you were reviewing. Reload and import again."
          : "Those changes could not be saved"
      );
    } finally {
      setApplying(false);
    }
  }

  return (
    <div>
      <CurriculumImport
        units={units}
        demo={demo}
        instructions={instructions}
        onInstructionsChange={setInstructions}
        onInstructionsCommit={() => {
          if (instructions !== (importInstructions ?? "")) onSaveInstructions(instructions);
        }}
        onGenerate={generate}
        onCancel={cancel}
        busy={busy}
        error={error}
        reviewing={set !== null}
      />

      {set ? (
        <CurriculumDiff
          set={set}
          approved={approved}
          notes={notes}
          applying={applying}
          onToggle={toggle}
          onApproveAll={() => setApproved(new Set(set.changes.map((c) => c.id)))}
          onDenyAll={() => setApproved(new Set())}
          onApply={apply}
          onDiscard={() => {
            setSet(null);
            setNotes([]);
            setApproved(new Set());
          }}
        />
      ) : (
        <CurriculumTable
          classId={classId}
          units={units}
          onUpdate={onUpdate}
          getSubunitHref={getSubunitHref}
        />
      )}
    </div>
  );
}
