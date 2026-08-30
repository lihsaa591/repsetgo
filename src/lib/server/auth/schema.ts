import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  numeric,
  date,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  passwordResetRequestedAt: timestamp("password_reset_requested_at"),
  heightCm: numeric("height_cm"),
  weightKg: numeric("weight_kg"),
  dob: date("dob"),
  gender: text("gender", { enum: ["male", "female", "other", "prefer-not-to-say"] }),
  goal: text("goal", {
    enum: ["build-muscle", "lose-weight", "maintain", "improve-endurance"],
  }),
  activityLevel: text("activity_level", {
    enum: ["sedentary", "light", "moderate", "active"],
  }),
  unitPreference: text("unit_preference", { enum: ["kg", "lb"] })
    .notNull()
    .default("kg"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
