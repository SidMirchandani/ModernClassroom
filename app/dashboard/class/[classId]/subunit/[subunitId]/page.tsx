import { SubunitEditor } from "@/components/teacher/SubunitEditor";

export default async function SubunitPage({
  params,
}: {
  params: Promise<{ classId: string; subunitId: string }>;
}) {
  const { classId, subunitId } = await params;
  return <SubunitEditor classId={classId} subunitId={subunitId} />;
}
