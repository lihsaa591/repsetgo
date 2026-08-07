import {
  pgTable,
  serial,
  integer,
  text,
  date,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "@/lib/server/auth/schema";

export const workoutLogs = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  label: text("label").notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exerciseLogs = pgTable("exercise_logs", {
  id: serial("id").primaryKey(),
  workoutLogId: integer("workout_log_id")
    .notNull()
    .references(() => workoutLogs.id, { onDelete: "cascade" }),
  exerciseName: text("exercise_name").notNull(),
  order: integer("order").notNull(),
});

export const sets = pgTable("sets", {
  id: serial("id").primaryKey(),
  exerciseLogId: integer("exercise_log_id")
    .notNull()
    .references(() => exerciseLogs.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  reps: integer("reps").notNull(),
  weight: numeric("weight").notNull(),
});

export type WorkoutLogRow = typeof workoutLogs.$inferSelect;
export type ExerciseLogRow = typeof exerciseLogs.$inferSelect;
export type SetRow = typeof sets.$inferSelect;
