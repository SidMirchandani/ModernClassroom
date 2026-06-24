import { DemoSubunitEditor } from "@/components/teacher/DemoSubunitEditor";

export default async function DemoSubunitPage({
  params,
}: {
  params: Promise<{ subunitId: string }>;
}) {
  const { subunitId } = await params;
  return <DemoSubunitEditor subunitId={subunitId} />;
}
