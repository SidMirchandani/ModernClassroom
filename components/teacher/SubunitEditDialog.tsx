"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { Section } from "@/lib/types";
import { getTracks } from "@/lib/section-tracks";
import { schoolYearStart, shiftDateText } from "@/lib/curriculum-edit";
import { Modal } from "@/components/Modal";

/**
 * One subunit, opened as a full-size form when it is clicked in the
 * curriculum: its name, its date, and where it sits in each resource, in
 * large labelled fields — and nothing saved until "Save changes". The moves
 * around it are buttons that say what they do: a day earlier or later, add a
 * subunit after this one, delete it (asked twice, in the form itself).
 * Activities and attachments are in the full editor, one link away.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "3/22" as "Monday, March 22", so a teacher can check it against a calendar at a glance. */
function spelledOut(date: string): string | null {
  const match = date.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const start = schoolYearStart();
  const d = new Date(month >= 8 ? start : start + 1, month - 1, day);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[month - 1]} ${day}`;
}

export function SubunitEditDialog({
  section,
  href,
  fresh,
  onSave,
  onAddAfter,
  onRemove,
  onClose,
}: {
  section: Section | null;
  /** The subunit's full editor. */
  href: string;
  /** Just added: the name is selected, ready to type over "New subunit". */
  fresh: boolean;
  onSave: (next: Section) => void;
  /** With anything typed but not yet saved, so it is kept, not lost. */
  onAddAfter: (edited: Section | null) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // A subunit opened: start from what it says now.
  useEffect(() => {
    if (!section) return;
    setTitle(section.title);
    setDate(section.date ?? "");
    setRefs(Object.fromEntries(getTracks(section).map((t) => [t.id, t.reference ?? ""])));
    setConfirmDelete(false);
    // The opening animation runs first; then the name is ready to type.
    if (fresh) window.setTimeout(() => titleRef.current?.select(), 60);
    // Only on opening another subunit — not on every save of this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section?.id]);

  if (!section) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const tracks = getTracks(section);
  const changed =
    title.trim() !== section.title ||
    date.trim() !== (section.date ?? "") ||
    tracks.some((t) => (refs[t.id] ?? "").trim() !== (t.reference ?? ""));

  function edited(): Section {
    return {
      ...section!,
      title: title.trim() || section!.title,
      date: date.trim() || undefined,
      tracks: tracks.map((t) => ({ ...t, reference: (refs[t.id] ?? "").trim() })),
    };
  }

  function save() {
    onSave(edited());
    onClose();
  }

  const field =
    "w-full h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-base bg-white dark:bg-slate-900 transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
  const words = spelledOut(date);

  return (
    <Modal open onClose={onClose} title={`Edit subunit ${section.id}`} className="max-w-lg">
      <div className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-[15px] font-medium text-slate-800 dark:text-slate-100">Name</span>
          <input ref={titleRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </label>

        <div className="space-y-1.5">
          <span className="block text-[15px] font-medium text-slate-800 dark:text-slate-100">Date</span>
          <input
            type="text"
            value={date}
            aria-label="Date"
            onChange={(e) => setDate(e.target.value)}
            className={field}
          />
          {words && <p className="text-sm text-slate-500 dark:text-slate-400">{words}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={!words}
              onClick={() => setDate((d) => shiftDateText(d, -1))}
              className="btn btn-md btn-secondary"
            >
              <ChevronLeft className="w-4 h-4" />1 school day earlier
            </button>
            <button
              type="button"
              disabled={!words}
              onClick={() => setDate((d) => shiftDateText(d, 1))}
              className="btn btn-md btn-secondary"
            >
              1 school day later
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {tracks.length > 0 && (
          <div className="space-y-3">
            <p className="text-[15px] font-medium text-slate-800 dark:text-slate-100">Where it is in each resource</p>
            {tracks.map((track) => (
              <label key={track.id} className="block space-y-1">
                <span className="text-sm text-slate-500 dark:text-slate-400">{track.label}</span>
                <input
                  type="text"
                  value={refs[track.id] ?? ""}
                  onChange={(e) => setRefs((r) => ({ ...r, [track.id]: e.target.value }))}
                  className={field}
                />
              </label>
            ))}
          </div>
        )}

        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-[15px] font-medium text-primary dark:text-primary-glow hover:underline"
        >
          Open the full editor — activities, files and targets
          <ArrowUpRight className="w-4 h-4" />
        </Link>

        {confirmDelete ? (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 px-4 py-3 space-y-3">
            <p className="text-[15px] text-rose-900 dark:text-rose-100">
              Delete subunit {section.id}? Any quiz or test after it moves to the subunit before. Work students
              did on it is kept, and comes back if you add it again.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onRemove} className="btn btn-md btn-danger">
                Yes, delete it
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn btn-md btn-secondary">
                No, keep it
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="btn btn-md btn-ghost mt-3 !text-rose-600 dark:!text-rose-400"
            >
              <Trash2 className="w-4 h-4" />
              Delete this subunit
            </button>
            <button
              type="button"
              onClick={() => onAddAfter(changed ? edited() : null)}
              className="btn btn-md btn-secondary mt-3"
            >
              <Plus className="w-4 h-4" />
              Add a subunit after this one
            </button>
            <button type="button" onClick={save} disabled={!changed} className="btn btn-lg btn-primary mt-3 ml-auto">
              Save changes
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
