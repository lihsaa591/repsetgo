# Sign in with Google

**Status:** Approved for planning
**Date:** 2026-08-31

## Context

RepSetGo currently has only hand-rolled email/password auth (bcrypt hashing + a `jose`-signed JWT session cookie, with `role`, `isActive`, and `mustChangePassword` baked into that session and enforced across `proxy.ts` and every admin/auth check). This adds "Continue with Google" as an alternative sign-in path, usable on both `/login` and `/signup`. No custom domain is required — Google OAuth only needs a stable HTTPS redirect URI, and this app's Vercel production alias (`myrepsetgo.vercel.app`) already qualifies.

The app doesn't need a custom domain, a database session adapter, or multi-provider support (no Facebook/GitHub/etc. planned) — just Google, bridged into the session system that already exists.

## Goals

- A "Continue with Google" button on `/login` and `/signup` that, on success, signs the user into their RepSetGo account exactly as if they'd logged in with a password — same session cookie, same `role`/`mustChangePassword` handling, same redirect logic.
- First-time Google sign-in with an email that has no existing account creates a new `users` row (no password set).
- First-time Google sign-in with an email that **does** match an existing password-based account links that account (auto-link, per product decision) rather than creating a duplicate.
- A user whose account has no password (`passwordHash: null`) gets a clear message if they try the password login form, instead of a confusing failure.

## Non-goals

- No other OAuth providers (GitHub, Facebook, etc.) — Google only.
- No migration of the existing session system to Auth.js-managed sessions — Auth.js is used strictly for the OAuth protocol handshake with Google; every other part of the app keeps using the existing `createSessionCookie`/`verifySession`/`proxy.ts` machinery unchanged.
- No database session adapter for Auth.js (no `accounts`/`sessions` tables it manages) — Auth.js runs in its default stateless JWT mode purely to complete the handshake; RepSetGo's own `users` table is the only durable state this feature adds to.
- No "unlink Google" or "set a password" self-service flow for Google-only accounts (a Google-only user who later wants a password would need an admin-assisted path, same as the existing admin-reset-password feature — not built here, could be a future feature).
- No change to the admin panel, registration-open gate bypass, or `mustChangePassword` behavior — a Google sign-in that lands on an account with `mustChangePassword: true` still gets redirected to `/change-password` exactly like a password login does, because it goes through the same `createSessionCookie` call.

## Architecture

**Dependency:** `next-auth@beta` (Auth.js v5, `5.0.0-beta.32` at time of writing — its peer dependencies declare support for `next ^16.0.0`, matching this app's Next.js 16.2.12). No database adapter package needed.

**Schema** (`src/lib/server/auth/schema.ts`):
- `passwordHash: text("password_hash").notNull()` → `passwordHash: text("password_hash")` (nullable). A Google-only account never gets a password set.
- New column: `googleId: text("google_id").unique()` (nullable). Set the first time a user completes Google sign-in; used on every subsequent Google sign-in to find the account directly (falling back to email lookup only if `googleId` isn't set yet, e.g. the very first Google sign-in for that person).

One migration for both changes.

**Auth.js configuration** (`src/lib/server/auth/next-auth-config.ts` + route handler at `src/app/api/auth/[...nextauth]/route.ts`, the standard Auth.js App Router wiring): a single `GoogleProvider` (env-driven client ID/secret), no adapter, default JWT session strategy. This Auth.js session is transient plumbing — nothing outside the bridge step (below) ever reads it.

**The bridge** (`src/lib/server/auth/google-bridge.ts`, called from a `callbacks.signIn` hook in the Auth.js config — this runs server-side, before Auth.js's own redirect completes, so it can run once per sign-in with the verified Google profile already in hand):
1. Receive the verified Google profile (`email`, `name`, `sub` as the Google ID) from Auth.js's callback arguments — no separate API call needed, Auth.js already validated the token.
2. Look up `users` by `googleId = profile.sub`. If found, that's the account.
3. If not found, look up by `email = profile.email`. If found, link: `update users set googleId = profile.sub where id = ...` (auto-link decision). If not found, insert a new row: `{ name: profile.name, email: profile.email, googleId: profile.sub, passwordHash: null, role: "user" }`.
4. Call the existing `createSessionCookie({ userId, role, mustChangePassword }, false)` — same function `login()`/`signup()` already use, `rememberMe` defaulting to `false` for an OAuth sign-in (no "remember me" checkbox in this flow).
5. Return `true` from the `signIn` callback to let Auth.js finish its own (throwaway) redirect, which lands on `callbacks.redirect`'s configured target — set to `/dashboard` (the same default a fresh login lands on; if `mustChangePassword` is true, `proxy.ts`'s existing gate redirects from there to `/change-password` exactly as it does today for a password login — no special-casing needed since that gate reads the same session cookie this bridge just issued).

**Login gate for passwordless accounts** (`src/lib/server/auth/actions.ts`, `login()`): after fetching the user by email, if `user.passwordHash === null`, return `{ message: "This account uses Google sign-in. Use \"Continue with Google\" instead." }` before attempting any `bcrypt.compare` (comparing against `null` would throw).

**UI** (`src/app/login/page.tsx`, `src/app/signup/page.tsx`): a "Continue with Google" button, styled consistent with the existing form buttons, placed above the existing form with a "or" divider. Clicking it calls Auth.js's client-side `signIn("google")` (from `next-auth/react`), which redirects to Google and back through the flow above.

**Env vars** (`.env.local.example`, and Vercel project env vars for Production + Preview): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` (Auth.js's own signing secret for its transient JWT — distinct from this app's existing `SESSION_SECRET`, generated the same way: `openssl rand -base64 32`). Google Cloud Console redirect URI: `https://myrepsetgo.vercel.app/api/auth/callback/google` for production, `http://localhost:3000/api/auth/callback/google` for local dev.

## Error handling

If Auth.js's handshake itself fails (user denies consent, Google returns an error), Auth.js's default error page/redirect handles that — no custom handling needed for this first version. If the bridge's DB lookup/insert throws, it surfaces the same way any other unexpected DB error does elsewhere in this codebase — through Next's error boundary, not a special-cased message.

## Testing

The account-linking decision logic (given a Google profile and existing DB state, decide "match by googleId" / "link by email" / "create new") is extracted into a small pure function so it can get a direct Vitest test the same way `canModifyUser`/`canChangeRole` already do in the admin domain. The `googleId` lookup always takes priority over the email lookup (per Architecture step 2 vs. 3), so if a `googleId` is ever already attached to some account, that account is the answer regardless of what the email matches elsewhere — there is no separate "conflicting match" branch to design, only this priority order to test. Covers: no match found by either field (create), `googleId` match (use that account, ignore email entirely), and email match with no prior `googleId` on any row (link).

Everything else (the actual OAuth redirect round-trip, the UI buttons, the login-gate message) is verified manually in a running dev server, consistent with how the rest of this codebase's auth features have been verified — there's no OAuth-provider mock or component test harness here.
