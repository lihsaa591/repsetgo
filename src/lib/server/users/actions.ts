"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { verifySession } from "@/lib/server/auth/dal";
import { ProfileSchema, type ProfileFormState } from "./validation";

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await verifySession();

  const validated = ProfileSchema.safeParse({
    name: formData.get("name"),
    heightCm: formData.get("heightCm") || "",
    weightKg: formData.get("weightKg") || "",
    dob: formData.get("dob") || undefined,
    gender: formData.get("gender") || undefined,
    goal: formData.get("goal") || undefined,
    activityLevel: formData.get("activityLevel") || undefined,
    unitPreference: formData.get("unitPreference"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, heightCm, weightKg, dob, gender, goal, activityLevel, unitPreference } =
    validated.data;

  await db
    .update(users)
    .set({
      name,
      heightCm: heightCm === "" ? null : String(heightCm),
      weightKg: weightKg === "" ? null : String(weightKg),
      dob: dob || null,
      gender,
      goal,
      activityLevel,
      unitPreference,
    })
    .where(eq(users.id, session.userId));

  revalidatePath("/settings");
  return { message: "Profile updated." };
}
