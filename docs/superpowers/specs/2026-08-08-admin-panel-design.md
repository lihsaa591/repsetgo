# Phase 2: Admin Panel

**Status:** Approved for planning
**Date:** 2026-08-08

## Context

Phase 1 (see `2026-08-07-foundation-and-workout-flow-design.md`) made the user-facing app dynamic — real auth, database-backed workouts, profile, and avatars — but explicitly left the admin panel (`/admin`, `/admin/settings`) mocked as a non-goal. `requireAdmin()` (a DAL guard added during phase 1's final review) already protects the `/admin` route tree; the pages themselves still render hardcoded arrays.

This phase wires the admin panel to real data: a users list with real stats and role management, and a single real app-wide setting (whether new signups are open).

## Goals

- Admin users list backed by real data: name, email, role, join date, total logged workouts, most recent log date.
- Admins can promote/demote a user's role from the UI, with a guard against self-demotion.
- "Active this week" summary stat derived from real logging activity.
- A real, admin-toggleable "allow new registrations" setting, enforced at signup.
- Reuse phase 1 patterns: domain-folder structure, `requireAdmin()`, batched queries (no N+1), `{error}`-shaped action failures, pagination pattern from `history-list.tsx`.

## Non-goals (explicitly out of scope)

- "App name" field and "Reset all data" danger-zone button from the mockup — dropped. App name is fine hardcoded; a full data-wipe action is too destructive to build casually and has no real use case yet.
- Login-timestamp tracking — "active" is derived from workout-logging activity, not session/login events. No `users` schema change.
- Viewing an individual user's workout detail from the admin panel.
- Deleting/deactivating user accounts.
- Any change to the existing `promote-admin` CLI script — it remains as the bootstrap mechanism for the very first admin; the new UI is for day-to-day role management thereafter.

## Architecture

New domain folder, following the existing pattern (`workouts/`, `exercises/`, `users/`):

```
src/lib/server/admin/
  schema.ts     # app_settings table
  queries.ts    # getAllUsersWithStats(), getAppSettings()
  actions.ts    # setUserRole(userId, role), setRegistrationsOpen(open)
  guards.ts     # pure self-demotion check, unit-tested directly
```

`src/app/admin/layout.tsx` already calls `requireAdmin()` (added in phase 1's final review) — no new route-level auth work. Every action in `admin/actions.ts` independently calls `requireAdmin()` itself regardless, matching phase 1's "every Server Action verifies its own authorization" constraint — the layout guard is defense-in-depth, not the only check.

## Data model

One new table, added via `src/lib/server/admin/schema.ts` and a migration:

- **app_settings**: `id` (serial pk), `registrationsOpen` (boolean, not null, default `true`).

The migration inserts the single row (`id: 1`) as part of itself, so application code never has to handle "no settings row exists yet" — `getAppSettings()` can assume exactly one row exists.

No changes to `users` or `workout_logs`.

## Users list

`getAllUsersWithStats()` (in `admin/queries.ts`) runs exactly 2 queries regardless of user count:

1. `SELECT * FROM users` — all users.
2. One aggregate query against `workout_logs`, `GROUP BY user_id`, producing `{ userId, totalLogs, lastLogDate }` for every user who has at least one log.

These are joined in memory (users with no logs get `totalLogs: 0`, `lastLogDate: null`). This mirrors the phase 1 N+1 fix in `workouts/queries.ts` — batch first, never loop-and-query-per-row.

The admin page's "Active this week" stat counts users whose `lastLogDate` falls within the last 7 days (server-computed at render time, not stored).

**Role changes**: each row gets a control to change a user's role. This calls `setUserRole(targetUserId, newRole)` (`admin/actions.ts`), which:
1. Calls `requireAdmin()`.
2. If `targetUserId === session.userId` and `newRole === "user"`, returns `{ error: "You can't demote yourself." }` without touching the database — checked via a pure, directly unit-tested function in `admin/guards.ts` (`canChangeRole(currentUserId, targetUserId, newRole): { ok: true } | { ok: false; error: string }`), so the rule is testable without a database or session mock.
3. Otherwise updates `users.role` and calls `revalidatePath("/admin")`.

**Pagination**: same client-side-over-a-fetched-page pattern as `history-list.tsx` (10/page). Reasonable at current and expected user counts; revisiting this would only make sense if the user base grew far beyond what's expected for this app.

## Registration toggle

`getAppSettings()` reads the single `app_settings` row. `setRegistrationsOpen(open: boolean)` (admin-only, `requireAdmin()`-gated) updates it and calls `revalidatePath("/admin/settings")`.

The signup Server Action (`src/lib/server/auth/actions.ts`) gains one new check, first thing in the function, before Zod validation or any DB write:

```ts
const settings = await getAppSettings();
const registrationCheck = checkRegistrationsOpen(settings);
if (!registrationCheck.ok) {
  return { message: registrationCheck.error };
}
```

`checkRegistrationsOpen` is the pure function described in Testing below — kept separate from the DB read so the decision logic itself has no database dependency to mock.

Deliberately placed before validation — a closed-signups check should short-circuit as cheaply as possible, not after doing validation work that's about to be discarded.

The admin settings page (`src/app/admin/settings/page.tsx`) becomes an async Server Component reading `getAppSettings()`, rendering a single toggle wired to `setRegistrationsOpen` via `useActionState`, following the same form pattern as the rest of the app (login/signup pages, account settings). The "App name" field and "Reset all data" button are removed from this page per the non-goals above.

## Error handling

Consistent with phase 1's conventions:
- Expected failures (self-demotion, "no such user") return `{ error: string }` rather than throwing.
- `requireAdmin()` handles unauthorized access by redirecting (existing behavior, unchanged).
- Unexpected errors (DB failures) still throw and surface via Next.js's error boundary — no new swallowing introduced.

## Testing

Two pieces of pure logic get direct unit tests, matching the TDD pattern already used for `suggestNextWorkout` and the workout-validation caps in phase 1:

- `canChangeRole()` in `admin/guards.ts` — covers: self-demotion rejected, self-promotion-to-admin allowed (a no-op but not an error), promoting/demoting another user allowed.
- `guards.ts` also exports a second pure function, `checkRegistrationsOpen(settings: { registrationsOpen: boolean }): { ok: true } | { ok: false; error: string }`, used by the signup action's early-exit check. Directly unit-tested (open → `{ok: true}`, closed → the exact rejection message) without needing a database or a Server Action call.

No new integration/E2E testing infrastructure — consistent with phase 1's scope.
