import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./src/lib/server/auth/schema.ts",
    "./src/lib/server/workouts/schema.ts",
    "./src/lib/server/exercises/schema.ts",
    "./src/lib/server/admin/schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
