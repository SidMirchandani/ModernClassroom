"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Link2,
  Paperclip,
  ChevronDown,
  FileText,
  BookOpen,
  PenLine,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type {
  BlockAttachment,
  ContentBlock,
  ResourceTrack,
  Section,
  SectionObjective,
  TrackKind,
  TrackStep,
} from "@/lib/types";
import {
  emptyAttachment,
  emptyBlock,
  emptyTrack,
  getTrackBlocks,
  normalizeSection,
  TRACK_KIND_COLORS,
  TRACK_KIND_LABELS,
} from "@/lib/section-tracks";
import { ObjectiveListEditor } from "./ObjectiveListEditor";
import { cn } from "@/lib/utils";

interface Props {
  section: Section;
  onChange: (section: Section) => void;
  onSave: (section: Section) => void;
}

const ADDABLE_KINDS: TrackKind[] = [
  "textbook",
  "apclassroom",
  "guided",
  "extra",
  "custom",
];

/**
 * The three-resource editor. A section is authored one resource at a time —
 * the textbook, AP Classroom, the guided notes — because the three never line
 * up on the same numbering and each carries its own targets and deliverable.
 */
export function SubunitTracksEditor({ section, onChange, onSave }: Props) {
  const sectionRef = useRef(normalizeSection(section));
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    sectionRef.current = normalizeSection(section);
  }, [section]);

  function emit(tracks: ResourceTrack[], persist = false) {
    const next = { ...sectionRef.current, tracks };
    sectionRef.current = next;
    onChange(next);
    if (persist) onSave(next);
  }

  function updateTrack(
    trackId: string,
    patch: Partial<ResourceTrack> | ((track: ResourceTrack) => ResourceTrack),
    persist = false
  ) {
    emit(
      sectionRef.current.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return typeof patch === "function" ? patch(t) : { ...t, ...patch };
      }),
      persist
    );
  }

  function addTrack(kind: TrackKind) {
    emit([...sectionRef.current.tracks, emptyTrack(kind)], true);
    setMenuOpen(false);
  }

  function removeTrack(trackId: string) {
    emit(
      sectionRef.current.tracks.filter((t) => t.id !== trackId),
      true
    );
  }

  const tracks = sectionRef.current.tracks;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Resources
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">
          Each resource becomes its own button for students, with its own Learn and
          Practice steps.
        </p>
      </div>

      {tracks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-slate-400">No resources yet.</p>
          <AddTrackMenu open={menuOpen} onOpenChange={setMenuOpen} onAdd={addTrack} />
        </div>
      ) : (
        <>
          {tracks.map((track) => (
            <TrackEditorCard
              key={track.id}
              track={track}
              onUpdate={(patch, persist) => updateTrack(track.id, patch, persist)}
              onSaveCurrent={() => onSave(sectionRef.current)}
              onRemove={() => removeTrack(track.id)}
            />
          ))}
          <AddTrackMenu open={menuOpen} onOpenChange={setMenuOpen} onAdd={addTrack} />
        </>
      )}
    </section>
  );
}

function TrackEditorCard({
  track,
  onUpdate,
  onSaveCurrent,
  onRemove,
}: {
  track: ResourceTrack;
  onUpdate: (
    patch: Partial<ResourceTrack> | ((track: ResourceTrack) => ResourceTrack),
    persist?: boolean
  ) => void;
  onSaveCurrent: () => void;
  onRemove: () => void;
}) {
  const colors = TRACK_KIND_COLORS[track.kind];

  function setObjectives(objectives: SectionObjective[], persist: boolean) {
    onUpdate({ objectives }, persist);
  }

  function addBlock(step: TrackStep) {
    onUpdate((current) => ({ ...current, blocks: [...current.blocks, emptyBlock(step)] }), true);
  }

  function updateBlock(
    blockId: string,
    patch: Partial<ContentBlock> | ((block: ContentBlock) => ContentBlock),
    persist = false
  ) {
    onUpdate(
      (current) => ({
        ...current,
        blocks: current.blocks.map((b) => {
          if (b.id !== blockId) return b;
          return typeof patch === "function" ? patch(b) : { ...b, ...patch };
        }),
      }),
      persist
    );
  }

  function removeBlock(blockId: string) {
    onUpdate(
      (current) => ({ ...current, blocks: current.blocks.filter((b) => b.id !== blockId) }),
      true
    );
  }

  return (
    <div className={cn("rounded-xl border bg-white dark:bg-slate-900 p-5 space-y-5", colors.border)}>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0",
            colors.badge
          )}
        >
          {TRACK_KIND_LABELS[track.kind]}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
          title="Remove resource"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Name students see
          </label>
          <input
            type="text"
            value={track.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            onBlur={onSaveCurrent}
            placeholder={TRACK_KIND_LABELS[track.kind]}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Where it lands in this resource
          </label>
          <input
            type="text"
            value={track.reference ?? ""}
            onChange={(e) => onUpdate({ reference: e.target.value })}
            onBlur={onSaveCurrent}
            placeholder="e.g. Ch 11 – Least Squares"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          checked={track.optional === true}
          onChange={(e) => onUpdate({ optional: e.target.checked }, true)}
          className="rounded border-slate-300 dark:border-slate-600"
        />
        Optional — students can skip it and still finish the section
      </label>

      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2">
          Learning Targets for this resource
        </p>
        <ObjectiveListEditor
          objectives={track.objectives}
          onChange={(objectives) => setObjectives(objectives, false)}
          onSave={(objectives) => setObjectives(objectives, true)}
          placeholder="Paste a CED learning target…"
          addLabel="Add Target"
          emptyLabel="No targets on this resource yet."
          dotClass={colors.dot}
          compact
        />
      </div>

      <StepBlocks
        step="learn"
        blocks={getTrackBlocks(track, "learn")}
        onAdd={() => addBlock("learn")}
        onUpdate={updateBlock}
        onRemove={removeBlock}
        onBlur={onSaveCurrent}
      />

      <StepBlocks
        step="practice"
        blocks={getTrackBlocks(track, "practice")}
        onAdd={() => addBlock("practice")}
        onUpdate={updateBlock}
        onRemove={removeBlock}
        onBlur={onSaveCurrent}
      />
    </div>
  );
}

