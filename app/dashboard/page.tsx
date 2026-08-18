import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default function DashboardPage() {
  // DashboardClient reads `?tab=`, which needs a Suspense boundary to prerender.
  return (
    <Suspense>
      <DashboardClient />
    </Suspense>
  );
}
