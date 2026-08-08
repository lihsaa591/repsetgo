# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin panel's hardcoded mock data with a real users list (stats, role management) and a real admin-toggleable "allow new registrations" setting enforced at signup.

**Architecture:** A new `src/lib/server/admin/` domain folder (schema, queries, actions, pure guards) following the pattern established by `workouts/`, `exercises/`, `users/`. The users-list stats query is batched (2 queries total, no N+1) from the start. Role-change and self-demotion logic lives in pure, directly-unit-tested functions separate from the database-touching actions that call them.

**Tech Stack:** Next.js Server Components/Actions, Drizzle ORM, Neon Postgres, Vitest — same stack as phase 1, no new dependencies.

## Global Constraints

- Every mutating Server Action calls `requireAdmin()` (from `src/lib/server/auth/dal.ts`) itself — never rely solely on `admin/layout.tsx`'s existing guard.
- No login-timestamp tracking; "active" is derived from `workout_logs` data already in the database.
- The "App name" field and "Reset all data" danger-zone button from the old mockup are dropped, not implemented.
- The `users` list and stats query must be 2 database queries total regardless of user count — never one query per user.
- Existing `promote-admin` CLI script is untouched.
- Foreign keys get an index at schema-definition time (matches phase 1's corrected convention) — not applicable here since `app_settings` has no foreign keys.
- `drizzle-kit` CLI commands need `set -a && source .env.local && set +a &&` prefixed, since it doesn't auto-load `.env.local` (only `.env`) — discovered in phase 1.

---

## File Structure

```
src/lib/server/admin/
  schema.ts       # app_settings table
  guards.ts       # canChangeRole(), checkRegistrationsOpen() — pure, no DB
  guards.test.ts  # unit tests for both
  queries.ts      # getAllUsersWithStats(), getAppSettings()
  actions.ts      # setUserRole(), setRegistrationsOpen()
drizzle/
  ...                              # generated migration for app_settings
drizzle.config.ts                  # add admin/schema.ts to the schema array
src/app/admin/page.tsx             # rewired: async server component
src/app/admin/users-list.tsx       # new: client component, table + pagination + role control
src/app/admin/settings/page.tsx    # rewired: real registration toggle only
src/lib/server/auth/actions.ts     # signup gains the registrations-open check
```

---

### Task 1: `app_settings` schema and migration

**Files:**
- Create: `src/lib/server/admin/schema.ts`
- Modify: `drizzle.config.ts`

**Interfaces:**
- Produces: `appSettings` table, `AppSettings = typeof appSettings.$inferSelect` type — consumed by `admin/queries.ts` (Task 3).

- [ ] **Step 1: Define the schema**

```ts
// src/lib/server/admin/schema.ts
import { pgTable, serial, boolean } from "drizzle-orm/pg-core";

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  registrationsOpen: boolean("registrations_open").notNull().default(true),
});

export type AppSettings = typeof appSettings.$inferSelect;
```

- [ ] **Step 2: Add the schema file to `drizzle.config.ts`**

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./src/lib/server/auth/schema.ts",
    "./src/lib/server/workouts/schema.ts",
    "./src/lib/server/exercises/schema.ts",
    "./src/lib/server/admin/schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 3: Generate the migration**

Run: `set -a && source .env.local && set +a && npx drizzle-kit generate`
Expected: a new SQL file under `drizzle/` creating the `app_settings` table.

- [ ] **Step 4: Add the seed row to the generated migration file**

Open the newly generated SQL file (the drizzle-kit output names it, e.g. `drizzle/000X_<name>.sql`) and append this line at the end of the file, after the `CREATE TABLE` statement:

```sql
INSERT INTO "app_settings" ("registrations_open") VALUES (true);
```

This ensures exactly one row always exists — application code never has to handle "no settings row yet."

- [ ] **Step 5: Apply the migration**

Run: `set -a && source .env.local && set +a && npx drizzle-kit migrate`
Expected: migration applies successfully. Confirm the seed row exists by checking the migration output for no errors — the row is queried for real in Task 3's manual verification.

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/server/admin/schema.ts drizzle.config.ts drizzle/
git commit -m "feat: add app_settings table with seeded registrations-open row"
```

---

### Task 2: Pure guard functions (TDD)

**Files:**
- Create: `src/lib/server/admin/guards.ts`
- Test: `src/lib/server/admin/guards.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no DB, no session/request objects).
- Produces:
  - `canChangeRole(currentUserId: number, targetUserId: number, newRole: "admin" | "user"): { ok: true } | { ok: false; error: string }`
  - `checkRegistrationsOpen(settings: { registrationsOpen: boolean }): { ok: true } | { ok: false; error: string }`
  Both consumed by `admin/actions.ts` (Task 4) and `auth/actions.ts` (Task 5).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/server/admin/guards.test.ts
