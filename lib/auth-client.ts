"use client";

import type { PublicUser } from "./db/types";
import { randomAccent } from "./class-appearance";
import { supabase, supabaseConfigured } from "./supabase/client";
import { acceptInvites } from "./store/remote";
import { store, syncedStoreIfActive } from "./store";

/** Accounts are Supabase Auth. */

function describe(err: { message: string } | null, fallback: string): string {
  const m = err?.message ?? "";
  if (/invalid login credentials/i.test(m)) return "Wrong email or password";
  if (/already registered|already exists/i.test(m)) return "That email already has an account";
  if (/password/i.test(m) && /6|short|weak/i.test(m)) return "Password must be at least 6 characters";
  if (/rate limit/i.test(m)) return "Too many attempts — wait a minute and try again";
  return m || fallback;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  // Keys the removed clickable demo left in some browsers; nothing reads them now.
  if (typeof localStorage !== "undefined") {
    for (const key of [
      "modern-classroom-demo",
      "modern-classroom-demo-notice",
      "modern-classroom-db",
      "modern-classroom-session",
    ]) {
      localStorage.removeItem(key);
    }
  }
  // No Supabase settings means nobody can be signed in, which is an answer
  // rather than an error: the pages asking this send the visitor to the landing.
  if (!supabaseConfigured()) return null;
  return store.getCurrentUser();
}

export async function loginUser(identifier: string, password: string): Promise<PublicUser> {
  const email = identifier.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error("Sign in with your email address");
  }

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

/**
 * "Continue with Google", for logging in and signing up alike: Supabase makes
 * the account on a first visit, and the profile trigger names it from what
 * Google sends.
 *
 * It goes through our own `/api/google/signin` rather than Supabase's hosted
 * page, so Google's account chooser names this site and not `….supabase.co`.
 * That route sets the session; `/auth/callback` finishes.
 *
 * It signs in and nothing more — connecting Google Classroom is its own step,
 * so a plain sign-in never asks for access to anyone's classes.
 */
export function signInWithGoogle(): void {
  window.location.assign("/api/google/signin");
}

/** The far side of Google: the session is already set; the usual sign-in steps. */
export async function finishGoogleSignIn(): Promise<PublicUser> {
  const {
    data: { session },
  } = await supabase().auth.getSession();
  if (!session) throw new Error("Could not sign in with Google");

  await acceptInvites().catch(() => undefined);

  const user = await store.getCurrentUser();
  if (!user) throw new Error("Signed in, but the profile could not be loaded");
  return user;
}

/**
 * Close the account for good. The server erases everything in one transaction;
 * this then drops the local session so the app cannot keep rendering from a
 * cache of things that no longer exist.
 */
export async function deleteAccount(): Promise<void> {
  await store.deleteAccount();
  await supabase().auth.signOut();
}

export async function logoutUser(): Promise<void> {
  await syncedStoreIfActive()?.forget();
  await supabase().auth.signOut();
}
