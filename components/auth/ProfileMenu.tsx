"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserInitials } from "@/lib/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Popover } from "@/components/Popover";
import { getCurrentUser, logoutUser } from "@/lib/auth-client";
import type { PublicUser } from "@/lib/db/types";

export function ProfileMenu() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  function handleLogout() {
    logoutUser();
    router.push("/");
  }

  if (!user) return null;

  const initials = getUserInitials(user.firstName, user.lastName);

  return (
    <Popover
      width={288}
      align="right"
      triggerTitle="Profile and settings"
      triggerClassName={(open) =>
        cn(
          "rounded-full transition-opacity",
          open
            ? "ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
            : "hover:opacity-90"
        )
      }
      label={<UserAvatar initials={initials} size="md" bordered />}
      panelClassName="overflow-hidden"
    >
      {(close) => (
        <>
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
              onClick={() => {
                close();
                handleLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow-muted">
        {label}
      </p>
      <p className="text-slate-700 dark:text-slate-300 truncate">{value}</p>
    </div>
  );
}
