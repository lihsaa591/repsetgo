import * as z from "zod";

export const ProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  heightCm: z.coerce.number().positive().optional().or(z.literal("")),
  weightKg: z.coerce.number().positive().optional().or(z.literal("")),
  dob: z.string().optional(),
  gender: z.enum(["male", "female", "other", "prefer-not-to-say"]).optional(),
  goal: z
    .enum(["build-muscle", "lose-weight", "maintain", "improve-endurance"])
    .optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active"]).optional(),
  unitPreference: z.enum(["kg", "lb"]),
});

export type ProfileFormState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;
