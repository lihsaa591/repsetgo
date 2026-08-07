"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Dumbbell,
  LayoutDashboard,
  History,
  PlusCircle,
  LogOut,
  ChevronsUpDown,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/log", label: "Log Set", icon: PlusCircle },
  { href: "/history", label: "History", icon: History },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    router.push("/");
  }

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-muted/30">
        <div className="flex items-center gap-2 px-6 py-5">
          <Dumbbell className="h-6 w-6" />
          <span className="text-lg font-semibold">RepSetGo</span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
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
        <DropdownMenu>
          <DropdownMenuTrigger className="mt-auto flex items-center gap-3 border-t px-6 py-4 text-left hover:bg-muted">
            <Avatar className="h-8 w-8">
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-sm">
              <p className="font-medium leading-none">Aashil</p>
              <p className="text-xs text-muted-foreground">Free plan</p>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem render={<Link href="/settings" />}>
              Account settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5" />
          <span className="font-semibold">RepSetGo</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="h-8 w-8">
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem render={<Link href="/settings" />}>
              Account settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t bg-background md:hidden">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
