"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserInitials } from "@/lib/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import type { PublicUser } from "@/lib/db/types";

export function ProfileMenu() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (!user) return null;

  const initials = getUserInitials(user.firstName, user.lastName);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "rounded-full transition-opacity",
          open ? "ring-2 ring-violet-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-950" : "hover:opacity-90"
        )}
        aria-label="Profile and settings"
        aria-expanded={open}
      >
        <UserAvatar initials={initials} size="md" bordered />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <UserAvatar initials={initials} size="lg" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  @{user.username}
                </p>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 space-y-2.5 text-sm">
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Username" value={user.username} />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 p-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600">
        {label}
      </p>
      <p className="text-slate-700 dark:text-slate-300 truncate">{value}</p>
    </div>
  );
}
