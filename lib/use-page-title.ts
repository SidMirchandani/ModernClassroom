"use client";

import { useEffect } from "react";
import { SITE } from "./site";

/**
 * The browser tab's title, read from the most specific place outwards —
 * "Curriculum for Algebra II, Honors - Teaching - Modern Classroom" — so a
 * row of tabs can be told apart by their first words.
 *
 * Set from the page rather than through Next's metadata because these pages
 * are client components whose names (a class's, a subunit's) only arrive once
 * the store has loaded. Parts not known yet are skipped, so a class still
 * loading reads "Teaching - Modern Classroom" rather than "undefined - …".
 */
export function pageTitle(...parts: (string | null | undefined | false)[]): string {
  return [...parts.filter((p): p is string => Boolean(p && p.trim())), SITE.name].join(" - ");
}

export function usePageTitle(...parts: (string | null | undefined | false)[]): void {
  const title = pageTitle(...parts);
  useEffect(() => {
    document.title = title;
    // Next streams the route's metadata in after the page has hydrated, and
    // its <title> lands after this effect has run — so the title is held
    // for as long as the page is open, not just set once. Setting it changes
    // the <title> too, which this sees as already right: no loop.
    const hold = new MutationObserver(() => {
      if (document.title !== title) document.title = title;
    });
    hold.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => hold.disconnect();
  }, [title]);
}
