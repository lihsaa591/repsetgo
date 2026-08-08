import { pgTable, serial, boolean } from "drizzle-orm/pg-core";

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  registrationsOpen: boolean("registrations_open").notNull().default(true),
});

export type AppSettings = typeof appSettings.$inferSelect;
