import { describe, expect, it } from "vitest";
import { canChangeRole, checkRegistrationsOpen } from "./guards";

describe("canChangeRole", () => {
  it("rejects demoting yourself", () => {
    const result = canChangeRole(5, 5, "user");
    expect(result).toEqual({ ok: false, error: "You can't demote yourself." });
  });

  it("allows promoting yourself to admin (a no-op, not an error)", () => {
    const result = canChangeRole(5, 5, "admin");
    expect(result).toEqual({ ok: true });
  });

  it("allows promoting another user", () => {
    const result = canChangeRole(5, 9, "admin");
    expect(result).toEqual({ ok: true });
  });

  it("allows demoting another user", () => {
    const result = canChangeRole(5, 9, "user");
    expect(result).toEqual({ ok: true });
  });
});

describe("checkRegistrationsOpen", () => {
  it("allows signup when registrations are open", () => {
    const result = checkRegistrationsOpen({ registrationsOpen: true });
    expect(result).toEqual({ ok: true });
  });

  it("rejects signup when registrations are closed", () => {
    const result = checkRegistrationsOpen({ registrationsOpen: false });
    expect(result).toEqual({
      ok: false,
      error: "New signups are currently closed.",
    });
  });
});
