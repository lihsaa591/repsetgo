import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { getCurrentUser, requireAdmin } from "@/lib/server/auth/dal";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const user = await getCurrentUser();
  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  return <AdminShell>{children}</AdminShell>;
}
