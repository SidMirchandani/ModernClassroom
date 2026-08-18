import { DemoNotice } from "@/components/demo/DemoNotice";
import { DemoTour } from "@/components/tour/DemoTour";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DemoNotice />
      <DemoTour />
      {children}
    </>
  );
}
