"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Both icons always render; CSS (the `dark:` variant) decides which is
// visible based on the live .dark class on <html>. This must not depend on
// reading document/localStorage during render — ThemeScript (root layout
// head) already applies the class before paint, and computing the icon
// from that at render time would make the server (always "light") and the
// client's first paint (whatever ThemeScript picked) disagree, triggering
// a hydration mismatch that discards and rebuilds the whole tree.
function toggleTheme() {
  const next = document.documentElement.classList.contains("dark")
    ? "light"
    : "dark";
  localStorage.setItem("theme", next);
  document.documentElement.classList.toggle("dark", next === "dark");
}

export function ThemeToggle() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
    >
      <Moon className="h-4 w-4 dark:hidden" />
      <Sun className="hidden h-4 w-4 dark:block" />
    </Button>
  );
}
