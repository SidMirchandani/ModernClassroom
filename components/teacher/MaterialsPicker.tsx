"use client";

import { useRef, useState, type ReactNode } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const ACCEPTED_MATERIALS =
  ".xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.md,.pdf,.png,.jpg,.jpeg,.webp";

/**
 * Vercel refuses a request body over 4.5 MB before the import route ever
 * runs, so the limit sits just under it. A scanned plan is rarely near it; a
 * photo straight off a phone can be, which is why it is checked before sending.
 */
export const MAX_UPLOAD_MB = 4;
const MAX_FILES = 10;

export function totalMegabytes(files: File[]): number {
  return files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024;
}

interface MaterialsPickerProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onNotesBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** The files are being read: a band of light runs along the top edge. */
  busy?: boolean;
  /** The send side of the bottom bar — the button that starts the read. */
  actions?: ReactNode;
}

/**
 * The teacher's materials and what the AI should know about them, as one
 * composer — the shape people already know from chat apps: write a note,
 * attach files, send. Shared by the new-class page and the Curriculum tab, so
 * creating a class and updating one ask the same thing in the same way.
 *
 * One surface, deliberately. An earlier version spread this over a dashed
 * drop box, a separate file list and an underlined text field; on its own the
 * underline did not read as somewhere to type, and the pieces drifted apart.
 * Here the whole composer is the drop target, attached files sit inside it as
 * chips, and the attach and send controls share its bottom bar.
 */
export function MaterialsPicker({
  files,
  onFilesChange,
  notes,
  onNotesChange,
  onNotesBlur,
  placeholder = "Notes (optional)",
  disabled = false,
  busy = false,
  actions,
}: MaterialsPickerProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (incoming: FileList | File[] | null) => {
    if (!incoming || disabled) return;
    onFilesChange([...files, ...Array.from(incoming)].slice(0, MAX_FILES));
  };

  const total = totalMegabytes(files);
  const tooLarge = total > MAX_UPLOAD_MB;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          // Leaving for a child is not leaving.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 transition-[border-color,box-shadow,background-color] duration-200",
          "focus-within:border-primary/50 focus-within:shadow-[0_0_0_4px_rgb(var(--primary)/0.1)]",
          dragging
            ? "border-primary bg-primary/5 dark:bg-primary/10"
            : "border-slate-200 dark:border-slate-700"
        )}
      >
        {busy && <span aria-hidden className="scan-line" />}

        {files.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 px-3 pt-3">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="fade-in inline-flex items-center gap-1.5 max-w-full h-8 pl-2.5 pr-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs"
              >
                <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate max-w-[14rem] text-slate-700 dark:text-slate-200">
                  {file.name}
                </span>
                <span className="text-slate-400 tabular-nums shrink-0">{formatSize(file.size)}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onFilesChange(files.filter((_, i) => i !== index))}
                  className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-700 disabled:pointer-events-none transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          rows={3}
          value={notes}
          disabled={disabled}
          aria-label="Notes"
          onChange={(e) => onNotesChange(e.target.value)}
          onBlur={onNotesBlur}
          placeholder={placeholder}
          className="block w-full resize-none bg-transparent border-0 px-4 pt-3 pb-1 text-sm leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:!shadow-none focus-visible:outline-none disabled:opacity-60"
        />

        <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="btn btn-sm btn-ghost"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Attach files
          </button>
          {dragging && (
            <span className="min-w-0 truncate text-xs text-slate-400 dark:text-slate-500">
              Drop to attach
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">{actions}</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_MATERIALS}
            className="hidden"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {tooLarge && (
        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          Over {MAX_UPLOAD_MB} MB — remove a file.
        </p>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
