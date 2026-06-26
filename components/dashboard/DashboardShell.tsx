"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { Logo } from "@/components/Logo";
import { NavCapsule } from "@/components/NavCapsule";
import { AppNavbar } from "@/components/AppNavbar";

export type DashboardMode = "teaching" | "enrolled";

interface DashboardShellProps {
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
  children: React.ReactNode;
}

export function DashboardShell({ mode, onModeChange, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0a0a0e]">
      <AppNavbar
        left={<Logo href="/dashboard" textClassName="text-sm" />}
        center={
          <NavCapsule
            tabs={[
              {
                id: "teaching",
                label: "Teaching",
                onClick: () => onModeChange("teaching"),
              },
              {
                id: "enrolled",
                label: "Enrolled",
                onClick: () => onModeChange("enrolled"),
              },
            ]}
            activeId={mode}
          />
        }
        right={
          <>
            <ThemeToggle />
            <ProfileMenu />
          </>
        }
      />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">{children}</main>
    </div>
  );
}
