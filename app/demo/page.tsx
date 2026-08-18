"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { seedDemo } from "@/lib/demo-seed";

/**
 * The only demo entry point. It seeds the real store with one account that both
 * teaches and sits in three courses from the timeline sheet, eight classmates,
 * and their progress — then drops you into the actual product. There is no
 * separate demo UI to drift out of sync.
 */
export default function DemoPage() {
  const router = useRouter();

  useEffect(() => {
    seedDemo();
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Setting up the demo classroom…
      </p>
    </div>
  );
}
