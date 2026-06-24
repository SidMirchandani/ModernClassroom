"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClassTeacherView } from "@/components/teacher/ClassTeacherView";
import { ClassStudentView } from "@/components/student/ClassStudentView";
import { Loader2 } from "lucide-react";
import type { PublicUser } from "@/lib/db/types";

export function ClassPageClient({ classId }: { classId: string }) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [role, setRole] = useState<"teacher" | "student" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (!meData.user) {
        router.replace("/?auth=login");
        return;
      }
      setUser(meData.user);

      const clsRes = await fetch(`/api/classes/${classId}`);
      if (!clsRes.ok) {
        router.replace("/dashboard");
        return;
      }
      const clsData = await clsRes.json();
      setRole(clsData.role);
      setLoading(false);
    }
    load();
  }, [classId, router]);

  if (loading || !user || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (role === "teacher") {
    return <ClassTeacherView classId={classId} />;
  }

  return (
    <ClassStudentView
      classId={classId}
      studentId={user.id}
      studentName={`${user.firstName} ${user.lastName}`}
      studentAvatar={user.firstName.charAt(0).toUpperCase()}
    />
  );
}
