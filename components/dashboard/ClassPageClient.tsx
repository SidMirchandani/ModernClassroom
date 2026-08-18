"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserInitials } from "@/lib/avatar";
import { ClassTeacherView } from "@/components/teacher/ClassTeacherView";
import { ClassStudentView } from "@/components/student/ClassStudentView";
import { Loader2 } from "lucide-react";
import type { PublicUser } from "@/lib/db/types";
import { getCurrentUser } from "@/lib/auth-client";
import { getClassDetail } from "@/lib/db/client";

export function ClassPageClient({ classId }: { classId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // A user can teach a class and sit in it. `?as=student` is how the Enrolled
  // tab asks for the student side of one they also teach.
  const requestedRole = searchParams.get("as") === "student" ? "student" : undefined;
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

    const detail = getClassDetail(classId, currentUser.id, requestedRole);
    if (!detail) {
      router.replace("/dashboard");
      return;
    }
    setRole(detail.role);
    setLoading(false);
  }, [classId, router, requestedRole]);

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
