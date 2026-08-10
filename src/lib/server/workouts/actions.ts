"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { verifySession } from "@/lib/server/auth/dal";
import { workoutLogs, exerciseLogs, sets } from "./schema";
import {
  parseWorkoutForm,
  type ParsedExercise,
  type WorkoutFormState,
} from "./validation";

export async function createWorkoutLog(
  _prevState: WorkoutFormState,
  formData: FormData
): Promise<WorkoutFormState> {
  const session = await verifySession();
  const result = parseWorkoutForm(formData);

  if (!result.ok) {
    return { error: result.error };
  }
  const parsed = result.data;

  const [log] = await db
    .insert(workoutLogs)
    .values({
      userId: session.userId,
      label: parsed.label,
      date: parsed.date,
      notes: parsed.notes,
    })
    .returning({ id: workoutLogs.id });

  await insertExercisesAndSets(log.id, parsed.exercises);

  revalidatePath("/history");
  revalidatePath("/dashboard");
  redirect("/history");
}

export async function updateWorkoutLog(
  id: number,
  _prevState: WorkoutFormState,
  formData: FormData
): Promise<WorkoutFormState> {
  const session = await verifySession();
  const result = parseWorkoutForm(formData);

  if (!result.ok) {
    return { error: result.error };
  }
  const parsed = result.data;

  const [existing] = await db
    .select({ id: workoutLogs.id })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, session.userId)));

  if (!existing) {
    return { error: "Workout not found." };
  }

  await db
    .update(workoutLogs)
    .set({ label: parsed.label, date: parsed.date, notes: parsed.notes })
    .where(eq(workoutLogs.id, id));

  // Simplest correct approach for an edit: replace all exercises/sets for this log.
  // exerciseLogs -> sets cascade delete (see schema.ts), so this is one statement.
  await db.delete(exerciseLogs).where(eq(exerciseLogs.workoutLogId, id));
  await insertExercisesAndSets(id, parsed.exercises);

  revalidatePath("/history");
  revalidatePath("/dashboard");
  redirect("/history");
}

export async function deleteWorkoutLog(id: number) {
  const session = await verifySession();

  const [existing] = await db
    .select({ id: workoutLogs.id })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, session.userId)));

  if (!existing) {
    return { error: "Workout not found." };
  }

  await db.delete(workoutLogs).where(eq(workoutLogs.id, id));
  revalidatePath("/history");
  revalidatePath("/dashboard");
}

async function insertExercisesAndSets(
  workoutLogId: number,
  exercises: ParsedExercise[]
) {
  for (const exercise of exercises) {
    const [exerciseLog] = await db
      .insert(exerciseLogs)
      .values({
        workoutLogId,
        exerciseName: exercise.exerciseName,
        order: exercise.order,
      })
      .returning({ id: exerciseLogs.id });

    if (exercise.setsList.length > 0) {
      await db.insert(sets).values(
        exercise.setsList.map((s) => ({
          exerciseLogId: exerciseLog.id,
          setNumber: s.setNumber,
          reps: s.reps,
          weight: String(s.weight),
          isDropset: s.isDropset,
        }))
      );
    }
  }
}
