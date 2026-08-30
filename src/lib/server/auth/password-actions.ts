"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { users } from "./schema";
import { verifySession } from "./dal";
import { createSessionCookie } from "./session";
import { ChangePasswordSchema, type ChangePasswordFormState } from "./validation";

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
