import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { workoutLogs } from "@/lib/server/workouts/schema";
import { appSettings } from "./schema";

export type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  joinedAt: string;
  totalLogs: number;
  lastLogDate: string | null;
};

export async function getAllUsersWithStats(): Promise<AdminUserRow[]> {
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users);

  const stats = await db
    .select({
      userId: workoutLogs.userId,
      totalLogs: sql<number>`count(*)::int`.as("total_logs"),
      lastLogDate: sql<string>`max(${workoutLogs.date})`.as("last_log_date"),
    })
    .from(workoutLogs)
    .groupBy(workoutLogs.userId);

  const statsByUserId = new Map(stats.map((s) => [s.userId, s]));

  return allUsers.map((user) => {
    const userStats = statsByUserId.get(user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      joinedAt: user.createdAt.toISOString().slice(0, 10),
      totalLogs: userStats?.totalLogs ?? 0,
      lastLogDate: userStats?.lastLogDate ?? null,
    };
  });
}

export async function getAppSettings(): Promise<{ registrationsOpen: boolean }> {
  const [settings] = await db.select().from(appSettings).limit(1);
  return { registrationsOpen: settings?.registrationsOpen ?? true };
}
