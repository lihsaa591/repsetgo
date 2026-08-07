import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";

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
