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
import { takePendingImport } from "@/lib/pending-import";
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
  // Files handed over by the new-class page, shown as already attached.
  const [handedFiles, setHandedFiles] = useState<File[]>([]);
  const handoffChecked = useRef(false);

  useEffect(() => setDemo(isDemoMode()), []);

  // A class created from the teacher's materials arrives here with them
  // waiting: start reading straight away, so the first thing the teacher sees
  // in their new class is the AI's draft forming. Checked once — the ref
  // survives React's double-run of effects in development.
  useEffect(() => {
    if (handoffChecked.current) return;
    handoffChecked.current = true;
    const handed = takePendingImport(classId);
    if (!handed) return;
    setHandedFiles(handed.files);
    if (handed.instructions) {
      setInstructions(handed.instructions);
      onSaveInstructions(handed.instructions);
    }
    void generate(handed.files, handed.instructions);
    // Runs once, on arrival; generate reads everything it needs from its args.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  function cancel() {
    abortRef.current?.abort();
  }

  async function generate(files: File[], guidance: string = instructions) {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      body.append("classId", classId);
      body.append("instructions", guidance);
      // Asked directly rather than read from state: an import started on
      // arrival runs before the effect that sets `demo` has.
      if (isDemoMode()) {
        body.append("demo", "1");
        body.append("units", JSON.stringify(slim(units)));
      }

      const response = await fetch("/api/curriculum/import", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      // Not every failure is ours to word: the platform answers an oversized
      // upload or a timed-out function with its own non-JSON page, and
      // parsing that as JSON would show the teacher a syntax error.
      const payload = (await response.json().catch(() => ({
        error:
          response.status === 413
            ? "Those files are too large to send — keep the upload under 4 MB"
            : response.status === 504
              ? "Reading those files took too long. Try again, or with fewer files."
              : undefined,
      }))) as {
        proposal?: CurriculumProposal;
        error?: string;
      };
      if (!response.ok || !payload.proposal) {
        throw new Error(payload.error || "Something went wrong reading those files — try again");
      }

      // Nothing is approved to begin with. The teacher decides, not the model.
      setSet(buildChangeSet(units, payload.proposal));
      setNotes(payload.proposal.notes ?? []);
      setApproved(new Set());
    } catch (err) {
      // An abort is the teacher's own decision, not a failure to report.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong reading those files — try again");
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
        onGenerate={(files) => generate(files)}
        initialFiles={handedFiles}
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
