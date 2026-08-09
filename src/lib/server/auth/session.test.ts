import { describe, expect, it, vi } from "vitest";

// session.ts validates SESSION_SECRET at module load, so this must run before
// the import below — vi.hoisted is lifted above the hoisted import statements.
vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long";
});

import { encrypt, decrypt } from "./session";

describe("session encrypt/decrypt", () => {
  it("round-trips a valid payload", async () => {
    const token = await encrypt({ userId: 42, role: "user" }, 24 * 60 * 60 * 1000);
    const payload = await decrypt(token);
    expect(payload).toEqual(expect.objectContaining({ userId: 42, role: "user" }));
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
