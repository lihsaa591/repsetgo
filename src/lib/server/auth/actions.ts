"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/server/db";
import { users } from "./schema";
import { createSessionCookie, deleteSessionCookie } from "./session";
import { SignupSchema, LoginSchema, type AuthFormState } from "./validation";
import { getAppSettings } from "@/lib/server/admin/queries";
import { checkRegistrationsOpen } from "@/lib/server/admin/guards";
import { sendWelcomeEmail } from "@/lib/server/email/send-welcome-email";

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const settings = await getAppSettings();
  const registrationCheck = checkRegistrationsOpen(settings);
  if (!registrationCheck.ok) {
    return { message: registrationCheck.error };
  }

  const validated = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, email, password } = validated.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    return { message: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash })
    .returning({ id: users.id, role: users.role });

  await createSessionCookie({ userId: user.id, role: user.role, mustChangePassword: false });
  after(() => sendWelcomeEmail(email, name));
  redirect("/dashboard");
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    return { message: "Invalid email or password." };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return { message: "Invalid email or password." };
  }

  if (!user.isActive) {
    return { message: "Your account has been deactivated. Contact an admin." };
  }

  const rememberMe = formData.get("rememberMe") === "on";
  await createSessionCookie(
    { userId: user.id, role: user.role, mustChangePassword: user.mustChangePassword },
    rememberMe
  );
  redirect("/dashboard");
}

export async function logout() {
  await deleteSessionCookie();
  redirect("/login");
}
