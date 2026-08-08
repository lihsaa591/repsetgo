import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { users } from "@/lib/server/auth/schema";

// This script imports the schema directly rather than the app's `db` client
// (src/lib/server/db.ts), since that module is guarded with `import "server-only"`
// to keep it out of client bundles — which also blocks plain Node/tsx execution.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}
const db = drizzle({ client: neon(process.env.DATABASE_URL) });

const email = process.argv[2];

if (!email) {
  console.error("Usage: npx tsx scripts/promote-admin.ts <email>");
  process.exit(1);
}

async function main() {
  const [updated] = await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email, role: users.role });

  if (!updated) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  console.log(`Promoted ${updated.email} (id ${updated.id}) to admin.`);
}

main();
