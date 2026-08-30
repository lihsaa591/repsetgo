"use server";

import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { users } from "./schema";
import { verifySession } from "./dal";
import { createSessionCookie } from "./session";
import {
  ChangePasswordSchema,
  type ChangePasswordFormState,
  RequestPasswordResetSchema,
  type RequestPasswordResetFormState,
} from "./validation";

export async function changePassword(
  _prevState: ChangePasswordFormState,
  formData: FormData
): Promise<ChangePasswordFormState> {
  const session = await verifySession();

  const validated = ChangePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const passwordHash = await bcrypt.hash(validated.data.password, 10);

  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(users.id, session.userId));

  await createSessionCookie({
    userId: session.userId,
    role: session.role,
    mustChangePassword: false,
  });

  const redirectTo = formData.get("redirectTo");
  if (typeof redirectTo === "string" && redirectTo.length > 0) {
    redirect(redirectTo);
  }

  return { success: true };
}

export async function requestPasswordReset(
  _prevState: RequestPasswordResetFormState,
  formData: FormData
): Promise<RequestPasswordResetFormState> {
  const validated = RequestPasswordResetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, validated.data.email.toLowerCase()));

  if (user) {
    await db
      .update(users)
      .set({ passwordResetRequestedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  // Same message whether or not the email matched an account — this must
  // never branch on `user` being found, or the form becomes a way to check
  // which emails are registered.
  return {
    message: "If that email is registered, an admin has been notified.",
  };
}
