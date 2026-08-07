"use client";

import { useCallback, useEffect, useState } from "react";
import { exerciseCatalog } from "@/lib/mock-data";

const STORAGE_KEY = "gymlog:customExercises";

function readStored(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function mergeUnique(base: string[], extra: string[]) {
  const seen = new Set(base.map((n) => n.toLowerCase()));
  const merged = [...base];
  for (const name of extra) {
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      merged.push(name);
    }
  }
  return merged;
}

export function useExerciseOptions() {
  const [options, setOptions] = useState<string[]>(exerciseCatalog);

  useEffect(() => {
    setOptions(mergeUnique(exerciseCatalog, readStored()));
  }, []);

  const addCustomExercise = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setOptions((prev) => {
      if (prev.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const next = [...prev, trimmed];
      const custom = next.filter(
        (n) => !exerciseCatalog.some((c) => c.toLowerCase() === n.toLowerCase())
      );
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
      return next;
    });
  }, []);

  return { options, addCustomExercise };
}
