import type { BlockAttachment } from "@/lib/types";
import { ExternalLink, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

export function AttachmentList({
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
