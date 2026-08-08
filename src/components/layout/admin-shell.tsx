"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Users, Settings, ArrowLeft, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/server/auth/actions";

const navItems = [
  { href: "/admin", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-60 flex-col border-r bg-muted/30 md:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          <Dumbbell className="h-6 w-6" />
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold">RepSetGo</span>
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t px-3 py-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to app
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </form>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">RepSetGo</span>
            <span className="text-[10px] text-muted-foreground">Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-xs text-muted-foreground">
            Exit
          </Link>
          <form action={logout}>
            <button type="submit" className="text-xs text-destructive">
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 pt-16 md:pt-0">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
