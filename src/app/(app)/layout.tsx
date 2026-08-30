import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/server/auth/dal";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  return <AppShell user={user}>{children}</AppShell>;
}