import { describe, expect, it } from "vitest";
import { canChangeRole, checkRegistrationsOpen } from "./guards";

describe("canChangeRole", () => {
  it("rejects demoting yourself", () => {
    const result = canChangeRole(5, 5, "user");
    expect(result).toEqual({ ok: false, error: "You can't demote yourself." });
  });

  it("allows promoting yourself to admin (a no-op, not an error)", () => {
    const result = canChangeRole(5, 5, "admin");
    expect(result).toEqual({ ok: true });
  });

  it("allows promoting another user", () => {
    const result = canChangeRole(5, 9, "admin");
    expect(result).toEqual({ ok: true });
  });

  it("allows demoting another user", () => {
    const result = canChangeRole(5, 9, "user");
    expect(result).toEqual({ ok: true });
  });
});

describe("checkRegistrationsOpen", () => {
  it("allows signup when registrations are open", () => {
    const result = checkRegistrationsOpen({ registrationsOpen: true });
    expect(result).toEqual({ ok: true });
  });

  it("rejects signup when registrations are closed", () => {
    const result = checkRegistrationsOpen({ registrationsOpen: false });
    expect(result).toEqual({
      ok: false,
      error: "New signups are currently closed.",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/server/admin/guards.test.ts`
Expected: FAIL — `./guards` module not found.

- [ ] **Step 3: Implement the guards**

```ts
// src/lib/server/admin/guards.ts
export function canChangeRole(
  currentUserId: number,
  targetUserId: number,
  newRole: "admin" | "user"
): { ok: true } | { ok: false; error: string } {
  if (currentUserId === targetUserId && newRole === "user") {
    return { ok: false, error: "You can't demote yourself." };
  }
  return { ok: true };
}

export function checkRegistrationsOpen(
  settings: { registrationsOpen: boolean }
): { ok: true } | { ok: false; error: string } {
  if (!settings.registrationsOpen) {
    return { ok: false, error: "New signups are currently closed." };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/server/admin/guards.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/admin/guards.ts src/lib/server/admin/guards.test.ts
git commit -m "feat: add pure role-change and registration guards with tests"
```

---

### Task 3: Admin queries — users list stats and app settings

**Files:**
- Create: `src/lib/server/admin/queries.ts`

**Interfaces:**
- Consumes: `db` (`@/lib/server/db`), `users` (`@/lib/server/auth/schema`), `workoutLogs` (`@/lib/server/workouts/schema`), `appSettings` (`./schema`).
- Produces:
  - `getAllUsersWithStats(): Promise<AdminUserRow[]>`, `AdminUserRow = { id: number; name: string; email: string; role: "admin" | "user"; joinedAt: string; totalLogs: number; lastLogDate: string | null }`
  - `getAppSettings(): Promise<{ registrationsOpen: boolean }>`
  Both consumed by `admin/page.tsx` (Task 6), `admin/settings/page.tsx` (Task 7), and `getAppSettings` also by `auth/actions.ts` (Task 5).

- [ ] **Step 1: Implement the batched users-with-stats query**

```ts
// src/lib/server/admin/queries.ts
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { workoutLogs } from "@/lib/server/workouts/schema";
import { appSettings } from "./schema";

export type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  joinedAt: string;
  totalLogs: number;
  lastLogDate: string | null;
};

export async function getAllUsersWithStats(): Promise<AdminUserRow[]> {
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users);

  const stats = await db
    .select({
      userId: workoutLogs.userId,
      totalLogs: sql<number>`count(*)::int`.as("total_logs"),
      lastLogDate: sql<string>`max(${workoutLogs.date})`.as("last_log_date"),
    })
    .from(workoutLogs)
    .groupBy(workoutLogs.userId);

  const statsByUserId = new Map(stats.map((s) => [s.userId, s]));

  return allUsers.map((user) => {
    const userStats = statsByUserId.get(user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      joinedAt: user.createdAt.toISOString().slice(0, 10),
      totalLogs: userStats?.totalLogs ?? 0,
      lastLogDate: userStats?.lastLogDate ?? null,
    };
  });
}

export async function getAppSettings(): Promise<{ registrationsOpen: boolean }> {
  const [settings] = await db.select().from(appSettings).limit(1);
  return { registrationsOpen: settings?.registrationsOpen ?? true };
}
```

Note: `getAppSettings` falls back to `true` if the row is somehow missing (it shouldn't be, per Task 1's seed migration) — a defensive default that fails toward "signups open" rather than silently locking everyone out.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/admin/queries.ts
git commit -m "feat: add batched admin users-with-stats and app-settings queries"
```

---

### Task 4: Admin actions — role changes and registration toggle

**Files:**
- Create: `src/lib/server/admin/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/server/auth/dal`), `canChangeRole`/`checkRegistrationsOpen` (`./guards` — note `checkRegistrationsOpen` isn't used here, only in Task 5; `canChangeRole` is), `db`, `users`, `appSettings`.
- Produces:
  - `setUserRole(prevState: { error: string } | undefined, formData: FormData): Promise<{ error: string } | undefined>` — reads `userId` and `role` fields from `formData`.
  - `setRegistrationsOpen(prevState: { error: string } | undefined, formData: FormData): Promise<{ error: string } | undefined>` — reads a `registrationsOpen` checkbox field (present/checked = `"on"`, absent = unchecked).
  Both consumed by `admin/users-list.tsx` (Task 6) and `admin/settings/page.tsx` (Task 7) via `useActionState`.

- [ ] **Step 1: Implement the actions**

```ts
// src/lib/server/admin/actions.ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { requireAdmin } from "@/lib/server/auth/dal";
import { appSettings } from "./schema";
import { canChangeRole } from "./guards";

export async function setUserRole(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const session = await requireAdmin();

  const targetUserId = Number(formData.get("userId"));
  const newRole = formData.get("role");

  if (!Number.isInteger(targetUserId) || (newRole !== "admin" && newRole !== "user")) {
    return { error: "Invalid request." };
  }

  const check = canChangeRole(session.userId, targetUserId, newRole);
  if (!check.ok) {
    return { error: check.error };
  }

  await db.update(users).set({ role: newRole }).where(eq(users.id, targetUserId));
  revalidatePath("/admin");
  return undefined;
}

export async function setRegistrationsOpen(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  await requireAdmin();

  const registrationsOpen = formData.get("registrationsOpen") === "on";

  const [existing] = await db.select({ id: appSettings.id }).from(appSettings).limit(1);
  if (!existing) {
    return { error: "Settings row is missing — this shouldn't happen." };
  }

  await db
    .update(appSettings)
    .set({ registrationsOpen })
    .where(eq(appSettings.id, existing.id));

  revalidatePath("/admin/settings");
  return undefined;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/admin/actions.ts
git commit -m "feat: add setUserRole and setRegistrationsOpen server actions"
```

---

### Task 5: Wire signup to the registrations-open check

**Files:**
- Modify: `src/lib/server/auth/actions.ts`

**Interfaces:**
- Consumes: `getAppSettings` (`@/lib/server/admin/queries`), `checkRegistrationsOpen` (`@/lib/server/admin/guards`).

- [ ] **Step 1: Add the check to `signup`, before validation**

```ts
// src/lib/server/auth/actions.ts
"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { users } from "./schema";
import { createSessionCookie, deleteSessionCookie } from "./session";
import { SignupSchema, LoginSchema, type AuthFormState } from "./validation";
import { getAppSettings } from "@/lib/server/admin/queries";
import { checkRegistrationsOpen } from "@/lib/server/admin/guards";

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const settings = await getAppSettings();
  const registrationCheck = checkRegistrationsOpen(settings);
  if (!registrationCheck.ok) {
    return { message: registrationCheck.error };
  }

  const validated = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, email, password } = validated.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    return { message: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash })
    .returning({ id: users.id, role: users.role });

  await createSessionCookie({ userId: user.id, role: user.role });
  redirect("/dashboard");
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    return { message: "Invalid email or password." };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return { message: "Invalid email or password." };
  }

  await createSessionCookie({ userId: user.id, role: user.role });
  redirect("/dashboard");
}

export async function logout() {
  await deleteSessionCookie();
  redirect("/login");
}
```

(Only `signup` changed — `login` and `logout` are shown unchanged for context so the whole file is copy-pasteable.)

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify the closed-signups path**

Start the dev server (`npm run dev -- --port 3100`). Using the pattern from prior phases, mint an admin session cookie for a real (temporary) admin test user via a one-off `tsx` script using `session.ts`'s `encrypt()` (never printing `SESSION_SECRET`), and via that same script, directly set `app_settings.registrations_open = false` in the real database using the project's own `db`/`appSettings` schema. Then `curl -X POST` (or use the running dev server via a browser-equivalent form post) the `/signup` flow and confirm it returns the "New signups are currently closed." message instead of creating an account. Afterward, set `registrations_open` back to `true` and delete the temporary admin test user, leaving no residual test data in the real database.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/auth/actions.ts
git commit -m "feat: block signup when admin has closed registrations"
```

---

### Task 6: Rewire the admin users page

**Files:**
- Modify: `src/app/admin/page.tsx`
- Create: `src/app/admin/users-list.tsx`

**Interfaces:**
- Consumes: `getAllUsersWithStats`, `AdminUserRow` (`@/lib/server/admin/queries`), `setUserRole` (`@/lib/server/admin/actions`), `verifySession` (`@/lib/server/auth/dal`, to know the current admin's own id for the self-demotion UI).

- [ ] **Step 1: Rewire the server page**

```tsx
// src/app/admin/page.tsx
import { Card, CardContent } from "@/components/ui/card";
import { getAllUsersWithStats } from "@/lib/server/admin/queries";
import { verifySession } from "@/lib/server/auth/dal";
import { UsersList } from "./users-list";

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
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Everyone registered on RepSetGo
        </p>
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

- [ ] **Step 2: Create the client list component with pagination and role control**

```tsx
// src/app/admin/users-list.tsx
"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { setUserRole } from "@/lib/server/admin/actions";
import type { AdminUserRow } from "@/lib/server/admin/queries";

const PAGE_SIZE = 10;

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UsersList({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: number;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Logs</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium leading-none">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.joinedAt}
                  </TableCell>
                  <TableCell className="text-sm">{user.totalLogs}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLogDate ?? "—"}
                  </TableCell>
                  <TableCell>
                    <RoleControl
                      userId={user.id}
                      currentRole={user.role}
                      isSelf={user.id === currentUserId}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                className={
                  page === totalPages ? "pointer-events-none opacity-50" : ""
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

function RoleControl({
  userId,
  currentRole,
  isSelf,
}: {
  userId: number;
  currentRole: "admin" | "user";
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(setUserRole, undefined);
  const nextRole = currentRole === "admin" ? "user" : "admin";
  const disabled = pending || (isSelf && nextRole === "user");

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="role" value={nextRole} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={disabled}
          title={
            isSelf && nextRole === "user" ? "You can't demote yourself." : undefined
          }
        >
          {nextRole === "admin" ? "Make admin" : "Make user"}
        </Button>
      </form>
      {state?.error && (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
```

Note: the submit button is disabled client-side for the self-demotion case (immediate feedback, no round-trip needed), but `setUserRole` still enforces it server-side via `canChangeRole` — the disabled state is a UX nicety, not the actual guard.

- [ ] **Step 3: Manually verify**

Start the dev server. Log in as your admin account, visit `/admin`. Confirm: the real users list renders (not the old 3-row mock), stats cards show real numbers, your own row's "Make user" button is disabled with a tooltip, and clicking another user's role button actually changes their role (verify by checking the database or having them log out/in and visit `/admin` themselves if they were promoted).

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/page.tsx" "src/app/admin/users-list.tsx"
git commit -m "feat: rewire admin users page to real data with role management"
```

---

### Task 7: Rewire admin settings page

**Files:**
- Modify: `src/app/admin/settings/page.tsx`

**Interfaces:**
- Consumes: `getAppSettings` (`@/lib/server/admin/queries`), `setRegistrationsOpen` (`@/lib/server/admin/actions`).

- [ ] **Step 1: Rewire the page**

```tsx
// src/app/admin/settings/page.tsx
import { getAppSettings } from "@/lib/server/admin/queries";
import { RegistrationToggle } from "./registration-toggle";

export default async function AdminSettingsPage() {
  const settings = await getAppSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">App-wide configuration</p>
      </div>

      <RegistrationToggle initialOpen={settings.registrationsOpen} />
    </div>
  );
}
```

- [ ] **Step 2: Create the client toggle component**

```tsx
// src/app/admin/settings/registration-toggle.tsx
"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setRegistrationsOpen } from "@/lib/server/admin/actions";

export function RegistrationToggle({ initialOpen }: { initialOpen: boolean }) {
  const [state, action, pending] = useActionState(setRegistrationsOpen, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">General</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <form action={action}>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Allow new registrations</p>
              <p className="text-xs text-muted-foreground">
                Turn off to close signups to the public
              </p>
            </div>
            <input
              type="checkbox"
              name="registrationsOpen"
              defaultChecked={initialOpen}
              disabled={pending}
              className="h-4 w-4"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
          </div>
        </form>
        {state?.error && (
          <p className="text-xs text-destructive" role="alert">
            {state.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

The checkbox auto-submits on change (same pattern as the avatar upload's file input in phase 1) — no separate "Save" button needed for a single toggle.

- [ ] **Step 3: Manually verify**

Log in as admin, visit `/admin/settings`. Confirm the "App name" field and "Reset all data" section are gone, and toggling the checkbox persists across a page reload (check the database directly, or reload the page and confirm the checkbox state matches what you set).

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/settings/page.tsx" "src/app/admin/settings/registration-toggle.tsx"
git commit -m "feat: rewire admin settings to a real registrations-open toggle"
```

---

### Task 8: Full regression pass

**Files:** none (verification only)

**Interfaces:** none — this task exercises everything built in Tasks 1-7 together.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the 6 new guard tests from Task 2 alongside every test from phase 1.

- [ ] **Step 2: Run typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean.

- [ ] **Step 3: End-to-end manual pass**

Using a real (temporary) test admin account and a real (temporary) second test user account against the real database (clean up both afterward):
1. As admin, visit `/admin` — confirm real stats and user list.
2. Promote the second test user to admin; confirm their role updates.
3. Demote them back to user; confirm it updates again.
4. Attempt to demote your own admin account — confirm the button is disabled and, if bypassed via a direct request, the server rejects it with "You can't demote yourself."
5. Visit `/admin/settings`, turn off "Allow new registrations."
6. Attempt to sign up as a brand-new third account — confirm it's rejected with the closed-signups message.
7. Turn registrations back on; confirm the same signup now succeeds, then delete that throwaway account's data too.

- [ ] **Step 4: Clean up any leftover test data**

Confirm no test users/settings changes remain in the real database beyond the intended final state (`registrationsOpen: true`, your real admin account unchanged).

- [ ] **Step 5: Final commit if any fixes were needed**

If Steps 1-4 required any fixes, commit them now with a clear message describing what was found and fixed. If everything passed clean, this step is a no-op.

---

## Self-Review Notes

- **Spec coverage:** architecture/domain folder → Task 1-4; data model (`app_settings`, seeded) → Task 1; batched users-list query → Task 3; role changes + self-demotion guard → Tasks 2, 4, 6; "active this week" stat → Task 6; registration toggle + signup enforcement → Tasks 4, 5, 7; error handling conventions (`{error}` shapes, `requireAdmin()` per-action) → Tasks 4, 5; testing (pure guard functions) → Task 2. Non-goals (app name, reset-all-data, login tracking, account deletion, promote-admin script changes) → correctly absent from every task.
- **Placeholder scan:** none found — every step has concrete code or a concrete manual-verification procedure.
- **Type consistency check:** `AdminUserRow` (Task 3) fields (`id`, `name`, `email`, `role`, `joinedAt`, `totalLogs`, `lastLogDate`) match usage in Task 6's `admin/page.tsx` and `users-list.tsx` exactly. `canChangeRole`'s `{ ok: true } | { ok: false; error: string }` return shape (Task 2) matches how Task 4's `setUserRole` consumes it (`check.ok` / `check.error`). `setUserRole`/`setRegistrationsOpen`'s `(prevState, formData) => Promise<{error: string} | undefined>` signature (Task 4) matches how Task 6/7's `useActionState(setUserRole, undefined)` / `useActionState(setRegistrationsOpen, undefined)` calls expect it.