function StepBlocks({
  step,
  blocks,
  onAdd,
  onUpdate,
  onRemove,
  onBlur,
}: {
  step: TrackStep;
  blocks: ContentBlock[];
  onAdd: () => void;
  onUpdate: (
    blockId: string,
    patch: Partial<ContentBlock> | ((block: ContentBlock) => ContentBlock),
    persist?: boolean
  ) => void;
  onRemove: (blockId: string) => void;
  onBlur: () => void;
}) {
  const Icon = step === "learn" ? BookOpen : PenLine;

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {step === "learn" ? "Learn" : "Practice"}
        </p>
        <span className="text-[11px] text-slate-400 dark:text-slate-600">
          {step === "learn"
            ? "reading, notes, video"
            : "the deliverable students submit"}
        </span>
      </div>

      {blocks.length === 0 ? (
        <p className="text-sm text-slate-400 italic mb-2">Nothing here yet.</p>
      ) : (
        <div className="space-y-3 mb-2">
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              onUpdate={(patch, persist) => onUpdate(block.id, patch, persist)}
              onRemove={() => onRemove(block.id)}
              onBlur={onBlur}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="text-sm text-primary dark:text-primary-glow hover:underline flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Add {step === "learn" ? "material" : "deliverable"}
      </button>
    </div>
  );
}

function BlockCard({
  block,
  onUpdate,
  onRemove,
  onBlur,
}: {
  block: ContentBlock;
  onUpdate: (
    patch: Partial<ContentBlock> | ((block: ContentBlock) => ContentBlock),
    persist?: boolean
  ) => void;
  onRemove: () => void;
  onBlur: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addLinkAttachment() {
    onUpdate(
      (current) => ({
        ...current,
        attachments: [...current.attachments, emptyAttachment("link")],
      }),
      true
    );
  }

  function addFileAttachment(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      onUpdate(
        (current) => ({
          ...current,
          attachments: [
            ...current.attachments,
            {
              id: uuidv4(),
              kind: "file" as const,
              label: file.name,
              url,
              fileName: file.name,
            },
          ],
        }),
        true
      );
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-4 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          onBlur={onBlur}
          placeholder="Title"
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
          title="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <textarea
        value={block.description ?? ""}
        onChange={(e) => onUpdate({ description: e.target.value })}
        onBlur={onBlur}
        rows={2}
        placeholder="Instructions (optional)…"
        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-y"
      />

      {block.attachments.length > 0 && (
        <div className="space-y-2">
          {block.attachments.map((attachment, i) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              onChange={(updated) =>
                onUpdate((current) => {
                  const attachments = [...current.attachments];
                  attachments[i] = updated;
                  return { ...current, attachments };
                })
              }
              onBlur={onBlur}
              onRemove={() =>
                onUpdate(
                  (current) => ({
                    ...current,
                    attachments: current.attachments.filter((_, j) => j !== i),
                  }),
                  true
                )
              }
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addLinkAttachment}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-primary/60 hover:text-primary transition-colors"
        >
          <Link2 className="w-3.5 h-3.5" />
          Add Link
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-primary/60 hover:text-primary transition-colors"
        >
          <Paperclip className="w-3.5 h-3.5" />
          Add File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) addFileAttachment(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function AttachmentRow({
  attachment,
  onChange,
  onBlur,
  onRemove,
}: {
  attachment: BlockAttachment;
  onChange: (attachment: BlockAttachment) => void;
  onBlur: () => void;
  onRemove: () => void;
}) {
  if (attachment.kind === "file") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">
          {attachment.fileName ?? attachment.label ?? "Attached file"}
        </span>
        <a
          href={attachment.url}
          download={attachment.fileName}
          className="text-xs text-primary hover:underline shrink-0"
        >
          View
        </a>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-rose-400 hover:text-rose-600 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={attachment.label ?? ""}
        onChange={(e) => onChange({ ...attachment, label: e.target.value })}
        onBlur={onBlur}
        placeholder="Label (optional)"
        className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900"
      />
      <input
        type="url"
        value={attachment.url}
        onChange={(e) => onChange({ ...attachment, url: e.target.value })}
        onBlur={onBlur}
        placeholder="https://…"
        className="flex-[2] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900"
      />
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 text-rose-400 hover:text-rose-600 shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function AddTrackMenu({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (kind: TrackKind) => void;
}) {
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-primary/40 text-sm font-medium text-primary dark:text-primary-glow hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Resource
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => onOpenChange(false)}
          />
          <div className="absolute left-0 top-full mt-1 z-20 min-w-[190px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
            {ADDABLE_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => onAdd(kind)}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {TRACK_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
