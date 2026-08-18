import {
  Atom,
  BookOpen,
  Calculator,
  Code2,
  Dna,
  FlaskConical,
  Globe2,
  GraduationCap,
  Landmark,
  Languages,
  LayoutGrid,
  Music,
  Palette,
  type LucideIcon,
} from "lucide-react";

/**
 * What something looks like — the glyph that stands for a class, and the accent
 * a class or a person wears. Both are picked from a fixed set rather than typed
 * as a hex code: every option here is already legible in light and dark, on
 * white and on the class strip, which a free colour picker cannot promise.
 */

export type AccentId =
  | "blue"
  | "indigo"
  | "violet"
  | "teal"
  | "emerald"
  | "amber"
  | "rose"
  | "slate";

export interface Accent {
  id: AccentId;
  label: string;
  /** Solid fill for the picker swatch — the one place a colour is named
      outside the CSS variables, because the picker has to show all eight at
      once while the page is wearing only one of them. */
  swatch: string;
}

/**
 * The colour itself lives in `globals.css` as the `--primary-*` channels under
 * `[data-accent="…"]`; `useClassTheme` puts that attribute on `<html>`
 * while a class page is open. So nothing here needs a Tailwind class per
 * colour: `text-primary`, `bg-primary/[0.85]`, `border-primary/30` and every
 * other brand utility already in the app resolve to the class's own colour.
 */
export const ACCENTS: Record<AccentId, Accent> = {
  // `bg-brand`, not `bg-primary` — inside a rose class, `primary` is rose.
  blue: { id: "blue", label: "Blue", swatch: "bg-brand" },
  indigo: { id: "indigo", label: "Indigo", swatch: "bg-indigo-600" },
  violet: { id: "violet", label: "Violet", swatch: "bg-violet-600" },
  teal: { id: "teal", label: "Teal", swatch: "bg-teal-600" },
  emerald: { id: "emerald", label: "Emerald", swatch: "bg-emerald-600" },
  amber: { id: "amber", label: "Amber", swatch: "bg-amber-700" },
  rose: { id: "rose", label: "Rose", swatch: "bg-rose-600" },
  slate: { id: "slate", label: "Slate", swatch: "bg-slate-600" },
};

export const DEFAULT_ACCENT: AccentId = "blue";

export const ACCENT_LIST: Accent[] = Object.values(ACCENTS);

export type ClassIconId =
  | "grid"
  | "book"
  | "calculator"
  | "flask"
  | "atom"
  | "dna"
  | "globe"
  | "landmark"
  | "languages"
  | "palette"
  | "music"
  | "code";

/** Subject glyphs, one weight and one size — never a logo per class. */
export const CLASS_ICONS: { id: ClassIconId; label: string; icon: LucideIcon }[] = [
  { id: "grid", label: "General", icon: LayoutGrid },
  { id: "book", label: "Literature", icon: BookOpen },
  { id: "calculator", label: "Mathematics", icon: Calculator },
  { id: "flask", label: "Chemistry", icon: FlaskConical },
  { id: "atom", label: "Physics", icon: Atom },
  { id: "dna", label: "Biology", icon: Dna },
  { id: "globe", label: "Geography", icon: Globe2 },
  { id: "landmark", label: "History", icon: Landmark },
  { id: "languages", label: "Languages", icon: Languages },
  { id: "palette", label: "Art", icon: Palette },
  { id: "music", label: "Music", icon: Music },
  { id: "code", label: "Computing", icon: Code2 },
];

export function accentOf(id?: AccentId | null): Accent {
  return ACCENTS[id ?? DEFAULT_ACCENT] ?? ACCENTS[DEFAULT_ACCENT];
}

/** A fresh account gets a colour rather than picking one — see `personAccent`. */
export function randomAccent(): AccentId {
  return ACCENT_LIST[Math.floor(Math.random() * ACCENT_LIST.length)].id;
}

/**
 * Someone's own colour, which is theirs and never the class's. Accounts made
 * before the setting existed — and the seeded classmates — have none stored, so
 * one is derived from the id: still effectively random, but the same on every
 * render instead of flickering.
 */
export function personAccent(userId: string, stored?: AccentId | null): AccentId {
  if (stored) return stored;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return ACCENT_LIST[hash % ACCENT_LIST.length].id;
}

/**
 * The glyph for a class. With none chosen the old role-based default stands —
 * a grid for a class you teach, a cap for one you sit in — so nothing on the
 * dashboard moves until a teacher actually picks something.
 */
export function classIcon(
  id?: ClassIconId | null,
  role: "teacher" | "student" = "teacher"
): LucideIcon {
  const found = id ? CLASS_ICONS.find((entry) => entry.id === id) : undefined;
  if (found) return found.icon;
  return role === "student" ? GraduationCap : LayoutGrid;
}
