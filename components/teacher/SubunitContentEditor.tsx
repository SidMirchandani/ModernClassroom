"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Link2,
  Paperclip,
  ChevronDown,
  FileText,
  ExternalLink,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { BlockAttachment, ContentBlock, ContentBlockType, Section } from "@/lib/types";
import {
  BLOCK_TYPE_COLORS,
  BLOCK_TYPE_LABELS,
  emptyAttachment,
  emptyBlock,
  normalizeSection,
} from "@/lib/section-blocks";
import { cn } from "@/lib/utils";

interface SubunitContentEditorProps {
  section: Section;
  onChange: (section: Section) => void;
  onSave: (section: Section) => void;
}

export function SubunitContentEditor({
  section,
  onChange,
  onSave,
}: SubunitContentEditorProps) {
  const normalized = normalizeSection(section);
  const sectionRef = useRef(normalized);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    sectionRef.current = normalizeSection(section);
  }, [section]);

  function emit(blocks: ContentBlock[], persist = false) {
    const next = { ...sectionRef.current, blocks };
    sectionRef.current = next;
    onChange(next);
    if (persist) onSave(next);
  }

  function updateBlock(
    blockId: string,
    patch: Partial<ContentBlock> | ((block: ContentBlock) => ContentBlock),
    persist = false
  ) {
    const blocks = sectionRef.current.blocks.map((b) => {
      if (b.id !== blockId) return b;
      return typeof patch === "function" ? patch(b) : { ...b, ...patch };
    });
    emit(blocks, persist);
  }

  function addBlock(type: ContentBlockType) {
    emit([...sectionRef.current.blocks, emptyBlock(type)], true);
    setMenuOpen(false);
  }

  function removeBlock(blockId: string) {
    emit(
      sectionRef.current.blocks.filter((b) => b.id !== blockId),
      true
    );
  }

  function saveCurrent() {
    onSave(sectionRef.current);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Content</h2>

      {normalized.blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-slate-400">No content blocks yet.</p>
          <AddBlockMenu open={menuOpen} onOpenChange={setMenuOpen} onAdd={addBlock} />
        </div>
      ) : (
        <>
          {normalized.blocks.map((block) => (
            <ContentBlockCard
              key={block.id}
              block={block}
              onUpdate={(patch, persist) => updateBlock(block.id, patch, persist)}
              onBlur={saveCurrent}
              onRemove={() => removeBlock(block.id)}
            />
          ))}
          <AddBlockMenu open={menuOpen} onOpenChange={setMenuOpen} onAdd={addBlock} />
        </>
      )}
    </section>
  );
}

function ContentBlockCard({
  block,
  onUpdate,
  onBlur,
  onRemove,
}: {
  block: ContentBlock;
  onUpdate: (
    patch: Partial<ContentBlock> | ((block: ContentBlock) => ContentBlock),
    persist?: boolean
  ) => void;
  onBlur: () => void;
  onRemove: () => void;
}) {
  const colors = BLOCK_TYPE_COLORS[block.type];
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
    <div
      className={cn(
        "rounded-xl border bg-white dark:bg-slate-900 p-5 space-y-4",
        colors.border
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
            colors.badge
          )}
        >
          {BLOCK_TYPE_LABELS[block.type]}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
          title="Remove block"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          onBlur={onBlur}
          placeholder="Block title"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Description <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={block.description ?? ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          onBlur={onBlur}
          rows={3}
          placeholder="Add a description…"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-y"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-2">
          Attach <span className="text-slate-400 font-normal">(optional)</span>
        </label>

        {block.attachments.length > 0 && (
          <div className="space-y-2 mb-3">
            {block.attachments.map((attachment, i) => (
              <AttachmentRow
                key={attachment.id}
                attachment={attachment}
                onChange={(updated) => {
                  onUpdate((current) => {
                    const attachments = [...current.attachments];
                    attachments[i] = updated;
                    return { ...current, attachments };
                  });
                }}
                onBlur={onBlur}
                onRemove={() => {
                  onUpdate(
                    (current) => ({
                      ...current,
                      attachments: current.attachments.filter((_, j) => j !== i),
                    }),
                    true
                  );
                }}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addLinkAttachment}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            Add link
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 transition-colors"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Add file
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
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">
          {attachment.fileName ?? attachment.label ?? "Attached file"}
        </span>
        <a
          href={attachment.url}
          download={attachment.fileName}
          className="text-xs text-violet-600 hover:underline shrink-0"
        >
          View
        </a>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-red-400 hover:text-red-600 shrink-0"
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
        className="p-1.5 text-red-400 hover:text-red-600 shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function AddBlockMenu({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (type: ContentBlockType) => void;
}) {
  const types: ContentBlockType[] = ["learn", "practice", "extra"];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-violet-300 dark:border-violet-700 text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add block
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
          <div className="absolute left-0 top-full mt-1 z-20 min-w-[180px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1">
            {types.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onAdd(type)}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {BLOCK_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function BlockAttachmentsDisplay({
  attachments,
  colorClass,
}: {
  attachments: BlockAttachment[];
  colorClass: string;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((a) =>
        a.kind === "file" ? (
          <a
            key={a.id}
            href={a.url}
            download={a.fileName}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
              colorClass
            )}
          >
            <Paperclip className="w-3.5 h-3.5" />
            {a.fileName ?? a.label ?? "Download file"}
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
              colorClass
            )}
          >
            {a.label || "Link"}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )
      )}
    </div>
  );
}
