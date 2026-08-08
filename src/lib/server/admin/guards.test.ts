import { describe, expect, it } from "vitest";
import { canChangeRole, checkRegistrationsOpen, canModifyUser } from "./guards";

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

describe("canModifyUser", () => {
  it("rejects targeting yourself", () => {
    const result = canModifyUser(5, 5, "user", 3);
    expect(result).toEqual({
      ok: false,
      error: "You can't do that to your own account.",
    });
  });

  it("rejects targeting the last remaining admin", () => {
    const result = canModifyUser(5, 9, "admin", 1);
    expect(result).toEqual({
      ok: false,
      error: "You can't remove the last admin.",
    });
  });

  it("allows targeting an admin when other admins exist", () => {
    const result = canModifyUser(5, 9, "admin", 2);
    expect(result).toEqual({ ok: true });
  });

  it("allows targeting a regular user even when adminCount is 1", () => {
    const result = canModifyUser(5, 9, "user", 1);
    expect(result).toEqual({ ok: true });
  });

  it("allows targeting another regular user normally", () => {
    const result = canModifyUser(5, 9, "user", 3);
    expect(result).toEqual({ ok: true });
  });
});
