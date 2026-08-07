# Phase 1: Foundation (Auth + DB) & Dynamic Workout Flow

**Status:** Approved for planning
**Date:** 2026-08-07

## Context

RepSetGo is currently a UI-only mockup: the `(app)` route group (dashboard, log, history, settings) and the `admin` route group are built with shadcn-style components, but all data is either hardcoded (`src/lib/mock-data.ts`) or persisted to `localStorage` via client hooks (`use-workout-logs.ts`, `use-exercise-options.ts`). There is no database, no authentication, and no distinction between admin and user beyond a separate route tree.

This is the first of several planned phases to make the app dynamic:

1. **Phase 1 (this spec):** Foundation — database, auth, session/DAL, route protection — plus the full workout logging flow (dashboard, log, edit, history) and account settings, all backed by real per-user data.
2. **Phase 2 (future):** Admin panel wired to real data (users list, stats, app settings).
3. **Phase 3+ (future):** Further features as needed (e.g. richer analytics, social features).

Expected initial scale: ~40-50 users from an Instagram/TikTok marketing push. The architecture should not need a rewrite if usage grows well beyond that.

## Goals

- Real signup/login/logout with per-user sessions.
- Role-based route protection (`user` vs `admin`), enforced both optimistically (proxy) and authoritatively (DAL/Server Actions).
- Workout logging (create/edit/delete/list) backed by a relational database, replacing localStorage entirely.
- Per-user custom exercises, replacing localStorage.
- Account settings (profile fields + avatar) persisted to the database.
- Dashboard "suggested workout" derived from the user's real logged history instead of hardcoded data.
- A domain-oriented code structure that scales by adding folders, not by growing existing files.

## Non-goals (explicitly out of scope for phase 1)

- Admin panel data wiring (users list, admin settings) — phase 2.
- Social login / OAuth / MFA.
- Admin approval workflow for new signups (self-serve signup is in scope; approval flows are not).
- End-to-end/browser test automation.
- Shared/global custom exercise catalog (exercises added by a user are private to that user).

## Stack

- **Hosting:** Vercel (Hobby/free tier).
- **Database:** Neon (serverless Postgres, free tier), accessed via `@neondatabase/serverless` (HTTP driver, not a long-lived pool) to stay safe under serverless connection limits as usage grows.
- **ORM:** Drizzle.
- **Auth:** Hand-rolled, following the Next.js authentication guide's recommended pattern — no third-party auth library. Rationale: two roles, no social login requirement, and the app already needs a well-defined DAL boundary, so the "roll our own" cost is low and avoids unnecessary lock-in.
- **File storage:** Vercel Blob (free tier, 1GB) for avatar images.
- **Validation:** Zod.
- **Password hashing:** bcrypt.
- **Session tokens:** `jose` (JWT, HS256), stored in an httpOnly, secure, `sameSite=lax` cookie.

## Code architecture

Domain-oriented folders under `src/lib/server/`, one per business domain. Each domain owns its schema slice, read queries, and Server Actions:

```
src/lib/server/
  db.ts                    # Drizzle client (Neon serverless driver)
  auth/
    schema.ts              # users, sessions-related columns (role, password_hash live on users)
    session.ts             # encrypt/decrypt JWT, createSession/deleteSession (cookie mgmt)
    dal.ts                 # verifySession() [React.cache], getCurrentUser()
    actions.ts             # signup, login, logout Server Actions
  users/
    # No schema.ts here — profile columns live on the `users` table,
    # defined in auth/schema.ts. This folder holds user-domain reads/writes only.
    queries.ts               # getUserProfile(userId)
    actions.ts               # updateProfile, updateAvatar
  workouts/
    schema.ts               # workout_logs, exercise_logs, sets
    queries.ts               # getWorkoutLogsForUser, getWorkoutLogById, suggestNextWorkout()
    actions.ts               # createWorkoutLog, updateWorkoutLog, deleteWorkoutLog
  exercises/
    schema.ts                # custom_exercises
    queries.ts                # getExerciseOptionsForUser
    actions.ts                # addCustomExercise
proxy.ts                      # project root; optimistic route protection
```

Rationale: adding a new domain (e.g. `admin/` in phase 2) means adding a new folder without touching existing ones. This mirrors the Next.js docs' DAL-centric recommendation and avoids both extremes (one giant `schema.ts`/`actions.ts`, or premature repository/service-class layering that a 40-50 user app doesn't need yet).

The existing `src/lib/mock-data.ts`, `use-workout-logs.ts`, and `use-exercise-options.ts` are deleted once the equivalent server-side code lands; `src/components/workout-form.tsx` and `exercise-picker.tsx` are updated to call Server Actions instead of the localStorage hooks, but keep their existing UI/markup.

## Data model

All tables live in Neon Postgres, defined via Drizzle schema files co-located per domain above.

- **users**: `id` (pk), `name`, `email` (unique, indexed), `password_hash`, `role` (`admin` | `user`, default `user`), `height_cm`, `weight_kg`, `dob`, `gender`, `goal`, `activity_level`, `unit_preference` (default `kg`), `avatar_url`, `created_at`.
- **workout_logs**: `id` (pk), `user_id` (fk → users.id, indexed), `label`, `date`, `notes`, `created_at`.
- **exercise_logs**: `id` (pk), `workout_log_id` (fk → workout_logs.id, indexed), `exercise_name`, `order`.
- **sets**: `id` (pk), `exercise_log_id` (fk → exercise_logs.id, indexed), `set_number`, `reps`, `weight`.
- **custom_exercises**: `id` (pk), `user_id` (fk → users.id, indexed), `name`.

