import { AdminShell } from "@/components/layout/admin-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
