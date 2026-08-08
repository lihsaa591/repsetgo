# Admin: Create User Directly

**Status:** Approved for planning
**Date:** 2026-08-09

## Context

Phase 2 wired the admin users list to real data with role promote/demote, but the only way to get a *new* account into the system is the public `/signup` flow (or the `promote-admin` CLI script for the very first admin). There's no email-sending infrastructure in this app, so an invite-link flow isn't feasible without building that first. This adds a direct "admin creates the account" path instead.

## Goals

- An "Add user" button on `/admin` opens a dialog with a form: name, email, password, role.
- Admin sets the initial password directly (typed in, no generated-password display, no invite email).
- The created account is immediately usable — the admin shares the password with the person however they communicate.
- Works regardless of the "allow new registrations" setting — this is a separate, admin-only path, not the public signup flow.
- Password held to the same strength rule as public signup (≥8 chars, at least one letter and one number).

## Non-goals

- No "must change password on first login" flag — not tracked anywhere in the schema currently; adding it would be new scope beyond what was asked.
- No email/invite-link flow — no email-sending infrastructure exists in this app.
- No bulk/CSV user import.
- No change to the existing `signup` Server Action, the registrations-open gate, or the `promote-admin` CLI script.

## Architecture

New Server Action in the existing `src/lib/server/admin/` domain, alongside `setUserRole`/`setRegistrationsOpen`:

- `src/lib/server/admin/validation.ts` — `CreateUserSchema` (Zod): `name` (min 2 chars), `email` (valid email), `password` (min 8 chars, letter + number — same rule as `SignupSchema`), `role` (enum `"admin" | "user"`).
- `src/lib/server/admin/actions.ts` — new export `createUserAsAdmin(prevState, formData)`:
  1. `requireAdmin()`.
  2. Validate via `CreateUserSchema.safeParse`; return `{errors}` on failure.
  3. Check email uniqueness (`db.select().from(users).where(eq(users.email, email))`); return `{message: "An account with this email already exists."}` if found — matching `signup`'s existing wording for the same case.
  4. `bcrypt.hash(password, 10)`, insert the user with the given `name`/`email`/`passwordHash`/`role`.
  5. `revalidatePath("/admin")`.
  6. Return a success indicator (e.g. `{success: true}`) so the dialog can close and reset itself — distinct from the `{error}` shape other admin actions use, since this one needs to signal success back to a dialog rather than just "no error."

No session is created for the new account — the admin is not logged in as them.

## UI

New client component `src/app/admin/add-user-dialog.tsx`:
- A `Button` ("Add user") that opens a `Dialog` (same component already used for delete-confirmation in `history-list.tsx`).
- Form fields: Name (`Input`), Email (`Input` type=email), Password (`Input` type=password), Role (`Select`: User / Admin, defaulting to User).
- Wired via `useActionState(createUserAsAdmin, undefined)`; field errors shown inline per input, matching the pattern in `login`/`signup` pages.
- On success (`state.success`), the dialog closes and the form resets — achieved via a `useEffect` watching `state`, closing the dialog and calling `formRef.current?.reset()`.

`src/app/admin/page.tsx` renders `<AddUserDialog />` above the stats cards or above the table (a single button, no layout restructuring needed).

## Error handling

Consistent with the rest of the admin domain: expected failures (validation, duplicate email) return structured state rather than throwing. Unexpected DB errors still throw and surface via Next's error boundary.

## Testing

No new pure logic worth isolating for a unit test here — the validation is a Zod schema (declarative, not custom logic) and the action is a straightforward DB write behind `requireAdmin()`, matching the existing pattern where CRUD actions themselves aren't unit-tested (only pure helper functions like `canChangeRole` are). Verification is manual: create a user via the dialog, confirm they appear in the users list, confirm they can log in with the set password, confirm duplicate-email is rejected, confirm it works with registrations closed.
