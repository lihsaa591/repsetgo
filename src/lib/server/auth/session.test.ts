import { describe, expect, it, vi } from "vitest";

// session.ts validates SESSION_SECRET at module load, so this must run before
// the import below — vi.hoisted is lifted above the hoisted import statements.
vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long";
});

import { encrypt, decrypt } from "./session";

describe("session encrypt/decrypt", () => {
  it("round-trips a valid payload", async () => {
    const token = await encrypt(
      { userId: 42, role: "user", mustChangePassword: false },
      24 * 60 * 60 * 1000
    );
    const payload = await decrypt(token);
    expect(payload).toEqual(
      expect.objectContaining({ userId: 42, role: "user", mustChangePassword: false })
    );
  });

  it("returns null when mustChangePassword is missing from the token payload", async () => {
    // Simulates a token signed before this field existed.
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.SESSION_SECRET);
    const staleToken = await new SignJWT({ userId: 42, role: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor((Date.now() + 60_000) / 1000))
      .sign(key);
    const payload = await decrypt(staleToken);
    expect(payload).toBeNull();
  });

  it("returns null for a garbage token", async () => {
    const payload = await decrypt("not-a-real-token");
    expect(payload).toBeNull();
  });

  it("returns null for an undefined token", async () => {
    const payload = await decrypt(undefined);
    expect(payload).toBeNull();
  });
});
