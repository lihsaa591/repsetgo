"use server";

import { put, del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { verifySession } from "@/lib/server/auth/dal";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB, matches the UI's stated limit

export async function uploadAvatar(
  formData: FormData
): Promise<{ error: string } | { url: string }> {
  const session = await verifySession();
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file to upload." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File must be an image." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Image must be 2MB or smaller." };
  }

  const [current] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, session.userId));

  const blob = await put(`avatars/${session.userId}-${Date.now()}`, file, {
    access: "public",
  });

  await db
    .update(users)
    .set({ avatarUrl: blob.url })
    .where(eq(users.id, session.userId));

  if (current?.avatarUrl) {
    await del(current.avatarUrl).catch(() => {
      // Old blob may already be gone; not worth failing the upload over.
    });
  }

  revalidatePath("/settings");
  return { url: blob.url };
}
