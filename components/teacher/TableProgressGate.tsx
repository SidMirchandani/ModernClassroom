"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { UNIT } from "@/lib/data";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

interface Props {
  blockSectionId: string;
  onChange: (sectionId: string) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  columnRefs: RefObject<(HTMLTableCellElement | null)[]>;
  sectionIds?: string[];
}

export function TableProgressGate({
  blockSectionId,
  onChange,
  containerRef,
  columnRefs,
  sectionIds: sectionIdsProp,
}: Props) {
  const sectionIds = sectionIdsProp ?? UNIT.sections.map((s) => s.id);
  const [dragging, setDragging] = useState(false);
  const [lineLeft, setLineLeft] = useState<number | null>(null);

  const blockIndex = sectionIds.indexOf(blockSectionId);
  const safeIndex = blockIndex >= 0 ? blockIndex : sectionIds.length - 1;

  const updateLinePosition = useCallback(() => {
    const container = containerRef.current;
    const col = columnRefs.current?.[safeIndex];
    if (!container || !col) return;
    const containerRect = container.getBoundingClientRect();
    const colRect = col.getBoundingClientRect();
    setLineLeft(colRect.right - containerRect.left + container.scrollLeft);
  }, [containerRef, columnRefs, safeIndex]);

  useEffect(() => {
    updateLinePosition();
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(updateLinePosition);
    ro.observe(container);
    container.addEventListener("scroll", updateLinePosition);
    window.addEventListener("resize", updateLinePosition);

    return () => {
      ro.disconnect();
      container.removeEventListener("scroll", updateLinePosition);
      window.removeEventListener("resize", updateLinePosition);
    };
  }, [containerRef, updateLinePosition]);

  const snapFromClientX = useCallback(
    (clientX: number) => {
      const cols = columnRefs.current;
      if (!cols?.length) return;

      for (let i = 0; i < cols.length; i++) {
        const el = cols[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          onChange(sectionIds[i]);
          return;
        }
      }

      const first = cols[0]?.getBoundingClientRect();
      const last = cols[cols.length - 1]?.getBoundingClientRect();
      if (first && clientX < first.left) onChange(sectionIds[0]);
      else if (last && clientX > last.right)
        onChange(sectionIds[sectionIds.length - 1]);
    },
    [columnRefs, onChange, sectionIds]
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => snapFromClientX(e.clientX);
    const onUp = () => setDragging(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, snapFromClientX]);

  if (lineLeft === null) return null;

  return (
    <div
      className="absolute top-0 bottom-0 z-[1] pointer-events-none"
      style={{ left: lineLeft }}
    >
      <div className="absolute inset-y-0 -translate-x-1/2 w-0.5 bg-red-500" />

      <button
        type="button"
        aria-label="Drag progress gate"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(true);
          snapFromClientX(e.clientX);
        }}
        className={cn(
          "pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-12 rounded bg-red-500 hover:bg-red-600 text-white cursor-ew-resize touch-none",
          dragging && "ring-2 ring-red-300 dark:ring-red-700"
        )}
      >
        <GripVertical className="w-3 h-3" />
      </button>
    </div>
  );
}
