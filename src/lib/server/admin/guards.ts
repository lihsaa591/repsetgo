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
