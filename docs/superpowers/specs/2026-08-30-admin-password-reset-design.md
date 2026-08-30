# Admin-Initiated Password Reset

**Status:** Approved for planning
**Date:** 2026-08-30

## Context

There's no "forgot password" flow, and outbound email can't reach real users right now — the app's Resend account is on the shared, unverified `onboarding@resend.dev` domain, which rejects sends to any address other than the developer's own (confirmed directly: `403 validation_error` from the Resend API). Building an email-based reset link is out until a real domain is verified.

Instead: admins (who already manage users in `/admin`) get a "Reset password" action that generates a random password and shows it once, for the admin to relay to the user out-of-band. The user is then forced to set their own password on next login. Since no self-service "change password" exists anywhere in the app today, this adds one reusable change-password action rather than a one-off forced-only path.

## Goals

- Admin can reset any user's password from `/admin`, generating a random temporary password shown once in the admin UI (never stored in plaintext, never logged).
- The affected user is forced to choose a new password before they can use the rest of the app, immediately after logging in with the temp password.
- The same change-password action is exposed as a normal, always-available "Change password" section in Settings — usable any time, not just after a forced reset.

## Non-goals

- No email notification of the reset (no working outbound email to real users yet — the admin communicates the temp password directly).
- No password history/reuse checks.
- No rate-limiting on reset attempts or change-password submissions (matches the rest of the app's current auth, which has none either).
- No "resend a different temp password" or expiry on the temp password beyond normal login rules — it's a full password replacement, valid until the user changes it.

## Architecture

**Schema**: add `mustChangePassword: boolean("must_change_password").notNull().default(false)` to `users` (`src/lib/server/auth/schema.ts`). One migration.

**Admin action** (`src/lib/server/admin/actions.ts`) — `resetUserPassword(prevState, formData)`:
- `requireAdmin()` guard, same as every other action in this file.
- Read `userId` from `formData`; validate it's an integer and the target user exists (same shape as `setUserActive`/`deleteUser`).
- Generate a random password: `crypto.randomBytes(9).toString("base64url")` (12 URL-safe characters, satisfies the existing `SignupSchema` password rules — mixed alphanumeric, ≥8 chars — regenerate on the rare case it doesn't contain both a letter and a digit).
- `bcrypt.hash` it (cost 10, matching existing signup/admin-create-user hashing) and update the target's `passwordHash`, set `mustChangePassword = true`.
- Return `{ tempPassword: string }` on success — this is the only place the plaintext ever exists; it's not persisted or logged anywhere.
- No interaction with `canModifyUser`/last-admin guard — resetting a password isn't role/active-state modification and doesn't lock anyone out, so it's allowed even against the last admin or (with a UI confirm) against yourself.

**Admin UI** (`src/app/admin/users-list.tsx`): a "Reset password" row action (icon button, alongside the existing role/active/delete controls) opens a confirmation `Dialog` ("Reset {name}'s password? They'll need a new one from you to log in."). On confirm, calls `resetUserPassword` via `useActionState`; on success the same dialog swaps to show the generated password in a read-only input with a copy-to-clipboard button and a note: "This won't be shown again — copy it now."

**Session payload** (`src/lib/server/auth/session.ts`): `SessionPayload` gains `mustChangePassword: boolean`, validated in `decrypt()` alongside the existing `userId`/`role` checks.

**Login** (`src/lib/server/auth/actions.ts`): after the existing `isActive` check, read `user.mustChangePassword` and include it when calling `createSessionCookie`.

**Route gating** (`src/proxy.ts`): after the existing admin-route check, add: if `session.mustChangePassword` is true and `path !== "/change-password"`, redirect to `/change-password`. `/change-password` itself needs no addition to `publicRoutes` — it still requires a valid session, just skips the normal page a logged-in user would land on.

**Change-password action** (new: `src/lib/server/auth/password-actions.ts`):
- `changePassword(prevState, formData)`: `verifySession()` → validate the new password with a new `ChangePasswordSchema` (reuses the same rule as `SignupSchema.password`: min 8 chars, ≥1 letter, ≥1 number) → `bcrypt.hash` → update `passwordHash` and set `mustChangePassword = false` for `session.userId` → re-issue the session cookie via `createSessionCookie({ userId, role, mustChangePassword: false })` so the forced-redirect clears immediately. `verifySession` doesn't expose whether the current cookie was a "remember me" one, so the re-issued cookie always uses the short (24h) duration — a user who wants "remember me" back just needs to check the box again next time they log in; this is a one-time downgrade at the exact moment they're already re-authenticating, not a recurring inconvenience → `redirect("/dashboard")`.
- No "current password" field required for this first version — this is the same trust boundary as every other action here (`verifySession()` already proves who's asking); requiring the current password would additionally block the exact case this feature exists for (an admin-issued temp password the user is replacing).

**Change-password page** (new: `src/app/change-password/page.tsx` + a small client form component): single "New password" + "Confirm password" field pair, submits to `changePassword`. Shown either because of the forced redirect or because the user navigated to Settings' "Change password" section (which renders the same form component, just wired directly into the account settings page instead of gated by `proxy.ts`).

**Settings UI** (`src/app/(app)/settings/account-settings-form.tsx` or a new sibling component `change-password-form.tsx` used by both the settings page and the standalone `/change-password` page): a "Change password" card using the same `useActionState(changePassword, undefined)` pattern already used for `updateProfile` in this file.

## Error handling

Consistent with the rest of the app: validation and "not found" failures return `{ error }`/`{ errors }` shapes rather than throwing; unexpected DB errors still throw and surface via Next's error boundary. `resetUserPassword`'s random-password generation retries in-process (not user-visible) if the generated string happens to fail the letter+digit check — no error path needed there since it's just a regenerate loop bounded to a handful of attempts.

## Testing

- `ChangePasswordSchema` gets the same kind of direct validation test as `SignupSchema`/`LoginSchema` already have (`validation.test.ts`): too-short password rejected, missing letter/digit rejected, valid password accepted.
- Manual verification (no DB test harness for full flows exists yet in this codebase, consistent with how the admin user-lifecycle and dropset features were verified): admin resets a test user's password, confirm the shown password isn't shown again on re-render; log in as that user with the temp password, confirm redirect to `/change-password` and that other routes redirect there too; submit a new password, confirm redirect to `/dashboard` and that `mustChangePassword` is now false; confirm Settings' "Change password" works standalone for a user who was never reset.
