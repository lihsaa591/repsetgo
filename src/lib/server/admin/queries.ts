import "server-only";
import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { workoutLogs } from "@/lib/server/workouts/schema";
import { customExercises } from "@/lib/server/exercises/schema";
import { appSettings } from "./schema";

export type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  isActive: boolean;
  joinedAt: string;
  totalLogs: number;
  lastLogDate: string | null;
  customExerciseCount: number;
  passwordResetRequestedAt: string | null;
};

export async function getAllUsersWithStats(): Promise<AdminUserRow[]> {
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      passwordResetRequestedAt: users.passwordResetRequestedAt,
    })
    .from(users);

  const logStats = await db
    .select({
      userId: workoutLogs.userId,
      totalLogs: sql<number>`count(*)::int`.as("total_logs"),
      lastLogDate: sql<string>`max(${workoutLogs.date})`.as("last_log_date"),
    })
    .from(workoutLogs)
    .groupBy(workoutLogs.userId);

  const exerciseStats = await db
    .select({
      userId: customExercises.userId,
      customExerciseCount: sql<number>`count(*)::int`.as("custom_exercise_count"),
    })
    .from(customExercises)
    .groupBy(customExercises.userId);

  const logStatsByUserId = new Map(logStats.map((s) => [s.userId, s]));
  const exerciseStatsByUserId = new Map(
    exerciseStats.map((s) => [s.userId, s])
  );

  return allUsers.map((user) => {
    const userLogStats = logStatsByUserId.get(user.id);
    const userExerciseStats = exerciseStatsByUserId.get(user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      joinedAt: user.createdAt.toISOString().slice(0, 10),
      totalLogs: userLogStats?.totalLogs ?? 0,
      lastLogDate: userLogStats?.lastLogDate ?? null,
      customExerciseCount: userExerciseStats?.customExerciseCount ?? 0,
      passwordResetRequestedAt: user.passwordResetRequestedAt
        ? user.passwordResetRequestedAt.toISOString()
        : null,
    };
  });
}

export async function getAdminCount(): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));
  return result?.count ?? 0;
}

export async function getAppSettings(): Promise<{ registrationsOpen: boolean }> {
  const [settings] = await db.select().from(appSettings).limit(1);
  return { registrationsOpen: settings?.registrationsOpen ?? true };
}
