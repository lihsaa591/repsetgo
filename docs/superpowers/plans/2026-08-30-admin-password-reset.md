# Admin-Initiated Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin reset any user's password to a random temp password (shown once), force that user to set a new password on next login, and give every user a self-service "change password" option in Settings.

**Architecture:** One new boolean column (`mustChangePassword`) drives a redirect gate in `proxy.ts`. A single `changePassword` server action serves both the forced flow and normal self-service Settings use. Admin gets a new `resetUserPassword` action following the exact guard/dialog pattern already used by `deleteUser`/`setUserActive` in this codebase.

**Tech Stack:** Next.js Server Actions, Drizzle ORM (`drizzle-orm/neon-http`), Zod, `jose` (session JWT), `bcryptjs`, Node's built-in `crypto`, Vitest.

## Global Constraints

- Password rule (from the spec, matches existing `SignupSchema.password`): minimum 8 characters, at least one letter, at least one number.
- No email notification of the reset — Resend's shared domain can't reach real users (confirmed via direct API test: `403 validation_error`).
- No "current password" field on the change-password form — `verifySession()` is the trust boundary, same as every other authenticated action in this codebase.
- No rate-limiting, no password history/reuse checks — matches the rest of the app's current auth.
- No test-library setup exists in this codebase (no `@testing-library`, no `.test.tsx` files) — only Vitest node-environment tests for pure logic (validation, session, guards). UI/route-gating tasks are verified manually in a running dev server, matching how every prior UI feature in this codebase (dropset tracking, admin user lifecycle, etc.) was verified.

---

### Task 1: `mustChangePassword` schema column + migration

