"use client";

import type { PublicUser } from "./db/types";
import { randomAccent } from "./class-appearance";
import { isDemoMode, exitDemoMode } from "./demo-seed";
import { supabase } from "./supabase/client";
import { acceptInvites } from "./store/remote";
import { store, syncedStoreIfActive } from "./store";

/**
 * Accounts are Supabase Auth. The demo has no account — it is a local session
 * over a local store — so the two never meet: signing in leaves the demo, and
 * the demo never calls the server.
 */

function describe(err: { message: string } | null, fallback: string): string {
  const m = err?.message ?? "";
  if (/invalid login credentials/i.test(m)) return "Wrong email or password";
  if (/already registered|already exists/i.test(m)) return "That email already has an account";
  if (/password/i.test(m) && /6|short|weak/i.test(m)) return "Password must be at least 6 characters";
  if (/rate limit/i.test(m)) return "Too many attempts — wait a minute and try again";
  return m || fallback;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  return store.getCurrentUser();
}

export async function loginUser(identifier: string, password: string): Promise<PublicUser> {
  const email = identifier.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error("Sign in with your email address");
  }
  if (isDemoMode()) exitDemoMode();

  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(describe(error, "Could not sign in"));

  // Seats held for this address since before the account existed.
  await acceptInvites().catch(() => undefined);

  const user = await store.getCurrentUser();
  if (!user) throw new Error("Signed in, but the profile could not be loaded");
  return user;
}

export async function signupUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<PublicUser> {
  if (data.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  if (isDemoMode()) exitDemoMode();

  const { data: result, error } = await supabase().auth.signUp({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    options: {
      // The profile row is built from this by a database trigger. The colour
      // is assigned here so a new account arrives already wearing one.
      data: {
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        accent: randomAccent(),
      },
    },
  });
  if (error) throw new Error(describe(error, "Could not create the account"));
  if (!result.session) {
    // Only happens if email confirmation was turned back on in the dashboard.
    throw new Error("Check your email to confirm the account, then sign in");
  }

  await acceptInvites().catch(() => undefined);

  const user = await store.getCurrentUser();
  if (!user) throw new Error("Account created, but the profile could not be loaded");
  return user;
}

export async function logoutUser(): Promise<void> {
  if (isDemoMode()) {
    exitDemoMode();
    return;
  }
  await syncedStoreIfActive()?.forget();
  await supabase().auth.signOut();
}
