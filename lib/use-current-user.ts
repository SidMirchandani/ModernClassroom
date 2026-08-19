"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "./auth-client";
import { DB_WRITE_EVENT } from "./db/client";
import type { PublicUser } from "./db/types";

/**
 * The signed-in user, kept current. Reading once on mount is not enough — you
 * can change your own colour from the profile menu while your name sits in the
 * navbar of the page behind it, and that name has to follow. Every write to the
 * store announces itself, so re-reading on that is both simple and complete.
 */
export function useCurrentUser(): PublicUser | null {
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    const read = () => setUser(getCurrentUser());
    read();
    window.addEventListener(DB_WRITE_EVENT, read);
    return () => window.removeEventListener(DB_WRITE_EVENT, read);
  }, []);

  return user;
}
