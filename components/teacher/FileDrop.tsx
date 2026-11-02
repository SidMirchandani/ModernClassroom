"use client";

import { useRef, useState } from "react";
import { CloudUpload, FileSpreadsheet, FileText, FileImage, FolderOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const ACCEPTED_MATERIALS =
  ".docx,.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.md,.pdf,.png,.jpg,.jpeg,.webp";

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

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileGlyph({ name }: { name: string }) {
  if (/\.(xlsx?|xlsm|ods|csv|tsv)$/i.test(name)) {
    return <FileSpreadsheet className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  }
  if (/\.(png|jpe?g|webp)$/i.test(name)) {
    return <FileImage className="w-6 h-6 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />;
  }
  return <FileText className="w-6 h-6 shrink-0 text-primary dark:text-primary-glow" aria-hidden />;
}

/**
 * Choosing the teacher's files, made impossible to miss: one large area to
 * drop them on, and a full-size button that says exactly what it does —
 * "Choose a file from my computer" — for anyone who has never dragged a file
 * anywhere. What it reads is listed underneath, in words.
 *
 * Chosen files are listed as full rows, each with its own Remove button, and
 * the area stays below them, smaller, for adding another.
 */
export function FileDrop({
  files,
  onFilesChange,
  disabled = false,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tooLarge = totalMegabytes(files) > MAX_UPLOAD_MB;

  const add = (incoming: FileList | File[] | null) => {
    if (!incoming || disabled) return;
    onFilesChange([...files, ...Array.from(incoming)].slice(0, MAX_FILES));
  };

  const area = (compact: boolean) => (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        add(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-2xl border-2 border-dashed text-center transition-colors",
        compact ? "px-4 py-4" : "px-6 py-8",
        dragging
          ? "border-primary bg-primary/5 dark:bg-primary/10"
          : "border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/20"
      )}
    >
      {!compact && (
        <>
          <CloudUpload className="w-10 h-10 mx-auto text-primary dark:text-primary-glow" aria-hidden />
          <p className="mt-2 text-base font-medium text-slate-900 dark:text-slate-100">
            {dragging ? "Let go to add it" : "Drag your file here"}
          </p>
          <p className="my-2 text-sm text-slate-500 dark:text-slate-400">or</p>
        </>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn("btn btn-lg", compact ? "btn-secondary" : "btn-primary")}
      >
        <FolderOpen className="w-5 h-5" />
        {compact ? "Add another file" : "Choose a file from my computer"}
      </button>
      {!compact && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Works with Word, Excel, PDF, or a photo of a printed page
        </p>
      )}
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
  );

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="fade-in flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
            >
              <FileGlyph name={file.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-slate-900 dark:text-slate-100">{file.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Ready · {formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onFilesChange(files.filter((_, i) => i !== index))}
                className="btn btn-md btn-secondary shrink-0"
              >
                <X className="w-4 h-4" />
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {area(files.length > 0)}

      {tooLarge && (
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
          These files are over {MAX_UPLOAD_MB} MB together. Remove one to continue.
        </p>
      )}
    </div>
  );
}
