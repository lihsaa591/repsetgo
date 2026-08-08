import { AdminShell } from "@/components/layout/admin-shell";
import { requireAdmin } from "@/lib/server/auth/dal";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
