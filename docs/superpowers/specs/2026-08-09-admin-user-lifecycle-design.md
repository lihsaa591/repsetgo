# Admin: Deactivate & Delete Users

**Status:** Approved for planning
**Date:** 2026-08-09

## Context

The admin users list currently supports viewing real data, role promotion/demotion, and creating new accounts, but has no way to remove or suspend an account. This adds two related, distinct actions: a reversible active/inactive toggle, and a permanent delete with a confirmation modal showing what will be erased.

## Goals

- Admin can toggle a user between active and inactive. An inactive user cannot log in (existing sessions aren't retroactively revoked — same JWT-staleness behavior already accepted for role changes).
- Admin can permanently delete a user, which also deletes their workout logs (and cascaded exercise logs/sets) and custom exercises. Confirmed via a modal showing counts of what will be erased before the action runs.
- Both actions are blocked when the target is the acting admin themselves, and when the target is the last remaining admin account — same reasoning as the existing self-demotion guard: don't let an admin lock everyone (including themselves) out.
- The delete-confirmation modal shows counts only ("N workout logs, M custom exercises"), not a listing of the actual items — enough warning without a bigger query/UI.

## Non-goals

- No account reactivation-triggered session revocation — an inactive user's existing (already-issued) session cookie remains valid until it expires, same accepted limitation as role changes.
- No "trash"/soft-delete/undo for deleted users — deletion is immediate and permanent.
- No listing of the specific workout logs being deleted — counts only.
- No change to `createUserAsAdmin`, `setUserRole`, or the registrations-open gate.

## Architecture

**Schema**: add `isActive` boolean column to `users` (`src/lib/server/auth/schema.ts`), `notNull().default(true)`. One migration; no changes to any other table's schema. Deletion of a user's data uses no `onDelete: cascade` schema change — the delete action explicitly deletes `workout_logs` (cascading to `exercise_logs`/`sets` via the existing cascade already on those two tables) and `custom_exercises` before deleting the `users` row, keeping the blast radius of "delete a user" visible in application code.

**Shared guard**: `src/lib/server/admin/guards.ts` gains `canModifyUser(currentUserId: number, targetUserId: number, targetRole: "admin" | "user", adminCount: number): { ok: true } | { ok: false; error: string }`:
- `currentUserId === targetUserId` → `{ ok: false, error: "You can't do that to your own account." }`
- `targetRole === "admin" && adminCount <= 1` → `{ ok: false, error: "You can't remove the last admin." }`
- else `{ ok: true }`

Both `setUserActive` and `deleteUser` call this same function — the rule is identical for both actions, so it's written once.

**Queries**: `getAllUsersWithStats` (`admin/queries.ts`) is extended with a third batched aggregate (`GROUP BY user_id` over `custom_exercises`, alongside the existing `workout_logs` aggregate) so `AdminUserRow` gains `customExerciseCount: number` — still exactly 3 queries total regardless of user count, no N+1 introduced. `isActive` is added to the existing `users` select (it's already fetching full rows via `safeUserColumns`-style projection... actually via a plain select — just add the column to the returned shape). A new `getAdminCount(): Promise<number>` (1 query, `count(*) where role = 'admin'`) is used by both actions to evaluate the guard fresh at mutation time (not trusted from stale client state).

**Actions** (`admin/actions.ts`):
- `setUserActive(prevState, formData)`: `requireAdmin()` → read `userId`/`isActive` ("true"/"false") from `formData` → fetch target user's `role` → `getAdminCount()` → `canModifyUser` → update `users.isActive` → `revalidatePath("/admin")`.
- `deleteUser(prevState, formData)`: `requireAdmin()` → read `userId` → fetch target user's `role` → `getAdminCount()` → `canModifyUser` → delete `workout_logs` where `userId` matches (cascades to `exercise_logs`/`sets`) → delete `custom_exercises` where `userId` matches → delete the `users` row → `revalidatePath("/admin")`.

**Login gate** (`auth/actions.ts`): after the existing `bcrypt.compare` succeeds (not before — checking account status before password verification would let an attacker distinguish "wrong password" from "deactivated account" for a given email), check `user.isActive`. If `false`, return `{ message: "Your account has been deactivated. Contact an admin." }` instead of creating a session.

**UI** (`admin/users-list.tsx`):
- Active/inactive toggle per row, same visual/interaction pattern as the existing role-toggle button (`useActionState(setUserActive, undefined)`), disabled client-side for self and for the target admin's row when they're the last admin — mirroring how the existing self-demotion guard disables its button.
- A "Delete" button per row opens a confirmation `Dialog` (same component already used for delete-workout-log confirmation) showing "This will permanently delete this user and {totalLogs} workout logs, {customExerciseCount} custom exercises." with a destructive-styled confirm button, wired to `useActionState(deleteUser, undefined)`. Same client-side disabling for self/last-admin as the toggle.

## Error handling

Consistent with the rest of the admin domain: `canModifyUser` failures and "user not found" (e.g. a stale row if two admins act concurrently) return `{ error: string }` rather than throwing. Unexpected DB errors still throw and surface via Next's error boundary.

## Testing

`canModifyUser` is pure and gets the same kind of direct unit test as `canChangeRole`: self-target rejected, last-admin-target rejected, ordinary target allowed, and the boundary case of `adminCount === 1` for a non-admin target (should still be allowed — the "last admin" rule only applies when the *target* is an admin).
