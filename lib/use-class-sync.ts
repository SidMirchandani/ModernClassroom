"use client";

import { useEffect, useRef } from "react";
import { STORE_CHANGED_EVENT } from "./store";
import { watchClass, watchForeground } from "./store/live";

/**
 * Keep one class screen current. Three things can mean "read this again":
 * someone else changed the class, this tab came back to the foreground, or a
 * write landed locally — including one that was queued while offline and has
 * just reached the server.
 *
 * They are collapsed into a single trailing call, because three reasons
 * arriving at once still only warrant one read.
 */
export function useClassSync(classId: string, reload: () => void) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const nudge = () => {
      if (!alive) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => alive && reloadRef.current(), 250);
    };

    const stopLive = watchClass(classId, nudge);
    const stopForeground = watchForeground(nudge);
    window.addEventListener(STORE_CHANGED_EVENT, nudge);

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      stopLive();
      stopForeground();
      window.removeEventListener(STORE_CHANGED_EVENT, nudge);
    };
  }, [classId]);
}
