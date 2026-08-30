"use server";

import { and, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { requireAdmin } from "@/lib/server/auth/dal";
import { workoutLogs } from "@/lib/server/workouts/schema";
import { customExercises } from "@/lib/server/exercises/schema";
import { appSettings } from "./schema";
import { canChangeRole, canModifyUser } from "./guards";
import { notLastAdmin } from "./last-admin-guard";
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

export type ResetPasswordState = { error: string } | { tempPassword: string } | undefined;

function generateTempPassword(): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomBytes(9).toString("base64url");
    if (/[a-zA-Z]/.test(candidate) && /[0-9]/.test(candidate)) {
      return candidate;
    }
  }
  // Astronomically unlikely with a 12-character base64url string, but fall
  // back to a value guaranteed to satisfy the rule rather than loop forever.
  return `Aa1${randomBytes(9).toString("base64url")}`;
}

export async function resetUserPassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  await requireAdmin();

  const targetUserId = Number(formData.get("userId"));
  if (!Number.isInteger(targetUserId)) {
    return { error: "Invalid request." };
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!target) {
    return { error: "That user no longer exists." };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: true, passwordResetRequestedAt: null })
    .where(eq(users.id, targetUserId));

  revalidatePath("/admin");

  return { tempPassword };
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

  const updated = await db
    .update(users)
    .set({ isActive })
    .where(
      isActive
        ? eq(users.id, targetUserId)
        : and(eq(users.id, targetUserId), notLastAdmin(targetUserId))
    )
    .returning({ id: users.id });

  if (updated.length === 0) {
    // The row existed at the SELECT above, so a zero-row update means the
    // atomic guard fired: this would have deactivated the last admin.
    return { error: "You can't remove the last admin." };
  }

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
  //
  // neon-http has no interactive transactions (db.transaction() throws), but
  // db.batch() sends the statements as one atomic HTTP transaction, so the
  // deletes can no longer be left half-applied.
  const guard = notLastAdmin(targetUserId);
  const [, , deleted] = await db.batch([
    db
      .delete(workoutLogs)
      .where(and(eq(workoutLogs.userId, targetUserId), guard)),
    db
      .delete(customExercises)
      .where(and(eq(customExercises.userId, targetUserId), guard)),
    db
      .delete(users)
      .where(and(eq(users.id, targetUserId), guard))
      .returning({ id: users.id }),
  ]);

  if (deleted.length === 0) {
    // The row existed at the SELECT above, so a zero-row delete means the
    // atomic guard fired: this would have removed the last admin. The guard is
    // on all three statements, so nothing was deleted at all.
    return { error: "You can't remove the last admin." };
  }

  revalidatePath("/admin");
  return undefined;
}
