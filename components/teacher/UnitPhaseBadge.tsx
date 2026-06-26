import { cn } from "@/lib/utils";
import {
  UNIT_PHASE_CLASSES,
  UNIT_PHASE_LABEL,
  type UnitPhase,
} from "@/lib/unit-phase";

export function UnitPhaseBadge({ phase }: { phase: UnitPhase }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border shrink-0",
        UNIT_PHASE_CLASSES[phase]
      )}
    >
      {UNIT_PHASE_LABEL[phase]}
    </span>
  );
}
