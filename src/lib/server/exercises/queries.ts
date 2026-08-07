import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { customExercises } from "./schema";

export const BASE_EXERCISE_CATALOG = [
  "Bench Press",
  "Incline Dumbbell Press",
  "Barbell Squat",
  "Deadlift",
  "Overhead Press",
  "Barbell Row",
  "Pull Up",
  "Bicep Curl",
  "Tricep Pushdown",
  "Lat Pulldown",
];

export async function getExerciseOptionsForUser(userId: number): Promise<string[]> {
  const rows = await db
    .select({ name: customExercises.name })
    .from(customExercises)
    .where(eq(customExercises.userId, userId));

  const custom = rows.map((r) => r.name);
  const seen = new Set(BASE_EXERCISE_CATALOG.map((n) => n.toLowerCase()));
  const merged = [...BASE_EXERCISE_CATALOG];
  for (const name of custom) {
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      merged.push(name);
    }
  }
  return merged;
}
