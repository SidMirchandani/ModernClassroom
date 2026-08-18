import { DemoNotice } from "@/components/demo/DemoNotice";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DemoNotice />
      {children}
    </>
  );
}