**Files:**
- Modify: `src/lib/server/auth/schema.ts`
- Create: a new file in `drizzle/` (auto-named by `drizzle-kit generate` — note its actual filename after running the command, it'll look like `drizzle/000N_<adjective>_<noun>.sql`)

**Interfaces:**
- Produces: `users.mustChangePassword: boolean` column, and the corresponding `User`/`NewUser` Drizzle types (from `src/lib/server/auth/schema.ts`) gain a `mustChangePassword: boolean` field — every later task that selects/inserts full `users` rows sees this field for free.

- [ ] **Step 1: Add the column to the schema**

In `src/lib/server/auth/schema.ts`, add `mustChangePassword` right after the existing `isActive` field:

```ts
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
```

- [ ] **Step 2: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new `drizzle/000N_<name>.sql` file containing `ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;`, and `drizzle/meta/` gains a matching snapshot/journal entry.

- [ ] **Step 3: Apply the migration to your local dev database**

Run: `npx drizzle-kit migrate`
Expected: `[✓] migrations applied successfully!`

- [ ] **Step 4: Verify the column exists**

Run: `npx tsc --noEmit`
Expected: no errors (this confirms the Drizzle-inferred `User`/`NewUser` types picked up the new field without breaking any existing call site).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/auth/schema.ts drizzle/
git commit -m "feat: add mustChangePassword column to users"
```

---

### Task 2: `ChangePasswordSchema` validation

**Files:**
- Modify: `src/lib/server/auth/validation.ts`
- Create: `src/lib/server/auth/validation.test.ts`

**Interfaces:**
- Consumes: nothing new (pure Zod, same style as the existing `SignupSchema`/`LoginSchema` in this file).
- Produces: `ChangePasswordSchema: ZodSchema<{ password: string; confirmPassword: string }>` and `type ChangePasswordFormState = { errors?: Record<string, string[]>; message?: string } | undefined`, both exported from `src/lib/server/auth/validation.ts`. Task 3 imports both.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/server/auth/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ChangePasswordSchema } from "./validation";

describe("ChangePasswordSchema", () => {
  it("accepts a valid matching password pair", () => {
    const result = ChangePasswordSchema.safeParse({
      password: "newpass123",
      confirmPassword: "newpass123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = ChangePasswordSchema.safeParse({
      password: "abc123",
      confirmPassword: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no letter", () => {
    const result = ChangePasswordSchema.safeParse({
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no number", () => {
    const result = ChangePasswordSchema.safeParse({
      password: "abcdefgh",
      confirmPassword: "abcdefgh",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when password and confirmPassword don't match", () => {
    const result = ChangePasswordSchema.safeParse({
      password: "newpass123",
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/server/auth/validation.test.ts`
Expected: FAIL — `ChangePasswordSchema` is not exported from `./validation`.

- [ ] **Step 3: Implement the schema**

In `src/lib/server/auth/validation.ts`, add below the existing `LoginSchema`:

```ts
export const ChangePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Be at least 8 characters long.")
      .regex(/[a-zA-Z]/, "Contain at least one letter.")
      .regex(/[0-9]/, "Contain at least one number."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/server/auth/validation.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/auth/validation.ts src/lib/server/auth/validation.test.ts
git commit -m "feat: add ChangePasswordSchema validation"
```

---

### Task 3: Session payload gains `mustChangePassword`

**Files:**
- Modify: `src/lib/server/auth/session.ts`
- Modify: `src/lib/server/auth/session.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SessionPayload` becomes `{ userId: number; role: "admin" | "user"; mustChangePassword: boolean }`. Every caller of `encrypt`/`createSessionCookie` must now pass this field — Tasks 4 and 7 both construct `SessionPayload` values.

- [ ] **Step 1: Write the failing test**

In `src/lib/server/auth/session.test.ts`, replace the existing "round-trips a valid payload" test with one that includes the new field, and add a rejection test:

```ts
  it("round-trips a valid payload", async () => {
    const token = await encrypt(
      { userId: 42, role: "user", mustChangePassword: false },
      24 * 60 * 60 * 1000
    );
    const payload = await decrypt(token);
    expect(payload).toEqual(
      expect.objectContaining({ userId: 42, role: "user", mustChangePassword: false })
    );
  });

  it("returns null when mustChangePassword is missing from the token payload", async () => {
    // Simulates a token signed before this field existed.
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.SESSION_SECRET);
    const staleToken = await new SignJWT({ userId: 42, role: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor((Date.now() + 60_000) / 1000))
      .sign(key);
    const payload = await decrypt(staleToken);
    expect(payload).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/server/auth/session.test.ts`
Expected: FAIL — `mustChangePassword` isn't part of `SessionPayload` yet, and `decrypt` doesn't reject its absence, so the second new test fails (a stale token is accepted when it shouldn't be).

- [ ] **Step 3: Implement the session payload change**

In `src/lib/server/auth/session.ts`:

```ts
export type SessionPayload = {
  userId: number;
  role: "admin" | "user";
  mustChangePassword: boolean;
};
```

And in `decrypt`, extend the validation block:

```ts
    if (
      typeof payload.userId !== "number" ||
      (payload.role !== "admin" && payload.role !== "user") ||
      typeof payload.mustChangePassword !== "boolean"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      role: payload.role,
      mustChangePassword: payload.mustChangePassword,
    };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/server/auth/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix the two existing `createSessionCookie` call sites**

Run: `npx tsc --noEmit`
Expected: two errors — `src/lib/server/auth/actions.ts` calls `createSessionCookie` in `signup` and `login` without `mustChangePassword`. Fix both:

In `signup` (`src/lib/server/auth/actions.ts`), change:
```ts
  await createSessionCookie({ userId: user.id, role: user.role });
```
to:
```ts
  await createSessionCookie({ userId: user.id, role: user.role, mustChangePassword: false });
```

In `login` (`src/lib/server/auth/actions.ts`), change:
```ts
  await createSessionCookie({ userId: user.id, role: user.role }, rememberMe);
```
to:
```ts
  await createSessionCookie(
    { userId: user.id, role: user.role, mustChangePassword: user.mustChangePassword },
    rememberMe
  );
```

Run: `npx tsc --noEmit` again.
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests pass (previous count plus the new session tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/auth/session.ts src/lib/server/auth/session.test.ts src/lib/server/auth/actions.ts
git commit -m "feat: carry mustChangePassword in the session JWT"
```

---

### Task 4: `changePassword` server action

**Files:**
- Create: `src/lib/server/auth/password-actions.ts`

**Interfaces:**
- Consumes: `verifySession()` and `createSessionCookie()` (`src/lib/server/auth/dal.ts` and `./session.ts`), `ChangePasswordSchema`/`ChangePasswordFormState` (Task 2), `users` table (`./schema.ts`), `db` (`@/lib/server/db`).
- Produces: `changePassword(prevState: ChangePasswordFormState, formData: FormData): Promise<ChangePasswordFormState>`, a Server Action. Task 5's form and Task 6's Settings section both call this directly by name.

- [ ] **Step 1: Implement the action**

Create `src/lib/server/auth/password-actions.ts`:

```ts
"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { users } from "./schema";
import { verifySession } from "./dal";
import { createSessionCookie } from "./session";
import { ChangePasswordSchema, type ChangePasswordFormState } from "./validation";

export async function changePassword(
  _prevState: ChangePasswordFormState,
  formData: FormData
): Promise<ChangePasswordFormState> {
  const session = await verifySession();

  const validated = ChangePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const passwordHash = await bcrypt.hash(validated.data.password, 10);

  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(users.id, session.userId));

  await createSessionCookie({
    userId: session.userId,
    role: session.role,
    mustChangePassword: false,
  });

  redirect("/dashboard");
}
```

This has no automated test — it's a thin wire-up over already-tested pieces (`ChangePasswordSchema` in Task 2, `bcrypt.hash`/`createSessionCookie` used identically elsewhere in this codebase) plus a DB write and a redirect, none of which this codebase's test setup (Vitest, node environment, no DB test harness) can exercise. It's verified manually in Task 8.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/auth/password-actions.ts
git commit -m "feat: add changePassword server action"
```

---

### Task 5: Forced redirect gate in `proxy.ts`

**Files:**
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `session.mustChangePassword` (Task 3).
- Produces: any request from a session with `mustChangePassword: true` is redirected to `/change-password` unless it's already headed there.

- [ ] **Step 1: Add the redirect check**

In `src/proxy.ts`, after the existing `isAdminRoute` check and before `return NextResponse.next();`, add:

```ts
  if (session?.mustChangePassword && path !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", req.nextUrl));
  }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat: force redirect to /change-password when required"
```

(Manual verification of the actual redirect behavior happens in Task 8, once Task 6 gives `/change-password` somewhere to land.)

---

### Task 6: Change-password form + page + Settings integration

**Files:**
- Create: `src/components/change-password-form.tsx`
- Create: `src/app/change-password/page.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `changePassword` (Task 4), UI primitives already used elsewhere in this codebase: `Card`/`CardContent`/`CardHeader`/`CardTitle` (`@/components/ui/card`), `Label`/`Input`/`Button` (`@/components/ui/label`, `.../input`, `.../button`), same `useActionState` pattern as `AccountSettingsForm`.
- Produces: `ChangePasswordForm` (default export from `src/components/change-password-form.tsx`), a client component with no required props, used by both this task's `/change-password/page.tsx` and the Settings page.

- [ ] **Step 1: Create the shared form component**

Create `src/components/change-password-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { changePassword } from "@/lib/server/auth/password-actions";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" required />
            {state?.errors?.password && (
              <p className="text-xs text-destructive" role="alert">
                {state.errors.password[0]}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
            />
            {state?.errors?.confirmPassword && (
              <p className="text-xs text-destructive" role="alert">
                {state.errors.confirmPassword[0]}
              </p>
            )}
          </div>
          {state?.message && (
            <p className="text-xs text-destructive" role="alert">
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create the standalone page**

Create `src/app/change-password/page.tsx`:

```tsx
import ChangePasswordForm from "@/components/change-password-form";

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          You need to set a new password before continuing.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
```

- [ ] **Step 3: Add it to Settings**

In `src/app/(app)/settings/page.tsx`, import and render it below the existing form:

```tsx
import { getCurrentUser } from "@/lib/server/auth/dal";
import { AccountSettingsForm } from "./account-settings-form";
import ChangePasswordForm from "@/components/change-password-form";

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Account Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile and preferences
        </p>
      </div>
      <AccountSettingsForm user={user} />
      <ChangePasswordForm />
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/change-password-form.tsx src/app/change-password/page.tsx "src/app/(app)/settings/page.tsx"
git commit -m "feat: add change-password form, page, and Settings integration"
```

(Manual verification in Task 8.)

---

### Task 7: Admin `resetUserPassword` action

**Files:**
- Modify: `src/lib/server/admin/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin()` (`@/lib/server/auth/dal`), `users` table (`@/lib/server/auth/schema`), `db` (`@/lib/server/db`), Node's `crypto.randomBytes`, `bcrypt.hash`.
- Produces: `resetUserPassword(prevState: ResetPasswordState, formData: FormData): Promise<ResetPasswordState>` where `type ResetPasswordState = { error: string } | { tempPassword: string } | undefined`, exported from `src/lib/server/admin/actions.ts`. Task 8's UI imports both.

- [ ] **Step 1: Implement the action**

In `src/lib/server/admin/actions.ts`, add the import at the top:

```ts
import { randomBytes } from "crypto";
```

And add the action (after `createUserAsAdmin`, before `setUserActive` — grouping it with the other per-user mutations):

```ts
export type ResetPasswordState = { error: string } | { tempPassword: string } | undefined;

function generateTempPassword(): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomBytes(9).toString("base64url");
    if (/[a-zA-Z]/.test(candidate) && /[0-9]/.test(candidate)) {
      return candidate;
    }
  }
  // Astronomically unlikely with a 12-character base64url string, but fall
  // back to a value guaranteed to satisfy the rule rather than loop forever.
  return `Aa1${randomBytes(9).toString("base64url")}`;
}

