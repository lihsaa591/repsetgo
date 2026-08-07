import { describe, expect, it, beforeAll } from "vitest";
import { encrypt, decrypt } from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long";
});

describe("session encrypt/decrypt", () => {
  it("round-trips a valid payload", async () => {
    const token = await encrypt({ userId: 42, role: "user" });
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