This normalizes the current mock's nested `WorkoutLog.exercises[].sets[]` shape into relational tables, enabling cheap per-exercise/per-set queries later (e.g. progress-over-time charts) without restructuring.

Indexes on all foreign keys are created at schema definition time, not retrofitted later.

## Auth flow

- **Signup**: Server Action (`auth/actions.ts`) validates input with Zod, checks email uniqueness, hashes password with bcrypt, inserts the user with `role: "user"`, creates a session cookie, redirects to `/dashboard`. Self-serve — no approval step.
- **Login**: validates credentials against the stored hash, creates the same session cookie, redirects to `/dashboard`.
- **Logout**: deletes the session cookie, redirects to `/login`.
- **Session payload**: `{ userId, role }` only — no PII — signed HS256 via `jose`, 7-day expiry, httpOnly/secure/sameSite=lax cookie.
- **DAL** (`auth/dal.ts`): `verifySession()` — decrypts the cookie, redirects to `/login` if missing/invalid, memoized per-request via `React.cache`. `getCurrentUser()` — fetches the full user row for the verified session, used wherever profile data is needed.
- **Route protection** (`proxy.ts`, project root): optimistic, cookie-only checks — unauthenticated users are redirected away from `(app)/*` and `admin/*`; non-admins are redirected away from `admin/*`; authenticated users are redirected away from `/login` and `/signup`. This is a first line of defense only — every Server Action and data query independently re-verifies the session and, where relevant, resource ownership (e.g. "does this workout log belong to this user?").
- **First admin**: no admin UI exists yet to promote users (that's phase 2). After signing up normally, a one-off script (`scripts/promote-admin.ts`) flips a given email's `role` to `admin` directly via Drizzle.
- **Missing pages to build**: `/login` and `/signup` pages don't exist yet in the current mockup and are added as part of this phase.

## Workout flow

- Dashboard, History, Log, and Edit pages become `async` Server Components, each starting with `await verifySession()` and then calling domain query functions directly (e.g. `getWorkoutLogsForUser(userId)`) — no client-side data-fetching hooks.
- `WorkoutForm`'s `onSave` becomes the `createWorkoutLog` / `updateWorkoutLog` Server Action: writes the log, its exercise logs, and their sets in a single DB transaction, then calls `revalidatePath("/history")` (and `/dashboard`) and redirects. The component's existing markup and local draft-state (`DraftExercise`/`DraftSet`) stay as-is; only the save/cancel wiring changes.
- Delete (already a confirm-dialog flow in History) becomes the `deleteWorkoutLog` Server Action, checking the log belongs to the current user before deleting.
- `ExercisePicker`'s `options` prop is populated from `getExerciseOptionsForUser` (static base catalog + that user's `custom_exercises` rows) instead of the localStorage-backed hook; `addCustomExercise` becomes the `addCustomExercise` Server Action.
- **Suggested workout** (dashboard): a pure function `suggestNextWorkout(logs: WorkoutLog[])` — no DB access, easily unit-testable — inspects the user's real logged labels, finds whichever label has gone the longest without being logged (falling back sensibly if the user has only ever logged one label, or none), and returns `{ label, reason, exercises }` where `reason` is a dynamic string (`"It's been {n} days since your last {label} session"`) and `exercises` comes from that label's most recent log.

## Account settings & avatar

- `updateProfile` Server Action (in `users/actions.ts`) validates and persists height, weight, DOB, gender, goal, activity level, and unit preference to the `users` row. Email stays read-only (used as the login identifier).
- Avatar upload uses Vercel Blob: the client requests a signed upload URL via a Server Action, uploads directly to Blob storage, and the resulting URL is saved to `users.avatar_url`. When a user replaces their avatar, the previous blob is deleted so storage doesn't grow unbounded per user.

## Error handling

- Form-level validation errors (signup, login, profile, workout form) surface via `useActionState`, matching the Next.js docs' pattern — field-level messages, not generic failures.
- Every Server Action independently re-checks `verifySession()` and, for mutations on existing resources, ownership — Server Actions are directly POST-reachable and must not rely on UI-level checks alone.
- Actions return a `{ error: string }` shape for expected failure cases (bad credentials, duplicate email, not found) rather than throwing, so the UI can render a message. Unexpected errors still throw and surface via Next.js error boundaries.
- Not-found cases (e.g. navigating to `/log/[id]` for a deleted or someone else's log) keep the existing "Workout not found" fallback UI, now driven by a real query returning `null`/no match instead of a mock array lookup.

## Testing plan

- Add Vitest for unit tests, prioritizing pure logic: `suggestNextWorkout()` and Zod validation schemas are the highest-value/easiest-to-get-subtly-wrong targets.
- Server Actions get lighter integration tests run against a disposable Neon branch (Neon's branching feature is well-suited to spin up a throwaway test DB per run).
- No E2E/browser automation in phase 1; manual verification in the browser during implementation. Revisit Playwright once there are real users and higher regression risk.

## Scalability notes (for future user growth beyond ~40-50)

- Neon can be upgraded from free to a paid tier without any schema/code migration.
- The serverless HTTP driver avoids the "too many connections" failure mode that a traditional connection pool would eventually hit under serverless scaling.
- Stateless JWT sessions mean auth checks don't add DB load as user count grows; the DB is only queried for actual user/profile data, memoized per-request.
- Foreign keys are indexed from the start.
- Admin users list (phase 2) will reuse the pagination pattern already used in History, to avoid an unpaginated full-table query.
