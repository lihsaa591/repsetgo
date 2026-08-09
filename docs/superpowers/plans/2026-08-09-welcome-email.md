# Registration Welcome Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a simple welcome email via Resend after a new user signs up, without ever blocking or breaking account creation if the email fails or is slow.

**Architecture:** A new `src/lib/server/email/` domain (client + one send function), called fire-and-forget from the existing `signup` Server Action.

**Tech Stack:** `resend` npm package — no other new dependencies.

## Global Constraints

- `sendWelcomeEmail` catches and logs its own errors internally — it must never throw out to its caller.
- `signup` calls `sendWelcomeEmail` without `await`, and the call must happen **before** `redirect("/dashboard")` — `redirect()` throws internally to abort the response, so any code placed after it in the function never executes at all. "Fire-and-forget" means "don't await it," not "put it after redirect."
- No email verification/confirm-link flow — accounts stay immediately usable after signup, exactly as today.
- `login`, `logout`, and the registrations-open gate in `signup` are not modified beyond adding the one new call.
- A real `.env.local` in this project already has `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (set to `onboarding@resend.dev`) filled in — do not read, print, or modify their values.

---

### Task 1: Email domain — client and welcome-email sender

**Files:**
- Create: `src/lib/server/email/client.ts`
- Create: `src/lib/server/email/send-welcome-email.ts`
- Modify: `package.json` (add `resend` dependency)

**Interfaces:**
- Produces: `resend` (Resend client instance) from `client.ts`; `sendWelcomeEmail(to: string, name: string): Promise<void>` from `send-welcome-email.ts` — consumed by `auth/actions.ts`'s `signup` (Task 2).

- [ ] **Step 1: Install the dependency**

Run: `npm install resend`

- [ ] **Step 2: Create the client**

```ts
// src/lib/server/email/client.ts
import "server-only";
import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not set");
}

export const resend = new Resend(process.env.RESEND_API_KEY);
```

This matches the existing fail-fast pattern for required env vars already used in `src/lib/server/db.ts` and `src/lib/server/auth/session.ts`.

- [ ] **Step 3: Create the welcome-email sender**

```ts
// src/lib/server/email/send-welcome-email.ts
import "server-only";
import { resend } from "./client";

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to,
      subject: "Welcome to RepSetGo",
      html: `
        <p>Hi ${name},</p>
        <p>Welcome to RepSetGo! Your account is ready — log your first workout whenever you're set.</p>
      `,
    });
  } catch (error) {
    // A failed email send should never break signup — log and move on.
    console.error("Failed to send welcome email:", error);
  }
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/server/email/
git commit -m "feat: add email domain with a welcome-email sender via Resend"
```

---

### Task 2: Wire the welcome email into signup

**Files:**
- Modify: `src/lib/server/auth/actions.ts`

**Interfaces:**
- Consumes: `sendWelcomeEmail` (`@/lib/server/email/send-welcome-email`, Task 1).

- [ ] **Step 1: Add the import and the call**

Read the current file first to confirm its exact structure (it already has the registrations-open gate and the rest of `signup`, plus `login`/`logout` untouched). Add one import and one line, in this exact position — after `createSessionCookie`, before `redirect`:

```ts
// src/lib/server/auth/actions.ts — add this import near the top,
// alongside the existing @/lib/server/admin/* imports:
import { sendWelcomeEmail } from "@/lib/server/email/send-welcome-email";
```

```ts
// within signup(), replace this:
  await createSessionCookie({ userId: user.id, role: user.role });
  redirect("/dashboard");

// with this (note: no `await` on sendWelcomeEmail — it must still be
// called before redirect(), since redirect() throws internally and
// nothing after it in this function ever runs):
  await createSessionCookie({ userId: user.id, role: user.role });
  sendWelcomeEmail(email, name);
  redirect("/dashboard");
```

Do not modify `login` or `logout`.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify against the real Resend account**

Sign up with a real (temporary) test account through the actual running app (`npm run dev`), using an email address you can check — per the design spec, Resend's shared test domain may only deliver to the Resend account's own verified email address until a real domain is verified, so use that same email if that restriction applies (check Resend's current dashboard/docs for this during testing — if signing up with a different email doesn't deliver, that's the expected sandbox restriction, not a bug). Confirm: (a) the welcome email arrives (or, if testing with a non-sandbox-eligible address, confirm no error is thrown and signup still redirects to `/dashboard` normally — proving the fire-and-forget behavior), and (b) check the terminal running `npm run dev` for a `console.error` if the send failed, confirming errors are caught and logged rather than propagating. Clean up the test account afterward (delete via the admin panel or `promote-admin`-adjacent DB access, consistent with how test accounts were cleaned up in prior work on this project).

- [ ] **Step 4: Run the full test suite and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all clean — this change has no pure-logic component to unit test, and no other code path depends on `signup`'s timing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/auth/actions.ts
git commit -m "feat: send a welcome email on signup"
```

---

## Self-Review Notes

- **Spec coverage:** email domain structure → Task 1; fire-and-forget call correctly placed before `redirect()` (a real gotcha, explicitly called out) → Task 2; errors caught/logged, never propagating → Task 1 Step 3; no changes to login/logout/registrations-gate → Task 2 Step 1's explicit instruction; sandbox-domain restriction flagged for verification, not silently assumed → Task 2 Step 3.
- **Placeholder scan:** none found.
- **Type consistency check:** `sendWelcomeEmail(to: string, name: string): Promise<void>` (Task 1) matches its call site `sendWelcomeEmail(email, name)` in Task 2 — `email`/`name` are already destructured as strings from `validated.data` earlier in `signup`.
