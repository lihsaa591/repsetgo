import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { verifySession } from "@/lib/server/auth/dal";

// Streams a user's avatar from the private Blob store. Any authenticated
// user may view any other user's avatar (it's a profile photo, shown
// elsewhere in the app) — but only a real session can reach this route at
// all, and the pathname to fetch always comes from our own database lookup,
// never from client input, so there's no way to probe arbitrary blob paths.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  await verifySession();

  const { userId } = await params;
  const numericId = Number(userId);
  if (!Number.isInteger(numericId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [user] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, numericId));

  if (!user?.avatarUrl) {
    return new NextResponse("Not found", { status: 404 });
  }

  const result = await get(user.avatarUrl, { access: "private" });

  if (!result || result.statusCode !== 200) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-cache",
    },
  });
}
