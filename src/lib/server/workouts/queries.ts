import "server-only";
import { and, eq, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { workoutLogs, exerciseLogs, sets } from "./schema";
import { suggestNextWorkout, type Suggestion } from "./suggest";

export type WorkoutLogWithDetails = {
  id: number;
  date: string;
  label: string;
  notes: string | null;
  exercises: {
    id: number;
    exerciseName: string;
    sets: {
      setNumber: number;
      reps: number;
      weight: number;
      isDropset: boolean;
      note: string | null;
    }[];
  }[];
};

export async function getWorkoutLogsForUser(
  userId: number
): Promise<WorkoutLogWithDetails[]> {
  const logs = await db
    .select()
    .from(workoutLogs)
    .where(eq(workoutLogs.userId, userId))
    .orderBy(desc(workoutLogs.date));

  return attachDetailsBatch(logs);
}

export async function getWorkoutLogById(
  id: number,
  userId: number
): Promise<WorkoutLogWithDetails | null> {
  const [log] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId)));

  if (!log) return null;
  const [withDetails] = await attachDetailsBatch([log]);
  return withDetails;
}

// Fetches exercises for every log, then sets for every exercise, in two
// queries total regardless of how many logs/exercises there are — instead
// of one query per log plus one query per exercise (an N+1 pattern that
// scales linearly and, measured against the real DB, took ~29s for a
// 50-log account versus low milliseconds with this batched version).
async function attachDetailsBatch(
  logs: { id: number; date: string; label: string; notes: string | null }[]
): Promise<WorkoutLogWithDetails[]> {
  if (logs.length === 0) return [];

  const logIds = logs.map((l) => l.id);
  const allExercises = await db
    .select()
    .from(exerciseLogs)
    .where(inArray(exerciseLogs.workoutLogId, logIds))
    .orderBy(exerciseLogs.order);

  const exerciseIds = allExercises.map((ex) => ex.id);
  const allSets = exerciseIds.length
    ? await db
        .select()
        .from(sets)
        .where(inArray(sets.exerciseLogId, exerciseIds))
        .orderBy(sets.setNumber)
    : [];

  const setsByExerciseId = new Map<number, typeof allSets>();
  for (const s of allSets) {
    const existing = setsByExerciseId.get(s.exerciseLogId);
    if (existing) existing.push(s);
    else setsByExerciseId.set(s.exerciseLogId, [s]);
  }

  const exercisesByLogId = new Map<number, WorkoutLogWithDetails["exercises"]>();
  for (const ex of allExercises) {
    const exSets = setsByExerciseId.get(ex.id) ?? [];
    const entry = {
      id: ex.id,
      exerciseName: ex.exerciseName,
      sets: exSets.map((s) => ({
        setNumber: s.setNumber,
        reps: s.reps,
        weight: Number(s.weight),
        isDropset: s.isDropset,
        note: s.note,
      })),
    };
    const existing = exercisesByLogId.get(ex.workoutLogId);
    if (existing) existing.push(entry);
    else exercisesByLogId.set(ex.workoutLogId, [entry]);
  }

  return logs.map((log) => ({
    id: log.id,
    date: log.date,
    label: log.label,
    notes: log.notes,
    exercises: exercisesByLogId.get(log.id) ?? [],
  }));
}

/**
 * Pure — callers pass logs they have already fetched so the dashboard doesn't
 * run the whole log/exercise/set query tree twice.
 */
export function getSuggestionFromLogs(logs: WorkoutLogWithDetails[]): Suggestion {
  return suggestNextWorkout(
    logs.map((log) => ({
      label: log.label,
      date: log.date,
      exerciseNames: log.exercises.map((e) => e.exerciseName),
    }))
  );
}
