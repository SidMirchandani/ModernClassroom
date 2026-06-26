"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/lib/db/types";

type AuthMode = "login" | "signup";

interface AuthPanelProps {
  initialMode?: AuthMode;
  onSuccess?: () => void;
}

export function AuthPanel({ initialMode = "login", onSuccess }: AuthPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Login failed");
      } else {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, firstName, lastName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Signup failed");
      }

      onSuccess?.();
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <div className="w-full max-w-md" aria-hidden>
        <div className="h-7 w-40 rounded bg-slate-100 dark:bg-slate-800 animate-pulse mb-2" />
        <div className="h-4 w-56 rounded bg-slate-100 dark:bg-slate-800 animate-pulse mb-6" />
        <div className="space-y-4">
          <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
      </div>
    );
  }

  const heading =
    mode === "login"
      ? { title: "Welcome back", subtitle: "Log in with your email or username." }
      : {
          title: "Create your account",
          subtitle: "One account for every class you teach or join.",
        };

  return (
    <div className="w-full max-w-md">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
        {heading.title}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{heading.subtitle}</p>

      <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 p-1 mb-6">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-colors",
              mode === m
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "login" ? (
          <Field label="Email or username">
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={inputClass}
              placeholder="Email or username"
              required
              autoComplete="username"
            />
          </Field>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                  placeholder="First name"
                  required
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Last name">
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                  placeholder="Last name"
                  required
                  autoComplete="family-name"
                />
              </Field>
            </div>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="Email"
                required
                autoComplete="email"
              />
            </Field>
          </>
        )}

        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="Password"
            required
            minLength={mode === "signup" ? 6 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </Field>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
        Just browsing?{" "}
        <Link
          href="/demo/student"
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          Student demo
        </Link>
        {" · "}
        <Link
          href="/demo/teacher"
          className="text-violet-600 dark:text-violet-400 hover:underline font-medium"
        >
          Teacher demo
        </Link>
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400";

export type { PublicUser };
