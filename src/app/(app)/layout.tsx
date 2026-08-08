import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/server/auth/dal";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <AppShell user={user}>{children}</AppShell>;
}
