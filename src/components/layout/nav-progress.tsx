"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

type NavProgressContextValue = {
  report: (id: string, pending: boolean) => void;
};

const NavProgressContext = createContext<NavProgressContextValue | null>(null);

/**
 * Wraps the app shell. Renders a thin top-of-viewport progress bar that
 * lights up while any tracked nav link is navigating, and stays mounted
 * across route changes (it lives in the persistent layout, not a page).
 */
export function NavProgressProvider({ children }: { children: React.ReactNode }) {
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  const report = useCallback((id: string, pending: boolean) => {
    setPendingIds((prev) => {
      const isPending = prev.has(id);
      if (isPending === pending) return prev;
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  return (
    <NavProgressContext.Provider value={{ report }}>
      <NavProgressBar active={pendingIds.size > 0} />
      {children}
    </NavProgressContext.Provider>
  );
}

/**
 * Renders nothing — place as a child of a <Link>. Reads that link's
 * pending navigation state (via next/link's useLinkStatus) and reports it
 * up to the surrounding NavProgressProvider.
 */
export function NavProgressReporter({ id }: { id: string }) {
  const { pending } = useLinkStatus();
  const ctx = useContext(NavProgressContext);
  const reportedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (reportedRef.current === pending) return;
    reportedRef.current = pending;
    ctx?.report(id, pending);
  }, [pending, id, ctx]);

  useEffect(() => {
    return () => ctx?.report(id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function NavProgressBar({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);
  const [widthPercent, setWidthPercent] = useState(0);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setVisible(true);
      // Kick off the "still working" crawl on the next frame so the
      // width transition (not just the opacity) actually animates.
      requestAnimationFrame(() => setWidthPercent(85));
      return;
    }

    // Navigation finished: snap to 100%, then fade out and reset.
    setWidthPercent(100);
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setWidthPercent(0);
    }, 220);

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [active]);

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-x-0 top-0 z-[60] h-[3px] transition-[width,opacity] ease-out",
        active ? "duration-[4000ms]" : "duration-200",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{
        width: `${widthPercent}%`,
        // Fixed, punchy accent independent of the theme's muted --primary —
        // a progress bar needs to read clearly on both light and dark
        // backgrounds regardless of brand color.
        backgroundColor: "#3b82f6",
        boxShadow: "0 0 8px 1px rgba(59, 130, 246, 0.6)",
      }}
    />
  );
}
