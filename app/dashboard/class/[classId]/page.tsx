import { ClassPageClient } from "@/components/dashboard/ClassPageClient";

export default async function ClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return <ClassPageClient classId={classId} />;
}
