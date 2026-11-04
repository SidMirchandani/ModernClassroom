"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { loginUser, signInWithGoogle, signupUser } from "@/lib/auth-client";

type AuthMode = "login" | "signup";

interface AuthPanelProps {
  initialMode?: AuthMode;
  onSuccess?: () => void;
}

export function AuthPanel({ initialMode = "login", onSuccess }: AuthPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
        await loginUser(identifier, password);
      } else {
        await signupUser({ email, password, firstName, lastName });
      }

      onSuccess?.();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    setError("");
    // The browser is on its way to Google; the spinner stays until it leaves.
    setGoogleLoading(true);
    signInWithGoogle();
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
      ? { title: "Welcome Back", subtitle: "Log in with Google or your email." }
      : {
          title: "Create Your Account",
          subtitle: "Use an email that is not already registered — one account per email.",
        };

  return (
    <div className="w-full max-w-md">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
        {heading.title}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{heading.subtitle}</p>

      <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 p-1 mb-6">
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
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            {m === "login" ? "Log In" : "Sign Up"}
          </button>
        ))}
      </div>

      {/* Logging in and signing up are the same button: a first visit makes the account. */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading || loading}
        aria-busy={googleLoading}
        className="btn btn-lg btn-secondary w-full"
      >
        {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleMark />}
        Continue with Google
      </button>

      <div className="flex items-center gap-3 my-5" aria-hidden>
        <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
        <span className="text-xs text-slate-500 dark:text-slate-400">
          or {mode === "login" ? "log in" : "sign up"} with email
        </span>
        <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "login" ? (
          <Field label="Email">
            <input
              type="email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={inputClass}
              placeholder="Email"
              required
              autoComplete="email"
            />
          </Field>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name">
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
              <Field label="Last Name">
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
          <p className="text-sm text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="btn btn-lg btn-primary w-full"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === "login" ? "Log In" : "Create Account"}
        </button>
      </form>

      <p className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
        Just browsing?{" "}
        <Link
          href="/demo"
          className="text-primary dark:text-primary-glow hover:underline font-medium"
        >
          Watch a demo
        </Link>
      </p>
    </div>
  );
}

/** Google's "G", in its own colours, as their sign-in guidelines ask. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
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
  "w-full px-3 h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

