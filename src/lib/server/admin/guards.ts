export function canChangeRole(
  currentUserId: number,
  targetUserId: number,
  newRole: "admin" | "user"
): { ok: true } | { ok: false; error: string } {
  if (currentUserId === targetUserId && newRole === "user") {
    return { ok: false, error: "You can't demote yourself." };
  }
  return { ok: true };
}

export function checkRegistrationsOpen(
  settings: { registrationsOpen: boolean }
): { ok: true } | { ok: false; error: string } {
  if (!settings.registrationsOpen) {
    return { ok: false, error: "New signups are currently closed." };
  }
  return { ok: true };
}

export function canModifyUser(
  currentUserId: number,
  targetUserId: number,
  targetRole: "admin" | "user",
  adminCount: number
): { ok: true } | { ok: false; error: string } {
  if (currentUserId === targetUserId) {
    return { ok: false, error: "You can't do that to your own account." };
  }
  if (targetRole === "admin" && adminCount <= 1) {
    return { ok: false, error: "You can't remove the last admin." };
  }
  return { ok: true };
}