export async function resetUserPassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  await requireAdmin();

  const targetUserId = Number(formData.get("userId"));
  if (!Number.isInteger(targetUserId)) {
    return { error: "Invalid request." };
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!target) {
    return { error: "That user no longer exists." };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: true })
    .where(eq(users.id, targetUserId));

  return { tempPassword };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/admin/actions.ts
git commit -m "feat: add admin resetUserPassword action"
```

---

### Task 8: Admin UI — "Reset password" row control, and end-to-end manual verification

**Files:**
- Modify: `src/app/admin/users-list.tsx`

**Interfaces:**
- Consumes: `resetUserPassword`/`ResetPasswordState` (Task 7).
- Produces: a "Reset password" icon button per row in the admin users table.

- [ ] **Step 1: Add the import**

In `src/app/admin/users-list.tsx`, extend the existing imports:

```ts
import { setUserRole, setUserActive, deleteUser, resetUserPassword } from "@/lib/server/admin/actions";
import { KeyRound, Copy, Check } from "lucide-react";
```

(`Loader2` and `Trash2` are already imported — add the three new icons alongside them in the same `lucide-react` import line rather than a second line.)

- [ ] **Step 2: Add the control to the row actions**

In the table row's action cell, alongside the existing `DeleteUserControl`/`RoleControl`:

```tsx
                    <div className="flex items-center justify-end gap-1">
                      <ResetPasswordControl userId={user.id} userName={user.name} />
                      <DeleteUserControl
                        userId={user.id}
                        userName={user.name}
                        isSelf={user.id === currentUserId}
                        totalLogs={user.totalLogs}
                        customExerciseCount={user.customExerciseCount}
                      />
                      <RoleControl
                        userId={user.id}
                        currentRole={user.role}
                        isSelf={user.id === currentUserId}
                      />
                    </div>
