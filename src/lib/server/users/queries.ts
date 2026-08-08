import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { users, type User } from "@/lib/server/auth/schema";

export async function getUserProfile(userId: number): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user ?? null;
}
