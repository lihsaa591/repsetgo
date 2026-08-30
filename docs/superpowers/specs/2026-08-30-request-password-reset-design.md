# Request Password Reset (Self-Service Notification)

**Status:** Approved for planning
**Date:** 2026-08-30

## Context

The admin-initiated password reset feature (this same branch) gives admins a way to reset a user's password, but only if the admin already knows to do it. There's no way for a locked-out user to signal "I need a reset" — they'd have to contact someone out-of-band. This adds a self-service "Request password reset" entry point on the login page: the user submits their email, and if it belongs to a real account, the admin sees a pending-request indicator next to that user in `/admin`. No email is sent (the app's Resend account can't reach real users yet — see the admin-password-reset design doc), and no reset token/link is generated; this is purely a notification mechanism that the existing admin-reset-password feature resolves.

## Goals

- A "Forgot password?" entry point on the login page opens a small dialog asking for an email, with no authentication required.
- Submitting always shows the same generic confirmation regardless of whether the email is registered — prevents using this form to enumerate which emails have accounts.
- If the email matches a real user, that user's row in `/admin` gets a visible "reset requested" indicator with a relative timestamp.
- Using the existing "Reset password" admin action for that user clears the indicator, since resetting the password is the natural resolution — no separate dismiss action.

## Non-goals

- No outbound email of any kind (this feature exists specifically because email isn't usable yet).
- No reset token or link — the flag is purely informational for the admin, who resets the password manually through the existing feature.
- No rate-limiting on submissions, consistent with the rest of this app's auth actions (login, signup) having none.
- No history of past requests — a single nullable timestamp per user, not a log.
- No change to `resetUserPassword`'s existing behavior beyond also clearing the new flag.

## Architecture

**Schema**: add `passwordResetRequestedAt: timestamp("password_reset_requested_at")` (nullable, no default) to `users` (`src/lib/server/auth/schema.ts`). One migration.

**Validation** (`src/lib/server/auth/validation.ts`): add `RequestPasswordResetSchema = z.object({ email: z.string().trim().email("Please enter a valid email.") })` and `type RequestPasswordResetFormState = { errors?: Record<string, string[]>; message?: string } | undefined`.

**Public action** (`src/lib/server/auth/password-actions.ts`, alongside `changePassword`) — `requestPasswordReset(prevState, formData)`:
- No session check — this is reachable by anyone, logged in or not, same trust level as `login`/`signup`.
- Validate via `RequestPasswordResetSchema`; on failure, return `{ errors }` (the only case where the response differs — an invalid *email format* is a client-side input problem, not an account-existence signal, so it's fine to report distinctly).
- Look up the user by email; if found, `update(users).set({ passwordResetRequestedAt: new Date() })`.
- Regardless of whether a user was found, return the same success shape: `{ message: "If that email is registered, an admin has been notified." }`. The message field is reused here for a *success* string, not an error — the login page dialog renders it as a plain confirmation, not with `text-destructive` styling (see UI below).

**Admin queries** (`src/lib/server/admin/queries.ts`): `AdminUserRow` gains `passwordResetRequestedAt: string | null` (ISO string, same serialization style already used for `lastLogDate`). `getAllUsersWithStats`'s existing single `users` select just adds the column — no extra query.

**Admin action** (`src/lib/server/admin/actions.ts`): `resetUserPassword`'s existing update call adds `passwordResetRequestedAt: null` to the `.set({...})` alongside `passwordHash` and `mustChangePassword: true` — one extra field on an update that's already happening, not a new statement.

**Login page UI** (`src/app/login/page.tsx`): a "Forgot password?" button/link under the password field opens a `Dialog` (same component used for the admin reset-password dialog in `users-list.tsx`) containing an email field and submit button, wired to `useActionState(requestPasswordReset, undefined)`. On success (`state?.message` present and no `errors`), the dialog shows that message in place of the form — same "swap the dialog body" pattern already used by `ResetPasswordControl` when it reveals the temp password.

**Admin UI** (`src/app/admin/users-list.tsx`): each row shows a small `Badge` (or similar inline text) reading e.g. "Reset requested 4h ago" when `passwordResetRequestedAt` is non-null, using a relative-time formatting approach consistent with how `lastLogDate`/`joinedAt` are already rendered as plain ISO date strings in this file today — a simple `Date.now() - new Date(passwordResetRequestedAt)` bucketed into "just now" / "Xh ago" / "Xd ago" is enough; no library needed for this granularity.

## Error handling

Consistent with the rest of this codebase: only the email-format validation error is distinguished; every other path (email not found, DB update happens) returns the identical generic success message so no branch of this action leaks account existence. Unexpected DB errors still throw and surface via Next's error boundary, same as every other action.

## Testing

`RequestPasswordResetSchema` gets a direct Vitest test (same style as `ChangePasswordSchema`'s): valid email accepted, malformed email rejected. The action itself and the admin-UI badge are verified manually in a running dev server, consistent with how the rest of this feature (and the dropset feature before it) was verified — this codebase has no DB-backed test harness or component test library.
