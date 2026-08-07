"use client";

import { useCallback, useEffect, useState } from "react";
import { workoutLogs as seedLogs, type WorkoutLog } from "@/lib/mock-data";

const STORAGE_KEY = "gymlog:workoutLogs";

function readStored(): WorkoutLog[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkoutLog[]) : null;
  } catch {
    return null;
  }
}

function persist(logs: WorkoutLog[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

export function useWorkoutLogs() {
  const [logs, setLogs] = useState<WorkoutLog[]>(seedLogs);

  useEffect(() => {
    setLogs(readStored() ?? seedLogs);
  }, []);

  const addLog = useCallback((log: Omit<WorkoutLog, "id">) => {
    const newLog: WorkoutLog = { ...log, id: `wl-${Date.now()}` };
    setLogs((prev) => {
      const next = [newLog, ...prev];
      persist(next);
      return next;
    });
    return newLog;
  }, []);

  const updateLog = useCallback((id: string, patch: Omit<WorkoutLog, "id">) => {
    setLogs((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...patch, id } : l));
      persist(next);
      return next;
    });
  }, []);

  const deleteLog = useCallback((id: string) => {
    setLogs((prev) => {
      const next = prev.filter((l) => l.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const getLog = useCallback(
    (id: string) => logs.find((l) => l.id === id),
    [logs]
  );

  return { logs, addLog, updateLog, deleteLog, getLog };
}
