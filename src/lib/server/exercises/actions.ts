"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { verifySession } from "@/lib/server/auth/dal";
import { customExercises } from "./schema";
import { BASE_EXERCISE_CATALOG } from "./queries";

export async function addCustomExercise(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const isBase = BASE_EXERCISE_CATALOG.some(
    (n) => n.toLowerCase() === trimmed.toLowerCase()
  );
  if (isBase) return;

  const session = await verifySession();

  const [existing] = await db
    .select({ id: customExercises.id })
    .from(customExercises)
    .where(
      and(eq(customExercises.userId, session.userId), eq(customExercises.name, trimmed))
    );

  if (existing) return;

  // The read above is a fast path only — it's racy. The (user_id, name) unique
  // index is what actually guarantees no duplicates.
  await db
    .insert(customExercises)
    .values({ userId: session.userId, name: trimmed })
    .onConflictDoNothing({
      target: [customExercises.userId, customExercises.name],
    });

  // Without this the new exercise won't show in the picker until a hard reload.
  revalidatePath("/log");
}
