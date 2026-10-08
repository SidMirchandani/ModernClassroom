"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { exitDemoMode, isDemoMode } from "@/lib/demo-seed";

/**
 * A way out of the demo that is always on screen. The demo notice has an
 * "Exit demo" link too, but it can be dismissed — and once it was, the only
 * way out was "Log out" in the profile menu, which nobody reads as "leave the
 * demo". Hidden on a phone, where the bar has no room; there the profile menu
 * carries the same action under the same name.
 */
export function ExitDemoButton() {
  const router = useRouter();
  const [demo, setDemo] = useState(false);

  useEffect(() => setDemo(isDemoMode()), []);
  if (!demo) return null;

  return (
    <button
      type="button"
      onClick={() => {
        exitDemoMode();
        router.replace("/");
      }}
      className="hidden sm:inline-flex btn btn-sm btn-secondary"
    >
      <LogOut className="w-3.5 h-3.5" />
      Exit demo
    </button>
  );
}
