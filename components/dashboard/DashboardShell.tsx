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
    <div className="min-h-screen flex flex-col">
      <AppNavbar
        // Wordmark hides on a phone — with the capsule beside it, it wraps.
        left={<Logo href="/dashboard" textClassName="text-sm hidden sm:inline" />}
        center={
          <span data-tour="mode-switch" className="inline-flex">
          <NavCapsule
            tabs={[
              {
                id: "teaching",
                label: "Teaching",
                tourId: "mode-teaching",
                onClick: () => onModeChange("teaching"),
              },
              {
                id: "enrolled",
                label: "Enrolled",
                tourId: "mode-enrolled",
                onClick: () => onModeChange("enrolled"),
              },
            ]}
            activeId={mode}
          />
          </span>
        }
        right={
          <>
            <ThemeToggle />
            <ProfileMenu />
          </>
        }
      />
      <main className="page-in flex-1 max-w-4xl mx-auto w-full px-5 sm:px-6 py-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