```

- [ ] **Step 3: Implement the component**

Add at the end of the file, alongside the other row-control components:

```tsx
function ResetPasswordControl({
  userId,
  userName,
}: {
  userId: number;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [state, action, pending] = useActionState(resetUserPassword, undefined);

  useEffect(() => {
    if (state && "tempPassword" in state) {
      setRevealed(state.tempPassword);
    }
  }, [state]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setRevealed(null);
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="ghost"
        size="icon"
        title="Reset password"
        onClick={() => setOpen(true)}
      >
        <KeyRound className="h-3.5 w-3.5" />
        <span className="sr-only">Reset password</span>
      </Button>
      <DialogContent>
        {revealed ? (
          <>
            <DialogHeader>
              <DialogTitle>New password for {userName}</DialogTitle>
              <DialogDescription>
                This won&apos;t be shown again — copy it now and share it with
                them directly.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-2 py-1.5 text-sm">
                {revealed}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(revealed);
                  setCopied(true);
                }}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reset {userName}&apos;s password?</DialogTitle>
              <DialogDescription>
                They&apos;ll need a new password from you to log in — this
                generates one for you to share with them.
              </DialogDescription>
            </DialogHeader>
            <form action={action}>
              <input type="hidden" name="userId" value={userId} />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Resetting..." : "Reset password"}
                </Button>
              </DialogFooter>
            </form>
            {state && "error" in state && (
              <p className="text-xs text-destructive" role="alert">
                {state.error}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full automated test suite**

Run: `npm test`
Expected: all tests pass (unchanged from Task 3's count — this task adds no new automated tests, only UI).

- [ ] **Step 6: Manual end-to-end verification in a running dev server**

This is the only way to verify the full flow in this codebase (no component/integration test harness exists here). Run `npm run dev`, then in a browser:

1. Log in as an admin, go to `/admin`.
2. Click "Reset password" on a non-admin test user's row → confirm the dialog → verify a password is shown, copy it, click "Done".
3. Re-open the same dialog for the same user → confirm it shows the "Reset {name}'s password?" confirm view again, not a stale password from the previous reset (this checks the `handleOpenChange` reset logic from Step 3).
4. Log out, log in as that test user with the temp password.
5. Verify you land on `/change-password`, not `/dashboard`.
6. Try navigating directly to `/dashboard`, `/history`, `/settings` — verify each redirects back to `/change-password` (checks Task 5's proxy gate).
7. Submit a new password on `/change-password` — verify it redirects to `/dashboard` and you can now navigate anywhere without being redirected.
8. Log out, log back in with the *new* password — verify it works and does not redirect to `/change-password` again.
9. As a user who was never reset, go to `/settings`, use the new "Change password" card to set a different password, verify it works with no forced redirect involved.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/users-list.tsx
git commit -m "feat: add admin reset-password UI"
```

---

## Self-Review Notes

- **Spec coverage:** schema column (Task 1), admin action (Task 7), admin UI with two-stage dialog (Task 8), session payload + login wiring (Task 3), route gating (Task 5), reusable change-password action (Task 4), change-password page + Settings integration (Task 6), no-email-notification / no-rate-limiting / no-password-history (explicitly called out as non-goals, nothing implements them) — every spec section maps to a task.
- **Placeholder scan:** no TBDs; every code block is complete, runnable code with exact imports.
- **Type consistency:** `SessionPayload` (Task 3) is `{ userId, role, mustChangePassword }` everywhere it's constructed (Tasks 3, 4, 7 call sites all match). `ResetPasswordState` (Task 7) and its `"tempPassword" in state` / `"error" in state` narrowing (Task 8) match. `ChangePasswordFormState`/`ChangePasswordSchema` (Task 2) match their use in Task 4 and the `state?.errors?.password` / `state?.errors?.confirmPassword` access in Task 6.
