"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { finishGoogleSignIn } from "@/lib/auth-client";

/** Where "Continue with Google" lands: finish signing in, then the dashboard. */
export default function GoogleCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const failure = new URLSearchParams(window.location.search).get("error");
    if (failure) {
      setError(
        failure === "cancelled"
          ? "Google sign-in was cancelled."
          : "We couldn't sign you in with Google. Try again, or use your email."
      );
      return;
    }
    finishGoogleSignIn()
      .then(() => router.replace("/dashboard"))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not sign in with Google"));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      {error ? (
        <div className="max-w-sm text-center space-y-4">
          <p className="text-[15px] text-slate-700 dark:text-slate-200">{error}</p>
          <Link href="/?auth=login" className="btn btn-md btn-secondary">
            Back to sign in
          </Link>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-[15px] text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
          Signing you in…
        </p>
      )}
    </div>
  );
}
