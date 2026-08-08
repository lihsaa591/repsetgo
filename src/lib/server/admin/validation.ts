import * as z from "zod";

export const CreateUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  email: z.string().trim().email("Please enter a valid email."),
  password: z
    .string()
    .min(8, "Be at least 8 characters long.")
    .regex(/[a-zA-Z]/, "Contain at least one letter.")
    .regex(/[0-9]/, "Contain at least one number."),
  role: z.enum(["admin", "user"]),
});

export type CreateUserFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      success?: true;
    }
  | undefined;
