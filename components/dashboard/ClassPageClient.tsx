"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserInitials } from "@/lib/avatar";
import { ClassTeacherView } from "@/components/teacher/ClassTeacherView";
import { ClassStudentView } from "@/components/student/ClassStudentView";
import { Loader2 } from "lucide-react";
import type { PublicUser } from "@/lib/db/types";
import { getCurrentUser } from "@/lib/auth-client";
import { getClassDetail } from "@/lib/db/client";

export function ClassPageClient({ classId }: { classId: string }) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [role, setRole] = useState<"teacher" | "student" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.replace("/?auth=login");
      return;
    }
    setUser(currentUser);

    const detail = getClassDetail(classId, currentUser.id);
    if (!detail) {
      router.replace("/dashboard");
      return;
    }
    setRole(detail.role);
    setLoading(false);
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
      studentAvatar={getUserInitials(user.firstName, user.lastName)}
    />
  );
}
