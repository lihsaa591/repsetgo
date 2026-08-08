import { pgTable, serial, integer, text, index, unique } from "drizzle-orm/pg-core";
import { users } from "@/lib/server/auth/schema";

export const customExercises = pgTable(
  "custom_exercises",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
  },
  (table) => [
    index("custom_exercises_user_id_idx").on(table.userId),
    unique("custom_exercises_user_id_name_unique").on(table.userId, table.name),
  ]
);
