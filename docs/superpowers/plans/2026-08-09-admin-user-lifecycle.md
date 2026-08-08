# Admin Deactivate & Delete Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin toggle a user's account between active/inactive (blocking login while inactive) and permanently delete a user's account and data, both guarded against self-targeting and removing the last remaining admin.

**Architecture:** One new `users.isActive` column; a shared pure guard function reused by both new actions; the existing batched users-with-stats query extended with a third aggregate (custom exercise counts) rather than adding a new per-row query; delete performed via explicit ordered deletes in application code rather than a cascading foreign key.

**Tech Stack:** Next.js Server Actions, Drizzle ORM, Neon Postgres, Vitest — same stack as the rest of the admin panel, no new dependencies.

## Global Constraints

- `setUserActive` and `deleteUser` both call `requireAdmin()` themselves, matching every other admin action.
- Both actions re-derive `adminCount` fresh from the database at mutation time — never trust a count passed from the client.
- The login gate checks `isActive` only AFTER `bcrypt.compare` succeeds — never before, to avoid letting a wrong-password guess distinguish "deactivated" from "wrong password" for a given email.
- No `onDelete: cascade` added to `workout_logs.userId` or `custom_exercises.userId` — deletion order is explicit in `deleteUser` (workout_logs first, which cascades to exercise_logs/sets via their *existing* cascade; then custom_exercises; then the user row).
- `drizzle-kit` CLI commands need `set -a && read each line && export` (not plain `source`) since `.env.local`'s `DATABASE_URL` contains an unquoted `&` that breaks bash `source` — discovered in earlier phases. Prefer `npx tsx --env-file .env.local <script>` for any verification script, which loads env correctly without this issue.
- The delete-confirmation modal shows counts only, never a listing of specific workout logs.

---

## File Structure

```
src/lib/server/auth/schema.ts       # + isActive column
src/lib/server/admin/guards.ts      # + canModifyUser
src/lib/server/admin/guards.test.ts # + tests for canModifyUser
src/lib/server/admin/queries.ts     # getAllUsersWithStats extended; + getAdminCount
src/lib/server/admin/actions.ts     # + setUserActive, deleteUser
src/lib/server/auth/actions.ts      # login gains isActive check
src/app/admin/users-list.tsx        # + ActiveControl, DeleteUserControl
drizzle/                            # new migration for isActive column
```

---

### Task 1: `isActive` column and migration

**Files:**
- Modify: `src/lib/server/auth/schema.ts`

**Interfaces:**
- Produces: `users.isActive` column, added to the `User`/`SafeUser` inferred types automatically (Drizzle infers from the table definition) — consumed by `admin/queries.ts` (Task 3), `admin/actions.ts` (Task 4), and `auth/actions.ts`'s `login` (Task 5).

- [ ] **Step 1: Add the column**

Read the current file first. Add `isActive` to the `users` table definition, right after `role` (or anywhere convenient among the non-FK columns):

```ts
// src/lib/server/auth/schema.ts — add this field to the existing users table
isActive: boolean("is_active").notNull().default(true),
```

You'll need to add `boolean` to the existing `drizzle-orm/pg-core` import list at the top of the file.

- [ ] **Step 2: Generate and apply the migration**

Run: `npx drizzle-kit generate`
Run (env-safe, avoids the unquoted-`&` `source` problem): `npx tsx --env-file .env.local -e "console.log('env ok')"` first to confirm tsx's env loading works, then apply via `set -a; while IFS='=' read -r k v; do [ -n "$k" ] && export "$k=$v"; done < .env.local; set +a; npx drizzle-kit migrate` (or any equivalent line-by-line export approach — plain `source .env.local` will fail on the unquoted `&` in `DATABASE_URL`).
Expected: a new migration adding a `is_active` boolean column, `NOT NULL DEFAULT true`, applied successfully — existing rows get `true` automatically via the column default.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/server/auth/schema.ts drizzle/
git commit -m "feat: add isActive column to users table"
```

---

### Task 2: `canModifyUser` guard (TDD)

**Files:**
- Modify: `src/lib/server/admin/guards.ts`
- Modify: `src/lib/server/admin/guards.test.ts`

**Interfaces:**
- Consumes: nothing (pure function).
- Produces: `canModifyUser(currentUserId: number, targetUserId: number, targetRole: "admin" | "user", adminCount: number): { ok: true } | { ok: false; error: string }` — consumed by `setUserActive` and `deleteUser` in Task 4.

- [ ] **Step 1: Write the failing tests**

Read the current `guards.test.ts` first (it already tests `canChangeRole` and `checkRegistrationsOpen`) and add these below the existing tests, without modifying what's already there:

```ts
// additions to src/lib/server/admin/guards.test.ts
import { canModifyUser } from "./guards";

