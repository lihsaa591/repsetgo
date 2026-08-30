# Request Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a locked-out user signal "I need a password reset" from the login page without any working outbound email — a public form takes their email, and if it matches a real account, that user's row in `/admin` gets a "reset requested" indicator that clears when an admin resets their password.

**Architecture:** One nullable timestamp column (`passwordResetRequestedAt`) on `users`. A new public server action sets it (always returning the same generic message regardless of whether the email matched, to avoid account enumeration). The existing `resetUserPassword` admin action clears it as part of its existing update. The admin users table renders it as a small relative-time badge.

**Tech Stack:** Next.js Server Actions, Drizzle ORM (`drizzle-orm/neon-http`), Zod, Vitest.

## Global Constraints

- No outbound email anywhere in this feature (Resend can't reach real users yet).
- The public request-reset action must return the **same message** whether or not the email is registered — the only response that may legitimately differ is a malformed-email validation error (that's about input format, not account existence).
- No rate-limiting, no reset tokens/links, no request history — a single nullable timestamp per user, consistent with the rest of this app's auth having no rate-limiting.
- No component/integration test harness exists in this codebase (only Vitest node-environment tests for pure logic) — UI tasks are verified manually in a running dev server.

---

### Task 1: `passwordResetRequestedAt` schema column + migration

**Files:**
- Modify: `src/lib/server/auth/schema.ts`
- Modify: `src/lib/server/auth/dal.ts`
- Create: a new file in `drizzle/` (auto-named by `drizzle-kit generate`)

**Interfaces:**
- Produces: `users.passwordResetRequestedAt: Date | null` on the Drizzle-inferred `User`/`NewUser` types.

- [ ] **Step 1: Add the column to the schema**

In `src/lib/server/auth/schema.ts`, add right after `mustChangePassword`:

```ts
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  passwordResetRequestedAt: timestamp("password_reset_requested_at"),
```

(No `.notNull()`, no default — this is nullable; `null` means no pending request.)

- [ ] **Step 2: Generate and apply the migration**

Run: `npx drizzle-kit generate`
Expected: a new `drizzle/000N_<name>.sql` containing `ALTER TABLE "users" ADD COLUMN "password_reset_requested_at" timestamp;`

Run: `DATABASE_URL=$(grep "^DATABASE_URL=" .env.local | cut -d= -f2-) npx drizzle-kit migrate`
Expected: `[✓] migrations applied successfully!`

- [ ] **Step 3: Update `safeUserColumns` in `dal.ts`**

`src/lib/server/auth/dal.ts` has a manual column-projection object (`safeUserColumns`) that must list every `User` column except `passwordHash`, or `SafeUser` (`Omit<User, "passwordHash">`) stops type-checking. Add the new column there, in the same relative position as in the schema (right after `mustChangePassword`):

```ts
  mustChangePassword: users.mustChangePassword,
  passwordResetRequestedAt: users.passwordResetRequestedAt,
```

- [ ] **Step 4: Type-check**

Run: `DATABASE_URL=$(grep "^DATABASE_URL=" .env.local | cut -d= -f2-) npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the existing test suite**

Run: `npm test`
Expected: all existing tests still pass (this task adds none).

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/auth/schema.ts src/lib/server/auth/dal.ts drizzle/
git commit -m "feat: add passwordResetRequestedAt column to users"
```

---

### Task 2: `RequestPasswordResetSchema` validation

**Files:**
- Modify: `src/lib/server/auth/validation.ts`
- Modify: `src/lib/server/auth/validation.test.ts`

**Interfaces:**
- Produces: `RequestPasswordResetSchema: ZodSchema<{ email: string }>` and `type RequestPasswordResetFormState = { errors?: Record<string, string[]>; message?: string } | undefined`, both exported from `src/lib/server/auth/validation.ts`. Task 3 imports both.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/server/auth/validation.test.ts` (add the import alongside the existing one, and a new `describe` block):

```ts
import { ChangePasswordSchema, RequestPasswordResetSchema } from "./validation";
```

```ts
describe("RequestPasswordResetSchema", () => {
  it("accepts a valid email", () => {
    const result = RequestPasswordResetSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = RequestPasswordResetSchema.safeParse({
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/server/auth/validation.test.ts`
Expected: FAIL — `RequestPasswordResetSchema` is not exported from `./validation`.

- [ ] **Step 3: Implement the schema**

In `src/lib/server/auth/validation.ts`, add below `ChangePasswordSchema`:

```ts
export const RequestPasswordResetSchema = z.object({
  email: z.string().trim().email("Please enter a valid email."),
});

export type RequestPasswordResetFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/server/auth/validation.test.ts`
Expected: PASS, all tests green (the existing `ChangePasswordSchema` tests plus these 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/auth/validation.ts src/lib/server/auth/validation.test.ts
git commit -m "feat: add RequestPasswordResetSchema validation"
```

---

### Task 3: `requestPasswordReset` server action

**Files:**
- Modify: `src/lib/server/auth/password-actions.ts`

**Interfaces:**
- Consumes: `RequestPasswordResetSchema`/`RequestPasswordResetFormState` (Task 2), `db` (`@/lib/server/db`), `users` (`./schema`), `eq` (already imported from `drizzle-orm` in this file).
- Produces: `requestPasswordReset(prevState: RequestPasswordResetFormState, formData: FormData): Promise<RequestPasswordResetFormState>`, a Server Action. Task 4 imports it directly by name.

- [ ] **Step 1: Implement the action**

In `src/lib/server/auth/password-actions.ts`, add the import:

```ts
import {
  ChangePasswordSchema,
  type ChangePasswordFormState,
  RequestPasswordResetSchema,
  type RequestPasswordResetFormState,
} from "./validation";
```

(replacing the existing single-item import line for `ChangePasswordSchema`/`ChangePasswordFormState`)

And add the action at the end of the file:

```ts
export async function requestPasswordReset(
  _prevState: RequestPasswordResetFormState,
  formData: FormData
): Promise<RequestPasswordResetFormState> {
  const validated = RequestPasswordResetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, validated.data.email));

  if (user) {
    await db
      .update(users)
      .set({ passwordResetRequestedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  // Same message whether or not the email matched an account — this must
  // never branch on `user` being found, or the form becomes a way to check
  // which emails are registered.
  return {
    message: "If that email is registered, an admin has been notified.",
  };
}
```

- [ ] **Step 2: Type-check**

Run: `DATABASE_URL=$(grep "^DATABASE_URL=" .env.local | cut -d= -f2-) npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/auth/password-actions.ts
git commit -m "feat: add requestPasswordReset server action"
```

---

### Task 4: Login page "Forgot password?" dialog

**Files:**
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `requestPasswordReset` (Task 3), `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` (`@/components/ui/dialog`, already used elsewhere in this codebase e.g. `src/app/admin/users-list.tsx`).

- [ ] **Step 1: Replace the file**

Replace the full contents of `src/app/login/page.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { useActionState, useState } from "react";
import { login } from "@/lib/server/auth/actions";
import { requestPasswordReset } from "@/lib/server/auth/password-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  // Controlled inputs: React resets uncontrolled fields to blank after any
  // form action completes (success or failure), which would wipe what the
  // user typed the moment a validation error appears. Tracking values in
  // state keeps them in place across that reset.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [resetOpen, setResetOpen] = useState(false);
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordReset,
    undefined
  );

  function handleResetOpenChange(open: boolean) {
    setResetOpen(open);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[38rem] flex-col justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Dumbbell className="h-7 w-7" />
        </div>
        <span className="text-xl font-semibold">RepSetGo</span>
        <p className="text-sm text-muted-foreground">Simple, fast gym logging.</p>
      </div>
      <Card className="[--card-spacing:--spacing(8)]">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {state?.errors?.email && (
                <p className="text-xs text-destructive">{state.errors.email[0]}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {state?.errors?.password && (
                <p className="text-xs text-destructive">{state.errors.password[0]}</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox id="rememberMe" name="rememberMe" value="on" />
                <Label htmlFor="rememberMe" className="cursor-pointer font-normal text-muted-foreground">
                  Remember me
                </Label>
              </div>
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
            {state?.message && (
              <p className="text-xs text-destructive">{state.message}</p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Logging in..." : "Log in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={handleResetOpenChange}>
        <DialogContent>
          {resetState?.message ? (
            <>
              <DialogHeader>
                <DialogTitle>Check with your admin</DialogTitle>
                <DialogDescription>{resetState.message}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" onClick={() => setResetOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Request a password reset</DialogTitle>
                <DialogDescription>
                  Enter your account email. An admin will be notified and can
                  reset your password for you.
                </DialogDescription>
              </DialogHeader>
              <form action={resetAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="resetEmail">Email</Label>
                  <Input id="resetEmail" name="email" type="email" required />
                  {resetState?.errors?.email && (
                    <p className="text-xs text-destructive">
                      {resetState.errors.email[0]}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setResetOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={resetPending}>
                    {resetPending ? "Submitting..." : "Submit"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `DATABASE_URL=$(grep "^DATABASE_URL=" .env.local | cut -d= -f2-) npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add forgot-password dialog to login page"
```

(Manual verification of the actual dialog flow happens in Task 5, once the admin side exists to check against.)

---

### Task 5: Admin — surface and clear pending reset requests, and end-to-end manual verification

**Files:**
- Modify: `src/lib/server/admin/queries.ts`
- Modify: `src/lib/server/admin/actions.ts`
- Modify: `src/app/admin/users-list.tsx`

**Interfaces:**
- Consumes: `passwordResetRequestedAt` column (Task 1).
- Produces: `AdminUserRow.passwordResetRequestedAt: string | null`, and a visible badge on any row where it's set.

- [ ] **Step 1: Add the field to `AdminUserRow` and the query**

In `src/lib/server/admin/queries.ts`, add to the `AdminUserRow` type:

```ts
  customExerciseCount: number;
  passwordResetRequestedAt: string | null;
```

Add to the `allUsers` select (inside `getAllUsersWithStats`):

```ts
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      passwordResetRequestedAt: users.passwordResetRequestedAt,
    })
```

Add to the returned mapping:

```ts
      customExerciseCount: userExerciseStats?.customExerciseCount ?? 0,
      passwordResetRequestedAt: user.passwordResetRequestedAt
        ? user.passwordResetRequestedAt.toISOString()
        : null,
```

- [ ] **Step 2: Clear the flag when an admin resets the password**

In `src/lib/server/admin/actions.ts`, in `resetUserPassword`, change:

```ts
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: true })
    .where(eq(users.id, targetUserId));
```

to:

```ts
  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: true, passwordResetRequestedAt: null })
    .where(eq(users.id, targetUserId));
```

- [ ] **Step 3: Show the badge in the admin users table**

In `src/app/admin/users-list.tsx`, add this helper function near the existing `initials()` helper:

```ts
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

In the row rendering (inside the `pagedUsers.map` in the main `UsersList` component), change:

```tsx
                      <div>
                        <p className="font-medium leading-none">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
```

to:

```tsx
                      <div>
                        <p className="font-medium leading-none">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        {user.passwordResetRequestedAt && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            Reset requested {timeAgo(user.passwordResetRequestedAt)}
                          </Badge>
                        )}
                      </div>
```

- [ ] **Step 4: Type-check**

Run: `DATABASE_URL=$(grep "^DATABASE_URL=" .env.local | cut -d= -f2-) npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full automated test suite**

Run: `npm test`
Expected: all tests pass (unchanged count from Task 2 — this task adds no new automated tests).

- [ ] **Step 6: Manual end-to-end verification in a running dev server**

Run `npm run dev`, then in a browser:

1. Go to `/login`, click "Forgot password?", submit a real registered user's email. Verify the dialog swaps to the generic confirmation message.
2. Repeat with an email that doesn't belong to any account. Verify the exact same confirmation message appears (this is the core security property of this feature — check it explicitly, don't skip it).
3. Log in as an admin, go to `/admin`. Verify the user from step 1 now shows a "Reset requested Xm ago" badge under their name/email; verify the user that was never requested (or any other user) shows no badge.
4. Click "Reset password" for that flagged user and confirm the reset. Verify the badge disappears from their row afterward (the page revalidates via the existing `revalidatePath("/admin")` inside... actually `resetUserPassword` doesn't currently call `revalidatePath` — check whether the badge updates without a manual refresh; if it doesn't, that's expected given the existing action's behavior, and a manual page reload is an acceptable way to confirm the DB-level clear happened).
5. Submit an obviously malformed email (e.g. "not-an-email") into the forgot-password dialog and confirm it shows a validation error instead of the generic success message.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/admin/queries.ts src/lib/server/admin/actions.ts src/app/admin/users-list.tsx
git commit -m "feat: surface and clear pending password-reset requests in admin"
```

---

## Self-Review Notes

- **Spec coverage:** schema column (Task 1), validation with generic-message guarantee (Tasks 2-3), login page entry point (Task 4), admin badge + auto-clear-on-reset (Task 5) — every spec section maps to a task. The non-goals (no email, no tokens, no rate-limiting, no history) are honored by omission — no task introduces any of them.
- **Placeholder scan:** no TBDs; every code block is complete, runnable code with exact imports. Step 6.4's note about `revalidatePath` is an honest caveat about existing behavior, not a placeholder — it tells the verifier exactly what to expect either way.
- **Type consistency:** `RequestPasswordResetFormState` (Task 2) matches its use in Task 3's `requestPasswordReset` signature and Task 4's `resetState?.errors?.email` / `resetState?.message` access. `AdminUserRow.passwordResetRequestedAt: string | null` (Task 5) matches the `user.passwordResetRequestedAt` access in the same task's UI change.
