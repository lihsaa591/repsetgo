# Admin Create User + Real Logout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin create a new user account directly (name/email/password/role) from the admin panel, and fix the admin shell's logout button to actually end the session instead of just navigating.

**Architecture:** A new Server Action in the existing `src/lib/server/admin/` domain, a dialog-based form component reusing existing UI primitives (`Dialog`, `Select`), and a one-line fix to `admin-shell.tsx` to use the real `logout` Server Action already used elsewhere in the app.

**Tech Stack:** Next.js Server Actions, Zod, bcryptjs, Drizzle — same stack as the rest of the project, no new dependencies.

## Global Constraints

- `createUserAsAdmin` calls `requireAdmin()` itself, not relying solely on `admin/layout.tsx`'s guard (matches every other admin action).
- No "must change password" flag, no email/invite flow, no bulk import — explicitly out of scope per the spec.
- The new account creation path is entirely separate from `signup` — it must work regardless of the registrations-open setting, and must not modify `signup`/`checkRegistrationsOpen` at all.
- Password strength rule matches `SignupSchema` exactly: ≥8 chars, at least one letter, at least one number.

---

### Task 1: `createUserAsAdmin` Server Action

**Files:**
- Create: `src/lib/server/admin/validation.ts`
- Modify: `src/lib/server/admin/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/server/auth/dal`), `db`, `users` (`@/lib/server/auth/schema`), `bcrypt` (`bcryptjs`).
- Produces: `CreateUserSchema` (Zod), `CreateUserFormState = { errors?: Record<string, string[]>; message?: string; success?: true } | undefined`, and `createUserAsAdmin(prevState: CreateUserFormState, formData: FormData): Promise<CreateUserFormState>` — consumed by `add-user-dialog.tsx` (Task 2).

- [ ] **Step 1: Add the validation schema**

```ts
// src/lib/server/admin/validation.ts
import * as z from "zod";

export const CreateUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  email: z.string().trim().email("Please enter a valid email."),
  password: z
    .string()
    .min(8, "Be at least 8 characters long.")
    .regex(/[a-zA-Z]/, "Contain at least one letter.")
    .regex(/[0-9]/, "Contain at least one number."),
  role: z.enum(["admin", "user"]),
});

export type CreateUserFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      success?: true;
    }
  | undefined;
```

- [ ] **Step 2: Add `createUserAsAdmin` to `admin/actions.ts`**

Read the current file first — it already exports `setUserRole` and `setRegistrationsOpen`; add this as a new export alongside them, importing `bcrypt` and the new schema at the top:

```ts
// additions to src/lib/server/admin/actions.ts
import bcrypt from "bcryptjs";
import { CreateUserSchema, type CreateUserFormState } from "./validation";

export async function createUserAsAdmin(
  _prevState: CreateUserFormState,
  formData: FormData
): Promise<CreateUserFormState> {
  await requireAdmin();

  const validated = CreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, email, password, role } = validated.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    return { message: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ name, email, passwordHash, role });

  revalidatePath("/admin");
  return { success: true };
}
```

