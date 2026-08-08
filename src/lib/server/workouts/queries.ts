import "server-only";
import { and, eq, desc } from "drizzle-orm";
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
    sets: { setNumber: number; reps: number; weight: number }[];
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

  return Promise.all(logs.map((log) => attachDetails(log)));
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
  return attachDetails(log);
}

async function attachDetails(log: {
  id: number;
  date: string;
  label: string;
  notes: string | null;
}): Promise<WorkoutLogWithDetails> {
  const exercises = await db
    .select()
    .from(exerciseLogs)
    .where(eq(exerciseLogs.workoutLogId, log.id))
    .orderBy(exerciseLogs.order);

  const exercisesWithSets = await Promise.all(
    exercises.map(async (ex) => {
      const exSets = await db
        .select()
        .from(sets)
        .where(eq(sets.exerciseLogId, ex.id))
        .orderBy(sets.setNumber);

      return {
        id: ex.id,
        exerciseName: ex.exerciseName,
        sets: exSets.map((s) => ({
          setNumber: s.setNumber,
          reps: s.reps,
          weight: Number(s.weight),
        })),
      };
    })
  );

  return {
    id: log.id,
    date: log.date,
    label: log.label,
    notes: log.notes,
    exercises: exercisesWithSets,
  };
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
