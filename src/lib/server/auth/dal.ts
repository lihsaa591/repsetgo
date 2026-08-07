import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { decrypt, type SessionPayload } from "./session";
import { db } from "@/lib/server/db";
import { users, type User } from "./schema";

export const verifySession = cache(async (): Promise<SessionPayload> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const session = await decrypt(token);

  if (!session) {
    redirect("/login");
  }

  return session;
});

export const getCurrentUser = cache(async (): Promise<User> => {
  const session = await verifySession();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));

  if (!user) {
    redirect("/login");
  }

  return user;
});
