"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { verifySession } from "@/lib/server/auth/dal";
import { workoutLogs, exerciseLogs, sets } from "./schema";

type ParsedExercise = {
  exerciseName: string;
  order: number;
  setsList: { setNumber: number; reps: number; weight: number }[];
};

function parseWorkoutForm(formData: FormData): {
  label: string;
  date: string;
  notes: string | null;
  exercises: ParsedExercise[];
} {
  const exerciseCount = Number(formData.get("exerciseCount") ?? 0);
  const exercises: ParsedExercise[] = [];

  for (let i = 0; i < exerciseCount; i++) {
    const exerciseName = String(formData.get(`exercise-${i}-name`) ?? "").trim();
    if (!exerciseName) continue;

    const setCount = Number(formData.get(`exercise-${i}-setCount`) ?? 0);
    const setsList = [];
    for (let s = 0; s < setCount; s++) {
      setsList.push({
        setNumber: s + 1,
        reps: Number(formData.get(`exercise-${i}-set-${s}-reps`) ?? 0),
        weight: Number(formData.get(`exercise-${i}-set-${s}-weight`) ?? 0),
      });
    }

    exercises.push({ exerciseName, order: i, setsList });
  }

  return {
    label: String(formData.get("label") ?? "").trim(),
    date: String(formData.get("date") ?? ""),
    notes: String(formData.get("notes") ?? "").trim() || null,
    exercises,
  };
}

export async function createWorkoutLog(formData: FormData) {
  const session = await verifySession();
  const parsed = parseWorkoutForm(formData);

  if (!parsed.label || !parsed.date || parsed.exercises.length === 0) {
    return { error: "Add a workout name, date, and at least one exercise." };
  }

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

export async function updateWorkoutLog(id: number, formData: FormData) {
  const session = await verifySession();
  const parsed = parseWorkoutForm(formData);

  if (!parsed.label || !parsed.date || parsed.exercises.length === 0) {
    return { error: "Add a workout name, date, and at least one exercise." };
  }

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
        }))
      );
    }
  }
}