(`db`, `users`, `eq`, `revalidatePath`, `requireAdmin` are already imported in the existing file for `setUserRole`/`setRegistrationsOpen` — reuse those imports, don't duplicate them.)

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify against the real database**

Start the dev server (`npm run dev -- --port 3100`). Mint an admin session cookie the same way prior admin-panel tasks did (a one-off tsx script using `session.ts`'s `encrypt()`, never printing `SESSION_SECRET`). Since `createUserAsAdmin` is a Server Action (not a plain GET), invoke it live over HTTP the way the phase-2 final regression pass did — via a `curl` multipart POST carrying Next's progressive-enhancement `$ACTION_*` fields — or call it directly from a script if that works in this Next version for actions that don't rely on `cookies()` beyond `requireAdmin()`'s own session check (test which approach works; both were used successfully in earlier admin-panel tasks). Confirm: a new user is created with the given role and can log in with the password you set; a second attempt with the same email is rejected with "An account with this email already exists."; and this all works even when `app_settings.registrations_open` is `false` (set it false first, confirm creation still succeeds, then set it back to `true`). Clean up the test user(s) afterward, leaving no residual data.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/admin/validation.ts src/lib/server/admin/actions.ts
git commit -m "feat: add createUserAsAdmin server action"
```

---

### Task 2: Add-user dialog and wiring

**Files:**
- Create: `src/app/admin/add-user-dialog.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `createUserAsAdmin` (`@/lib/server/admin/actions`).

- [ ] **Step 1: Create the dialog component**

```tsx
// src/app/admin/add-user-dialog.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { createUserAsAdmin } from "@/lib/server/admin/actions";

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createUserAsAdmin, undefined);

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} size="sm">
        <UserPlus className="h-4 w-4" /> Add user
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new user</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-user-name">Name</Label>
            <Input id="add-user-name" name="name" required />
            {state?.errors?.name && (
              <p className="text-xs text-destructive">{state.errors.name[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-user-email">Email</Label>
            <Input id="add-user-email" name="email" type="email" required />
            {state?.errors?.email && (
              <p className="text-xs text-destructive">{state.errors.email[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-user-password">Password</Label>
            <Input id="add-user-password" name="password" type="password" required />
            {state?.errors?.password && (
              <p className="text-xs text-destructive">{state.errors.password[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-user-role">Role</Label>
            <Select name="role" defaultValue="user">
              <SelectTrigger id="add-user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {state?.message && (
            <p className="text-xs text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Note: the trigger `Button` is rendered as a sibling of `DialogContent` inside `Dialog`, controlled by the `open`/`onOpenChange` state — matching the controlled-dialog pattern already used for delete-confirmation in `history-list.tsx`, rather than `Dialog`'s uncontrolled trigger-child pattern, since we need to close it programmatically on success.

- [ ] **Step 2: Wire it into the admin page**

Modify `src/app/admin/page.tsx` — add the import and render the button next to the page heading:

```tsx
// src/app/admin/page.tsx
import { Card, CardContent } from "@/components/ui/card";
import { getAllUsersWithStats } from "@/lib/server/admin/queries";
import { verifySession } from "@/lib/server/auth/dal";
import { UsersList } from "./users-list";
import { AddUserDialog } from "./add-user-dialog";

export default async function AdminUsersPage() {
  const [users, session] = await Promise.all([
    getAllUsersWithStats(),
    verifySession(),
  ]);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const activeThisWeek = users.filter(
    (u) => u.lastLogDate && new Date(u.lastLogDate) >= oneWeekAgo
  ).length;
  const totalLogsSaved = users.reduce((sum, u) => sum + u.totalLogs, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Everyone registered on RepSetGo
          </p>
        </div>
        <AddUserDialog />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Total users</span>
            <span className="text-2xl font-semibold">{users.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Active this week</span>
            <span className="text-2xl font-semibold">{activeThisWeek}</span>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Total logs saved</span>
            <span className="text-2xl font-semibold">{totalLogsSaved}</span>
          </CardContent>
        </Card>
      </div>

      <UsersList users={users} currentUserId={session.userId} />
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles and builds**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean.

- [ ] **Step 4: Manually verify in the browser**

Log in as admin, visit `/admin`, click "Add user," fill in the form, submit. Confirm the dialog closes, the new user appears in the table below, and their stats show 0 logs. Try submitting with an email that already exists and confirm the error message appears without closing the dialog.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/add-user-dialog.tsx "src/app/admin/page.tsx"
git commit -m "feat: add dialog for admins to create user accounts directly"
```

---

### Task 3: Fix the admin shell's fake logout button

**Files:**
- Modify: `src/components/layout/admin-shell.tsx`

**Interfaces:**
- Consumes: `logout` (`@/lib/server/auth/actions`) — already used by `app-shell.tsx` for the same purpose.

- [ ] **Step 1: Replace the fake `handleLogout`/`router.push` with the real Server Action**

The current file has `const router = useRouter();`, a `handleLogout` function calling `router.push("/")`, and two `<button onClick={handleLogout}>` elements (desktop sidebar, mobile header). Replace all of that: remove `useRouter`/`handleLogout` entirely, and wrap each logout button in a `<form action={logout}>`, matching how `app-shell.tsx` already does this.

```tsx
// src/components/layout/admin-shell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Users, Settings, ArrowLeft, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/server/auth/actions";

const navItems = [
  { href: "/admin", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-60 flex-col border-r bg-muted/30 md:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          <Dumbbell className="h-6 w-6" />
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold">RepSetGo</span>
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t px-3 py-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to app
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </form>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">RepSetGo</span>
            <span className="text-[10px] text-muted-foreground">Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-xs text-muted-foreground">
            Exit
          </Link>
          <form action={logout}>
            <button type="submit" className="text-xs text-destructive">
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 pt-16 md:pt-0">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify in the browser**

Log in as admin, visit `/admin`, click "Log out." Confirm you're redirected to `/login` and that visiting `/admin` again afterward redirects you to `/login` (proving the session was actually destroyed, not just a client-side navigation).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/admin-shell.tsx
git commit -m "fix: wire admin shell logout button to the real logout server action"
```

---

## Self-Review Notes

- **Spec coverage:** create-user form/dialog → Task 2; server action with validation, uniqueness check, hashing, role assignment, revalidation → Task 1; works regardless of registrations-open setting → Task 1 Step 4 explicitly verifies this; no session created for the new account → Task 1's action never calls `createSessionCookie`. Logout fix (separately requested, folded into this plan per user's choice) → Task 3.
- **Placeholder scan:** none found.
- **Type consistency check:** `CreateUserFormState` (Task 1) matches how Task 2's `useActionState(createUserAsAdmin, undefined)` and `state?.errors`/`state?.message`/`state?.success` are consumed. `logout`'s signature (no args, already defined in an earlier phase) matches its use as a plain form `action` in Task 3, identical to its existing use in `app-shell.tsx`.
