import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { decrypt, type SessionPayload } from "./session";
import { db } from "@/lib/server/db";
import { users, type User } from "./schema";

/**
 * Every user column except `passwordHash`. `getCurrentUser`'s result is passed
 * to client components, so the hash must never be part of the selection.
 */
const safeUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  mustChangePassword: users.mustChangePassword,
  heightCm: users.heightCm,
  weightKg: users.weightKg,
  dob: users.dob,
  gender: users.gender,
  goal: users.goal,
  activityLevel: users.activityLevel,
  unitPreference: users.unitPreference,
  avatarUrl: users.avatarUrl,
  createdAt: users.createdAt,
} as const;

export type SafeUser = Omit<User, "passwordHash">;

export const verifySession = cache(async (): Promise<SessionPayload> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const session = await decrypt(token);

  if (!session) {
    redirect("/login");
  }

  return session;
});

export const getCurrentUser = cache(async (): Promise<SafeUser> => {
  const session = await verifySession();
  const [user] = await db
    .select(safeUserColumns)
    .from(users)
    .where(eq(users.id, session.userId));

  if (!user) {
    redirect("/login");
  }

  return user;
});

/**
 * Defense-in-depth for admin routes. `proxy.ts` already gates `/admin`, but
 * middleware is a single point of failure — the layout re-checks the role.
 */
export const requireAdmin = cache(async (): Promise<SessionPayload> => {
  const session = await verifySession();

  if (session.role !== "admin") {
    redirect("/dashboard");
  }

  return session;
});
