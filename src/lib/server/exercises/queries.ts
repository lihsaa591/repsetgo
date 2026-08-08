import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { customExercises } from "./schema";

export const BASE_EXERCISE_CATALOG = [
  // Chest
  "Bench Press",
  "Incline Bench Press",
  "Decline Bench Press",
  "Incline Dumbbell Press",
  "Dumbbell Bench Press",
  "Chest Fly",
  "Cable Crossover",
  "Push Up",
  "Dips",

  // Back
  "Deadlift",
  "Barbell Row",
  "Dumbbell Row",
  "T-Bar Row",
  "Seated Cable Row",
  "Lat Pulldown",
  "Pull Up",
  "Chin Up",
  "Face Pull",
  "Hyperextension",

  // Shoulders
  "Overhead Press",
  "Seated Dumbbell Shoulder Press",
  "Arnold Press",
  "Lateral Raise",
  "Front Raise",
  "Rear Delt Fly",
  "Shrug",

  // Arms
  "Bicep Curl",
  "Hammer Curl",
  "Preacher Curl",
  "Cable Curl",
  "Tricep Pushdown",
  "Skull Crusher",
  "Overhead Tricep Extension",
  "Close-Grip Bench Press",

  // Legs
  "Barbell Squat",
  "Front Squat",
  "Leg Press",
  "Romanian Deadlift",
  "Leg Curl",
  "Leg Extension",
  "Walking Lunge",
  "Bulgarian Split Squat",
  "Hip Thrust",
  "Calf Raise",

  // Core
  "Plank",
  "Hanging Leg Raise",
  "Cable Crunch",
  "Russian Twist",
  "Ab Wheel Rollout",

  // Cardio / conditioning
  "Treadmill Run",
  "Rowing Machine",
  "Cycling",
  "Jump Rope",
  "Burpee",
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
