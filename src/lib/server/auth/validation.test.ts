import { describe, expect, it } from "vitest";
import { ChangePasswordSchema } from "./validation";

describe("ChangePasswordSchema", () => {
  it("accepts a valid matching password pair", () => {
    const result = ChangePasswordSchema.safeParse({
      password: "newpass123",
      confirmPassword: "newpass123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = ChangePasswordSchema.safeParse({
      password: "abc123",
      confirmPassword: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no letter", () => {
    const result = ChangePasswordSchema.safeParse({
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no number", () => {
    const result = ChangePasswordSchema.safeParse({
      password: "abcdefgh",
      confirmPassword: "abcdefgh",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when password and confirmPassword don't match", () => {
    const result = ChangePasswordSchema.safeParse({
      password: "newpass123",
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
  });
});
