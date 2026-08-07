"use server";

import { eq, and } from "drizzle-orm";
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

  await db.insert(customExercises).values({ userId: session.userId, name: trimmed });
}
