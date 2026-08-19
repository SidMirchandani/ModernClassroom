"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserInitials } from "@/lib/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Popover } from "@/components/Popover";
import { logoutUser } from "@/lib/auth-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { setUserAccent } from "@/lib/db/client";
import { ACCENT_LIST, personAccent, type AccentId } from "@/lib/class-appearance";

export function ProfileMenu() {
  const router = useRouter();
  const user = useCurrentUser();

  function handleLogout() {
    logoutUser();
    router.push("/");
  }

  function chooseAccent(accent: AccentId) {
    if (!user) return;
    // No local copy to keep in step: the write announces itself and every
    // place showing this user — here, the name in the navbar — re-reads.
    setUserAccent(user.id, accent);
  }

  if (!user) return null;

  const initials = getUserInitials(user.firstName, user.lastName);
  const accent = personAccent(user.id, user.accent);

  return (
    <Popover
      width={288}
      align="right"
      triggerTitle="Profile and settings"
      triggerAccent={accent}
      triggerClassName={(open) =>
        cn(
          "rounded-full transition-opacity",
          open
            ? "ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-950"
            : "hover:opacity-90"
        )
      }
      label={<UserAvatar initials={initials} size="md" bordered accent={accent} />}
      panelClassName="overflow-hidden"
    >
      {(close) => (
        <>
          <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <UserAvatar initials={initials} size="lg" accent={accent} />
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

            {/* Your colour, not the class's — the swatches are the whole
                control, so they carry no labels. */}
            <div>
              <p className="eyebrow-muted">Color</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                {ACCENT_LIST.map((option) => {
                  const active = option.id === accent;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => chooseAccent(option.id)}
                      aria-label={option.label}
                      aria-pressed={active}
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110",
                        active &&
                          "ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 ring-offset-white dark:ring-offset-slate-900"
                      )}
                    >
                      <span className={cn("w-5 h-5 rounded-full", option.swatch)} />
                    </button>
                  );
                })}
              </div>
            </div>
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
