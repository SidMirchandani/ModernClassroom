import { DemoProvider } from "@/components/demo/DemoProvider";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <DemoProvider>{children}</DemoProvider>;
}