describe("canModifyUser", () => {
  it("rejects targeting yourself", () => {
    const result = canModifyUser(5, 5, "user", 3);
    expect(result).toEqual({
      ok: false,
      error: "You can't do that to your own account.",
    });
  });

  it("rejects targeting the last remaining admin", () => {
    const result = canModifyUser(5, 9, "admin", 1);
    expect(result).toEqual({
      ok: false,
      error: "You can't remove the last admin.",
    });
  });

  it("allows targeting an admin when other admins exist", () => {
    const result = canModifyUser(5, 9, "admin", 2);
    expect(result).toEqual({ ok: true });
  });

  it("allows targeting a regular user even when adminCount is 1", () => {
    const result = canModifyUser(5, 9, "user", 1);
    expect(result).toEqual({ ok: true });
  });

  it("allows targeting another regular user normally", () => {
    const result = canModifyUser(5, 9, "user", 3);
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/server/admin/guards.test.ts`
Expected: FAIL — `canModifyUser` is not exported.

- [ ] **Step 3: Implement the guard**

Add this to `src/lib/server/admin/guards.ts`, alongside the existing `canChangeRole`/`checkRegistrationsOpen`:

```ts
// addition to src/lib/server/admin/guards.ts
export function canModifyUser(
  currentUserId: number,
  targetUserId: number,
  targetRole: "admin" | "user",
  adminCount: number
): { ok: true } | { ok: false; error: string } {
  if (currentUserId === targetUserId) {
    return { ok: false, error: "You can't do that to your own account." };
  }
  if (targetRole === "admin" && adminCount <= 1) {
    return { ok: false, error: "You can't remove the last admin." };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/server/admin/guards.test.ts`
Expected: PASS (11 tests total — 6 existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/admin/guards.ts src/lib/server/admin/guards.test.ts
git commit -m "feat: add canModifyUser guard for deactivate/delete with tests"
```

---

### Task 3: Extend admin queries — custom-exercise counts, isActive, admin count

**Files:**
- Modify: `src/lib/server/admin/queries.ts`

**Interfaces:**
- Consumes: `customExercises` (`@/lib/server/exercises/schema`) — new import.
- Produces: `AdminUserRow` gains `isActive: boolean` and `customExerciseCount: number`; new `getAdminCount(): Promise<number>` — consumed by `admin/actions.ts` (Task 4) and `admin/users-list.tsx` (Task 6).

- [ ] **Step 1: Extend `getAllUsersWithStats` and add `getAdminCount`**

Read the current file first. Replace its contents with this (adds the `customExercises` import, a third batched aggregate query, `isActive`/`customExerciseCount` in the returned shape, and the new `getAdminCount` function; `getAppSettings` is unchanged):

```ts
// src/lib/server/admin/queries.ts
import "server-only";
import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { workoutLogs } from "@/lib/server/workouts/schema";
import { customExercises } from "@/lib/server/exercises/schema";
import { appSettings } from "./schema";

export type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  isActive: boolean;
  joinedAt: string;
  totalLogs: number;
  lastLogDate: string | null;
  customExerciseCount: number;
};

export async function getAllUsersWithStats(): Promise<AdminUserRow[]> {
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users);

  const logStats = await db
    .select({
      userId: workoutLogs.userId,
      totalLogs: sql<number>`count(*)::int`.as("total_logs"),
      lastLogDate: sql<string>`max(${workoutLogs.date})`.as("last_log_date"),
    })
    .from(workoutLogs)
    .groupBy(workoutLogs.userId);

  const exerciseStats = await db
    .select({
      userId: customExercises.userId,
      customExerciseCount: sql<number>`count(*)::int`.as("custom_exercise_count"),
    })
    .from(customExercises)
    .groupBy(customExercises.userId);

  const logStatsByUserId = new Map(logStats.map((s) => [s.userId, s]));
  const exerciseStatsByUserId = new Map(
    exerciseStats.map((s) => [s.userId, s])
  );

  return allUsers.map((user) => {
    const userLogStats = logStatsByUserId.get(user.id);
    const userExerciseStats = exerciseStatsByUserId.get(user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      joinedAt: user.createdAt.toISOString().slice(0, 10),
      totalLogs: userLogStats?.totalLogs ?? 0,
      lastLogDate: userLogStats?.lastLogDate ?? null,
      customExerciseCount: userExerciseStats?.customExerciseCount ?? 0,
    };
  });
}

export async function getAdminCount(): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));
  return result?.count ?? 0;
}

export async function getAppSettings(): Promise<{ registrationsOpen: boolean }> {
  const [settings] = await db.select().from(appSettings).limit(1);
  return { registrationsOpen: settings?.registrationsOpen ?? true };
}
```

This is still exactly 3 queries total for `getAllUsersWithStats` regardless of user count (one for users, one aggregate for logs, one aggregate for custom exercises) plus 1 for `getAdminCount` when called — no per-user loop anywhere.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/admin/queries.ts
git commit -m "feat: extend admin queries with isActive, custom exercise counts, admin count"
```

---

### Task 4: `setUserActive` and `deleteUser` actions

**Files:**
- Modify: `src/lib/server/admin/actions.ts`

**Interfaces:**
- Consumes: `canModifyUser` (Task 2), `getAdminCount` (Task 3), `workoutLogs` (`@/lib/server/workouts/schema`), `customExercises` (`@/lib/server/exercises/schema`).
- Produces: `setUserActive(prevState: { error: string } | undefined, formData: FormData): Promise<{ error: string } | undefined>`, `deleteUser(prevState: { error: string } | undefined, formData: FormData): Promise<{ error: string } | undefined>` — both consumed by `admin/users-list.tsx` (Task 6).

- [ ] **Step 1: Add the two actions**

Read the current file first (it has `setUserRole`, `setRegistrationsOpen`, `createUserAsAdmin`). Add these new imports and two new exported functions — do not modify the existing three functions:

```ts
// additions to the top of src/lib/server/admin/actions.ts
import { workoutLogs } from "@/lib/server/workouts/schema";
import { customExercises } from "@/lib/server/exercises/schema";
import { canModifyUser } from "./guards";
import { getAdminCount } from "./queries";
```

(`canChangeRole` is already imported from `./guards` — add `canModifyUser` alongside it in the same import statement rather than a duplicate one.)

```ts
// additions to src/lib/server/admin/actions.ts
export async function setUserActive(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const session = await requireAdmin();

  const targetUserId = Number(formData.get("userId"));
  const isActive = formData.get("isActive") === "true";

  if (!Number.isInteger(targetUserId)) {
    return { error: "Invalid request." };
  }

  const [target] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!target) {
    return { error: "That user no longer exists." };
  }

  const adminCount = await getAdminCount();
  const check = canModifyUser(session.userId, targetUserId, target.role, adminCount);
  if (!check.ok) {
    return { error: check.error };
  }

  await db.update(users).set({ isActive }).where(eq(users.id, targetUserId));
  revalidatePath("/admin");
  return undefined;
}

export async function deleteUser(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const session = await requireAdmin();

  const targetUserId = Number(formData.get("userId"));

  if (!Number.isInteger(targetUserId)) {
    return { error: "Invalid request." };
  }

  const [target] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!target) {
    return { error: "That user no longer exists." };
  }

  const adminCount = await getAdminCount();
  const check = canModifyUser(session.userId, targetUserId, target.role, adminCount);
  if (!check.ok) {
    return { error: check.error };
  }

  // workout_logs -> exercise_logs -> sets cascade via their existing FK
  // cascade (see src/lib/server/workouts/schema.ts); custom_exercises has
  // no such cascade, so it's deleted explicitly here.
  await db.delete(workoutLogs).where(eq(workoutLogs.userId, targetUserId));
  await db.delete(customExercises).where(eq(customExercises.userId, targetUserId));
  await db.delete(users).where(eq(users.id, targetUserId));

  revalidatePath("/admin");
  return undefined;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify against the real database**

Mint an admin session cookie the same way prior admin-panel tasks did. Seed 2-3 real (temporary) test users, at least one with a few workout logs and a custom exercise. Using the live-HTTP-POST technique already established in this project (Next's progressive-enhancement `$ACTION_*` form fields against a running dev server), exercise: (a) `setUserActive` toggling a test user inactive, then confirm via a direct DB read that `is_active` is `false`; (b) attempting to deactivate/delete your own admin test account and confirm the "own account" error; (c) if you seed exactly one admin test user alongside your real admin, attempt to delete/deactivate the LAST admin scenario carefully — note your real admin account counts toward `adminCount` too, so you likely won't be able to trigger the last-admin case without temporarily having only one real admin; it's acceptable to verify this guard via the unit tests from Task 2 plus a careful reasoning check rather than forcing a live last-admin scenario that risks your own account; (d) `deleteUser` on a test user with workout logs and a custom exercise, then confirm via direct DB reads that their user row, workout_logs, exercise_logs, sets, and custom_exercises rows are all gone. Clean up all remaining test data afterward.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/admin/actions.ts
git commit -m "feat: add setUserActive and deleteUser server actions"
```

---

### Task 5: Login gate on `isActive`

**Files:**
- Modify: `src/lib/server/auth/actions.ts`

**Interfaces:**
- Consumes: `users.isActive` (Task 1).

- [ ] **Step 1: Add the check after password verification**

Read the current `login` function first. Add the `isActive` check immediately after the existing `passwordMatches` check, before `createSessionCookie`:

```ts
// modification within login(), in src/lib/server/auth/actions.ts — insert
// this block between the existing passwordMatches check and createSessionCookie
  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return { message: "Invalid email or password." };
  }

  if (!user.isActive) {
    return { message: "Your account has been deactivated. Contact an admin." };
  }

  await createSessionCookie({ userId: user.id, role: user.role });
  redirect("/dashboard");
```

Do not change `signup`, `logout`, or anything above the `passwordMatches` check — the ordering (password check before `isActive` check) is deliberate, per the plan's Global Constraints.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify against the real database**

Seed a real (temporary) test user with a known password, directly set their `is_active` to `false` via the project's own db/schema imports, then invoke `login` live over HTTP (same technique as prior tasks) with the correct password and confirm it returns `{ message: "Your account has been deactivated. Contact an admin." }` rather than creating a session. Also confirm a wrong password against that same deactivated user still returns "Invalid email or password." (proving the ordering — password checked first). Clean up the test user afterward.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/auth/actions.ts
git commit -m "feat: block login for deactivated user accounts"
```

---

### Task 6: Active/inactive toggle and delete UI

**Files:**
- Modify: `src/app/admin/users-list.tsx`

**Interfaces:**
- Consumes: `setUserActive`, `deleteUser` (Task 4), `AdminUserRow` (now including `isActive`/`customExerciseCount`, Task 3).

- [ ] **Step 1: Add the imports and a new table column**

Read the current file first (it has `RoleControl` and the existing table structure). Add `setUserActive`/`deleteUser` to the existing import from `@/lib/server/admin/actions`, add `Dialog`/`DialogContent`/`DialogFooter`/`DialogHeader`/`DialogTitle`/`DialogDescription` from `@/components/ui/dialog`, and add `Trash2` from `lucide-react` alongside whatever icons are already imported (none currently — this file has no lucide-react import yet, so add a fresh one).

- [ ] **Step 2: Add a "Status" table column and render `ActiveControl`/`DeleteUserControl`**

Add a `<TableHead>Status</TableHead>` column (place it after "Role", before "Joined") and a corresponding `<TableCell>` in the row-rendering `.map()` rendering `<ActiveControl .../>`; also add `<DeleteUserControl .../>` inside the existing final `<TableCell>` (the one currently holding only `RoleControl`), stacked below it.

```tsx
// within the row map in src/app/admin/users-list.tsx, add this TableCell
// right after the existing Role TableCell, and add DeleteUserControl into
// the existing last TableCell alongside RoleControl:
<TableCell>
  <ActiveControl
    userId={user.id}
    isActive={user.isActive}
    isSelf={user.id === currentUserId}
  />
</TableCell>
```

```tsx
// inside the existing last TableCell, below the current <RoleControl .../>:
<DeleteUserControl
  userId={user.id}
  userName={user.name}
  isSelf={user.id === currentUserId}
  totalLogs={user.totalLogs}
  customExerciseCount={user.customExerciseCount}
/>
```

Remember to also add the `<TableHead>Status</TableHead>` to the header row, matching the new column's position.

- [ ] **Step 3: Add the two new components at the bottom of the file, after `RoleControl`**

```tsx
// additions to src/app/admin/users-list.tsx, after the existing RoleControl function
function ActiveControl({
  userId,
  isActive,
  isSelf,
}: {
  userId: number;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(setUserActive, undefined);
  const nextActive = !isActive;
  const disabled = pending || isSelf;

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={isActive ? "secondary" : "destructive"}>
        {isActive ? "Active" : "Inactive"}
      </Badge>
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="isActive" value={String(nextActive)} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={disabled}
          title={isSelf ? "You can't do that to your own account." : undefined}
        >
          {nextActive ? "Activate" : "Deactivate"}
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

function DeleteUserControl({
  userId,
  userName,
  isSelf,
  totalLogs,
  customExerciseCount,
}: {
  userId: number;
  userName: string;
  isSelf: boolean;
  totalLogs: number;
  customExerciseCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteUser, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={isSelf}
        title={isSelf ? "You can't do that to your own account." : undefined}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {userName}?</DialogTitle>
          <DialogDescription>
            This will permanently delete this user and {totalLogs} workout
            {totalLogs === 1 ? "" : "s"} log{totalLogs === 1 ? "" : "s"},{" "}
            {customExerciseCount} custom exercise
            {customExerciseCount === 1 ? "" : "s"}. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </form>
        {state?.error && (
          <p className="text-xs text-destructive" role="alert">
            {state.error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

Note the odd-looking `{totalLogs} workout{totalLogs === 1 ? "" : "s"} log{totalLogs === 1 ? "" : "s"}` — this reads awkwardly for singular counts ("1 workout log" vs "2 workout logs"); simplify to just `{totalLogs} workout log(s)` with a single combined pluralization if you prefer, but keep the counts accurate. Either phrasing is acceptable; correctness of the numbers matters more than grammar polish here.

- [ ] **Step 4: Verify it compiles and builds**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean.

- [ ] **Step 5: Manually verify in the browser (or via the project's established curl/live-HTTP pattern if no browser is available)**

Visit `/admin`, confirm the Status column shows Active/Inactive badges and toggle buttons work, confirm your own row's deactivate/delete buttons are disabled with the expected tooltip, and confirm clicking "Delete" on another (test) user opens a dialog showing the correct counts before confirming.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/users-list.tsx"
git commit -m "feat: add active/inactive toggle and delete UI to admin users list"
```

---

## Self-Review Notes

- **Spec coverage:** `isActive` column → Task 1; shared guard covering both actions' identical rules → Task 2; batched query extension (no N+1) → Task 3; both actions with fresh `adminCount` and `requireAdmin()` → Task 4; login gate ordered after password check → Task 5; UI toggle + confirmation modal with counts → Task 6. Non-goals (no session revocation on deactivate, no soft-delete/undo, no itemized listing in the modal, no changes to `createUserAsAdmin`/`setUserRole`/registrations gate) are correctly absent from every task.
- **Placeholder scan:** none found.
- **Type consistency check:** `canModifyUser`'s `(currentUserId, targetUserId, targetRole, adminCount)` signature (Task 2) matches its call sites in `setUserActive`/`deleteUser` (Task 4) exactly. `AdminUserRow`'s new `isActive`/`customExerciseCount` fields (Task 3) match how `users-list.tsx` (Task 6) destructures `user.isActive`/`user.customExerciseCount`. `setUserActive`/`deleteUser`'s `(prevState, formData) => Promise<{error} | undefined>` signature (Task 4) matches `useActionState(setUserActive, undefined)`/`useActionState(deleteUser, undefined)` in Task 6.
