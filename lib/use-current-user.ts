"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "./auth-client";
import { isDemoMode } from "./demo-seed";
import { STORE_CHANGED_EVENT } from "./store";
import { supabase, supabaseConfigured } from "./supabase/client";
import type { PublicUser } from "./db/types";

/**
 * The signed-in user, kept current. Reading once on mount is not enough — you
 * can change your own colour from the profile menu while your name sits in the
 * navbar of the page behind it, and that name has to follow. Every change to
 * the store announces itself, and so does Supabase Auth, so re-reading on both
 * is simple and complete.
 */
export function useCurrentUser(): PublicUser | null {
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    let alive = true;
    const read = () => {
      getCurrentUser()
        .then((u) => alive && setUser(u))
        .catch(() => alive && setUser(null));
    };
    read();
    window.addEventListener(STORE_CHANGED_EVENT, read);

    let unsubscribe = () => {};
    if (!isDemoMode() && supabaseConfigured()) {
      const { data } = supabase().auth.onAuthStateChange(() => read());
      unsubscribe = () => data.subscription.unsubscribe();
    }

    return () => {
      alive = false;
      window.removeEventListener(STORE_CHANGED_EVENT, read);
      unsubscribe();
    };
  }, []);

  return user;
}
