# Registration Welcome Email

**Status:** Approved for planning
**Date:** 2026-08-09

## Context

RepSetGo has no email-sending capability. This adds transactional email via Resend, starting with a single welcome email sent after signup, structured so additional email types can be added later without restructuring.

## Goals

- A new user receives a simple "Welcome to RepSetGo" email immediately after signing up.
- Sending a domain-agnostic first version: uses Resend's shared test domain (`onboarding@resend.dev`) via an env var, so switching to a real domain later is a one-line config change, not a code change.
- A failed or slow email send never blocks or breaks account creation — signup succeeds and redirects exactly as it does today regardless of email outcome.
- The structure supports adding more email types later (password reset, admin notifications, etc.) as new files in the same domain folder, without a redesign.

## Non-goals

- No email verification / confirm-your-email flow — accounts remain immediately usable after signup, unchanged from today.
- No email templating system (React Email components, MJML, etc.) for a single simple email — plain HTML/text content is enough until there are enough email types to justify one.
- No retry queue or delivery-failure handling beyond logging server-side.
- No change to `login`, `logout`, or the registrations-open gate.

## Architecture

New domain folder `src/lib/server/email/`, matching the pattern of `admin/`, `workouts/`, `exercises/`, `users/`:

- `client.ts` — `import "server-only"`; exports a single `resend` client (`new Resend(process.env.RESEND_API_KEY)`), with a fail-fast check that `RESEND_API_KEY` is set (matching the existing pattern in `db.ts`/`session.ts` for required env vars).
- `send-welcome-email.ts` — `import "server-only"`; exports `sendWelcomeEmail(to: string, name: string): Promise<void>`, calling `resend.emails.send({ from: process.env.RESEND_FROM_EMAIL, to, subject, html })` with a short welcome message, catching and logging (not re-throwing) any error from the send call.

**Env vars**: `RESEND_API_KEY` (the API key), `RESEND_FROM_EMAIL` (defaults conceptually to `onboarding@resend.dev` for now, set explicitly in `.env.local`).

**Signup integration**: in the `signup` Server Action, after `createSessionCookie` succeeds, call `sendWelcomeEmail(email, name)` **without awaiting it** before `redirect()` — so a slow or failed send cannot delay or block the redirect. Any error is caught inside `sendWelcomeEmail` itself (per the architecture above), never propagating to `signup`.

**Setup dependency worth flagging explicitly**: Resend's shared test domain (`onboarding@resend.dev`) may restrict delivery to only the Resend account's own verified email address until a real sending domain is verified — this needs to be confirmed against Resend's current documentation during implementation, since it directly determines whether real users' welcome emails will actually arrive versus only working for the developer's own test signups. If confirmed restricted, the practical implication (documented in the plan, not a code change) is: the feature will work end-to-end for testing today, and will start working for all real users the moment a real domain is verified later.

## Testing

No new pure logic worth unit-testing here (a thin API call wrapper, not business logic). Verification is: sign up with a real test account and confirm the welcome email is received (or, if the sandbox-domain restriction above applies, confirm it's received when signing up with the Resend account's own email, and confirm signup still succeeds normally when signing up with a different email that the sandbox can't deliver to — proving the fire-and-forget non-blocking behavior).
