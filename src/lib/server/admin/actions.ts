"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { requireAdmin } from "@/lib/server/auth/dal";
import { workoutLogs } from "@/lib/server/workouts/schema";
import { customExercises } from "@/lib/server/exercises/schema";
import { appSettings } from "./schema";
import { canChangeRole, canModifyUser } from "./guards";
import { getAdminCount } from "./queries";
import { CreateUserSchema, type CreateUserFormState } from "./validation";

export async function setUserRole(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const session = await requireAdmin();

  const targetUserId = Number(formData.get("userId"));
  const newRole = formData.get("role");

  if (!Number.isInteger(targetUserId) || (newRole !== "admin" && newRole !== "user")) {
    return { error: "Invalid request." };
  }

  const check = canChangeRole(session.userId, targetUserId, newRole);
  if (!check.ok) {
    return { error: check.error };
  }

  await db.update(users).set({ role: newRole }).where(eq(users.id, targetUserId));
  revalidatePath("/admin");
  return undefined;
}

export async function setRegistrationsOpen(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  await requireAdmin();

  const registrationsOpen = formData.get("registrationsOpen") === "on";

  const [existing] = await db.select({ id: appSettings.id }).from(appSettings).limit(1);
  if (!existing) {
    return { error: "Settings row is missing — this shouldn't happen." };
  }

  await db
    .update(appSettings)
    .set({ registrationsOpen })
    .where(eq(appSettings.id, existing.id));

  revalidatePath("/admin/settings");
  return undefined;
}

export async function createUserAsAdmin(
  _prevState: CreateUserFormState,
  formData: FormData
): Promise<CreateUserFormState> {
  await requireAdmin();

  const validated = CreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, email, password, role } = validated.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    return { message: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ name, email, passwordHash, role });

  revalidatePath("/admin");
  return { success: true };
}

export async function setUserActive(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const session = await requireAdmin();

  const targetUserId = Number(formData.get("userId"));
  const isActive = formData.get("isActive") === "true";

  if (!Number.isInteger(targetUserId)) {
    return { error: "Invalid request." };
  }

  const [target] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!target) {
    return { error: "That user no longer exists." };
  }

  const adminCount = await getAdminCount();
  const check = canModifyUser(session.userId, targetUserId, target.role, adminCount);
  if (!check.ok) {
    return { error: check.error };
  }

  await db.update(users).set({ isActive }).where(eq(users.id, targetUserId));
  revalidatePath("/admin");
  return undefined;
}

export async function deleteUser(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const session = await requireAdmin();

  const targetUserId = Number(formData.get("userId"));

  if (!Number.isInteger(targetUserId)) {
    return { error: "Invalid request." };
  }

  const [target] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!target) {
    return { error: "That user no longer exists." };
  }

  const adminCount = await getAdminCount();
  const check = canModifyUser(session.userId, targetUserId, target.role, adminCount);
  if (!check.ok) {
    return { error: check.error };
  }

  // workout_logs -> exercise_logs -> sets cascade via their existing FK
  // cascade (see src/lib/server/workouts/schema.ts); custom_exercises has
  // no such cascade, so it's deleted explicitly here.
  await db.delete(workoutLogs).where(eq(workoutLogs.userId, targetUserId));
  await db.delete(customExercises).where(eq(customExercises.userId, targetUserId));
  await db.delete(users).where(eq(users.id, targetUserId));

  revalidatePath("/admin");
  return undefined;
}
