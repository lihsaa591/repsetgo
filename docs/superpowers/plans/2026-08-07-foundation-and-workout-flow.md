# Foundation (Auth + DB) & Dynamic Workout Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace RepSetGo's mocked/localStorage-backed data with a real Neon Postgres database, JWT-based auth with role-based route protection, and a fully DB-backed workout logging flow (dashboard, log, edit, history, settings, custom exercises).

**Architecture:** Domain-oriented server code under `src/lib/server/<domain>/` (auth, users, workouts, exercises), each owning its schema slice, queries, and Server Actions. Pages become async Server Components calling domain queries directly; mutations go through Server Actions. `proxy.ts` does optimistic cookie-based route protection; every Server Action/query independently re-verifies via a DAL (`verifySession`, memoized per-request with `React.cache`).

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM, `@neondatabase/serverless`, `jose` (JWT), `bcryptjs` (password hashing — pure JS, avoids native-binary issues in serverless), `zod` (validation), `@vercel/blob` (avatar storage), Vitest (unit tests).

## Global Constraints

- Do not enable Next.js Cache Components (`cacheComponents: true`) — out of scope; pages use plain `async` Server Components without `'use cache'`.
- Session cookie payload is `{ userId, role }` only — no PII, no password hash, no email.
- Every Server Action must call `verifySession()` itself; never rely solely on `proxy.ts` or UI-level checks.
- Custom exercises are private per-user (not a shared/global catalog).
- Existing component markup (`WorkoutForm`, `ExercisePicker`, page layouts) is preserved — only data-fetching/mutation wiring changes, per the design spec.
- All foreign keys get an index at schema definition time.
- Delete `src/lib/mock-data.ts`, `src/hooks/use-workout-logs.ts`, `src/hooks/use-exercise-options.ts` once their replacements are wired in — do not leave dead code.

---

## File Structure

```
src/lib/server/
  db.ts                      # Drizzle client (Neon serverless driver)
  auth/
    schema.ts                # users table (incl. profile + role columns)
    session.ts               # encrypt/decrypt JWT, createSessionCookie/deleteSessionCookie
    dal.ts                   # verifySession(), getCurrentUser()
    actions.ts                # signup, login, logout Server Actions
    validation.ts             # Zod schemas for signup/login
  users/
    queries.ts                 # getUserProfile(userId)
    actions.ts                  # updateProfile, updateAvatar
    validation.ts               # Zod schema for profile fields
  workouts/
    schema.ts                    # workout_logs, exercise_logs, sets
    queries.ts                    # getWorkoutLogsForUser, getWorkoutLogById
    actions.ts                     # createWorkoutLog, updateWorkoutLog, deleteWorkoutLog
    suggest.ts                     # suggestNextWorkout() pure function
  exercises/
    schema.ts                      # custom_exercises
    queries.ts                      # getExerciseOptionsForUser
    actions.ts                      # addCustomExercise
drizzle/
  ...                               # generated migrations (drizzle-kit)
drizzle.config.ts
proxy.ts                            # project root
scripts/
  promote-admin.ts
src/app/login/page.tsx
src/app/signup/page.tsx
vitest.config.ts
src/lib/server/workouts/suggest.test.ts
```

Modified (rewired, not restructured):
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/log/page.tsx`
- `src/app/(app)/log/[id]/page.tsx`
- `src/app/(app)/history/page.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/components/workout-form.tsx`
- `src/components/exercise-picker.tsx`
- `src/components/layout/app-shell.tsx` (add logout action + real user name)

Deleted:
- `src/lib/mock-data.ts`
- `src/hooks/use-workout-logs.ts`
- `src/hooks/use-exercise-options.ts`

---

### Task 1: Install dependencies and configure environment

**Files:**
- Modify: `package.json`
- Create: `.env.local.example`
- Modify: `.gitignore` (ensure `.env*.local` is ignored — check first)

**Interfaces:**
- Produces: env vars `DATABASE_URL`, `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN` consumed by later tasks.

- [ ] **Step 1: Install runtime dependencies**

Run:
```bash
npm install drizzle-orm @neondatabase/serverless jose bcryptjs zod @vercel/blob
```

- [ ] **Step 2: Install dev dependencies**

Run:
```bash
npm install -D drizzle-kit vitest @types/bcryptjs
```

- [ ] **Step 3: Create `.env.local.example`**

```bash
# Neon Postgres connection string (from Vercel Storage > Neon, or neon.tech dashboard)
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require

# Generate with: openssl rand -base64 32
SESSION_SECRET=

# From Vercel Storage > Blob (or `vercel blob` CLI)
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 4: Verify `.env*.local` is gitignored**

Run: `grep -n "env" .gitignore`
Expected: a line matching `.env*.local` (Next.js's default `.gitignore` includes this). If missing, add it.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.local.example .gitignore
git commit -m "chore: add auth/db/blob dependencies and env template"
```

---

### Task 2: Drizzle client and config

**Files:**
- Create: `src/lib/server/db.ts`
- Create: `drizzle.config.ts`

**Interfaces:**
- Produces: `db` (Drizzle instance) exported from `src/lib/server/db.ts`, imported by every domain's `queries.ts`/`actions.ts`.

- [ ] **Step 1: Create the Drizzle client**

```ts
// src/lib/server/db.ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle({ client: sql });
```

- [ ] **Step 2: Create `drizzle.config.ts`**

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./src/lib/server/auth/schema.ts",
    "./src/lib/server/workouts/schema.ts",
    "./src/lib/server/exercises/schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing `db.ts` or `drizzle.config.ts` (errors about missing schema files are expected and fixed in the next tasks).

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/db.ts drizzle.config.ts
git commit -m "feat: add drizzle client and config"
```

---

### Task 3: Auth schema (users table) and first migration

**Files:**
- Create: `src/lib/server/auth/schema.ts`
- Create: `drizzle/` (generated by `drizzle-kit generate`)

**Interfaces:**
- Produces: `users` table + `User` type, imported by every later task that touches auth or profile data.

- [ ] **Step 1: Define the `users` schema**

```ts
// src/lib/server/auth/schema.ts
import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  numeric,
  date,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  heightCm: numeric("height_cm"),
  weightKg: numeric("weight_kg"),
  dob: date("dob"),
  gender: text("gender", { enum: ["male", "female", "other", "prefer-not-to-say"] }),
  goal: text("goal", {
    enum: ["build-muscle", "lose-weight", "maintain", "improve-endurance"],
  }),
  activityLevel: text("activity_level", {
    enum: ["sedentary", "light", "moderate", "active"],
  }),
  unitPreference: text("unit_preference", { enum: ["kg", "lb"] })
    .notNull()
    .default("kg"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 2: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new SQL file under `drizzle/` creating the `users` table, with the unique index on `email`.

- [ ] **Step 3: Apply the migration to your Neon database**

Run: `npx drizzle-kit migrate`
Expected: command reports the migration applied with no errors. (Requires `DATABASE_URL` set in `.env.local` pointing at a real Neon database — create the free Neon project first if not done yet.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/auth/schema.ts drizzle/
git commit -m "feat: add users table schema and migration"
```

---

### Task 4: Session cookie utilities (JWT encrypt/decrypt)

**Files:**
- Create: `src/lib/server/auth/session.ts`
- Test: `src/lib/server/auth/session.test.ts`

**Interfaces:**
- Consumes: `process.env.SESSION_SECRET`.
- Produces: `encrypt(payload: SessionPayload): Promise<string>`, `decrypt(token: string | undefined): Promise<SessionPayload | null>`, `createSessionCookie(payload: SessionPayload): Promise<void>`, `deleteSessionCookie(): Promise<void>`, and the `SessionPayload = { userId: number; role: "admin" | "user" }` type — all consumed by `dal.ts` and `actions.ts` in Task 5/6.

- [ ] **Step 1: Set up Vitest**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

Add to `package.json` `scripts`: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/server/auth/session.test.ts
import { describe, expect, it, beforeAll } from "vitest";
import { encrypt, decrypt } from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long";
});

describe("session encrypt/decrypt", () => {
  it("round-trips a valid payload", async () => {
    const token = await encrypt({ userId: 42, role: "user" });
    const payload = await decrypt(token);
    expect(payload).toEqual(expect.objectContaining({ userId: 42, role: "user" }));
  });

  it("returns null for a garbage token", async () => {
    const payload = await decrypt("not-a-real-token");
    expect(payload).toBeNull();
  });

  it("returns null for an undefined token", async () => {
    const payload = await decrypt(undefined);
    expect(payload).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/server/auth/session.test.ts`
Expected: FAIL — `./session` module not found.

- [ ] **Step 4: Implement session utilities**

```ts
// src/lib/server/auth/session.ts
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type SessionPayload = {
  userId: number;
  role: "admin" | "user";
};

const encodedKey = () => new TextEncoder().encode(process.env.SESSION_SECRET);
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey());
}

export async function decrypt(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.userId !== "number" ||
      (payload.role !== "admin" && payload.role !== "user")
    ) {
      return null;
    }
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

export async function createSessionCookie(payload: SessionPayload) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await encrypt(payload);
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/server/auth/session.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json src/lib/server/auth/session.ts src/lib/server/auth/session.test.ts
git commit -m "feat: add JWT session cookie encrypt/decrypt utilities"
```

---

### Task 5: Auth DAL (`verifySession`, `getCurrentUser`)

**Files:**
- Create: `src/lib/server/auth/dal.ts`

**Interfaces:**
- Consumes: `decrypt` from `session.ts` (Task 4), `db` from `db.ts` (Task 2), `users` from `auth/schema.ts` (Task 3).
- Produces: `verifySession(): Promise<SessionPayload>` (redirects to `/login` if invalid — callers can assume a non-null return), `getCurrentUser(): Promise<User>` (throws/redirects if not found) — both memoized per-request via `React.cache`, consumed by every page/action in later tasks.

- [ ] **Step 1: Implement the DAL**

```ts
// src/lib/server/auth/dal.ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { decrypt, type SessionPayload } from "./session";
import { db } from "@/lib/server/db";
import { users, type User } from "./schema";

export const verifySession = cache(async (): Promise<SessionPayload> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const session = await decrypt(token);

  if (!session) {
    redirect("/login");
  }

  return session;
});

export const getCurrentUser = cache(async (): Promise<User> => {
  const session = await verifySession();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));

  if (!user) {
    redirect("/login");
  }

  return user;
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no type errors in `dal.ts` (this task has no unit test — it depends on `next/headers`/`redirect`, which require a request context and are exercised via the manual browser testing in later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/auth/dal.ts
git commit -m "feat: add auth DAL with verifySession and getCurrentUser"
```

---

### Task 6: Signup, login, logout Server Actions

**Files:**
- Create: `src/lib/server/auth/validation.ts`
- Create: `src/lib/server/auth/actions.ts`

**Interfaces:**
- Consumes: `db`, `users`, `createSessionCookie`, `deleteSessionCookie`, `bcryptjs`.
- Produces: `signup(state, formData)`, `login(state, formData)` — both `(prevState: AuthFormState, formData: FormData) => Promise<AuthFormState>` for `useActionState`, and `logout()` — `() => Promise<never>` (always redirects). `AuthFormState = { errors?: Record<string, string[]>; message?: string } | undefined`. Consumed by the login/signup pages in Task 7.

- [ ] **Step 1: Define Zod schemas**

```ts
// src/lib/server/auth/validation.ts
import * as z from "zod";

export const SignupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  email: z.string().trim().email("Please enter a valid email."),
  password: z
    .string()
    .min(8, "Be at least 8 characters long.")
    .regex(/[a-zA-Z]/, "Contain at least one letter.")
    .regex(/[0-9]/, "Contain at least one number."),
});

export const LoginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

export type AuthFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;
```

- [ ] **Step 2: Implement the actions**

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

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
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

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/auth/validation.ts src/lib/server/auth/actions.ts
git commit -m "feat: add signup, login, and logout server actions"
```

---

### Task 7: Login and signup pages

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/signup/page.tsx`

**Interfaces:**
- Consumes: `login`, `signup` from Task 6; existing `Input`, `Label`, `Button`, `Card` UI components.

- [ ] **Step 1: Create the login page**

```tsx
// src/app/login/page.tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/lib/server/auth/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Log in to RepSetGo</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
              {state?.errors?.email && (
                <p className="text-xs text-destructive">{state.errors.email[0]}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
              {state?.errors?.password && (
                <p className="text-xs text-destructive">{state.errors.password[0]}</p>
              )}
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
    </div>
  );
}
```

- [ ] **Step 2: Create the signup page**

```tsx
// src/app/signup/page.tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/lib/server/auth/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Create your RepSetGo account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
              {state?.errors?.name && (
                <p className="text-xs text-destructive">{state.errors.name[0]}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
              {state?.errors?.email && (
                <p className="text-xs text-destructive">{state.errors.email[0]}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
              {state?.errors?.password && (
                <p className="text-xs text-destructive">{state.errors.password[0]}</p>
              )}
            </div>
            {state?.message && (
              <p className="text-xs text-destructive">{state.message}</p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Creating account..." : "Sign up"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, visit `http://localhost:3000/signup`, create an account.
Expected: redirected to `/dashboard` (will 404 or error until Task 10 adds route protection/pages exist — that's fine, confirm no crash on the signup form submission itself and that a `session` cookie is set in devtools).

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx src/app/signup/page.tsx
git commit -m "feat: add login and signup pages"
```

---

### Task 8: Route protection via `proxy.ts`

**Files:**
- Create: `proxy.ts` (project root)

**Interfaces:**
- Consumes: `decrypt` from `session.ts` (Task 4).

- [ ] **Step 1: Implement optimistic route protection**

```ts
// proxy.ts
import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/server/auth/session";

const publicRoutes = ["/login", "/signup"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);
  const isAdminRoute = path.startsWith("/admin");

  const token = req.cookies.get("session")?.value;
  const session = await decrypt(token);

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (session && isPublicRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  if (isAdminRoute && session?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
```

- [ ] **Step 2: Manually verify in the browser**

Run: `npm run dev`.
- Visit `/dashboard` while logged out → expect redirect to `/login`.
- Log in → expect redirect away from `/login` to `/dashboard`.
- Visit `/admin` while logged in as a non-admin user → expect redirect to `/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat: add proxy-based route protection for auth and admin routes"
```

---

### Task 9: Promote-admin script

**Files:**
- Create: `scripts/promote-admin.ts`

**Interfaces:**
- Consumes: `db`, `users` from Task 2/3.

- [ ] **Step 1: Write the script**

```ts
// scripts/promote-admin.ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";

const email = process.argv[2];

if (!email) {
  console.error("Usage: npx tsx scripts/promote-admin.ts <email>");
  process.exit(1);
}

async function main() {
  const [updated] = await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email, role: users.role });

  if (!updated) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  console.log(`Promoted ${updated.email} (id ${updated.id}) to admin.`);
}

main();
```

- [ ] **Step 2: Add a convenience script**

Add to `package.json` `scripts`: `"promote-admin": "tsx scripts/promote-admin.ts"`.
Run: `npm install -D tsx`

- [ ] **Step 3: Manually verify**

Sign up a test account via `/signup`, then run:
Run: `npm run promote-admin -- you@example.com`
Expected: prints `Promoted you@example.com (id N) to admin.` Confirm in the database (or by logging in and visiting `/admin`) that the role changed.

- [ ] **Step 4: Commit**

```bash
git add scripts/promote-admin.ts package.json package-lock.json
git commit -m "feat: add promote-admin script for bootstrapping the first admin"
```

---

### Task 10: Workouts schema and migration

**Files:**
- Create: `src/lib/server/workouts/schema.ts`

**Interfaces:**
- Produces: `workoutLogs`, `exerciseLogs`, `sets` tables + `WorkoutLog`, `ExerciseLog`, `Set` types, consumed by `workouts/queries.ts` and `workouts/actions.ts` (Task 12).

- [ ] **Step 1: Define the schema**

```ts
// src/lib/server/workouts/schema.ts
import {
  pgTable,
  serial,
  integer,
  text,
  date,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "@/lib/server/auth/schema";

export const workoutLogs = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  label: text("label").notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exerciseLogs = pgTable("exercise_logs", {
  id: serial("id").primaryKey(),
  workoutLogId: integer("workout_log_id")
    .notNull()
    .references(() => workoutLogs.id, { onDelete: "cascade" }),
  exerciseName: text("exercise_name").notNull(),
  order: integer("order").notNull(),
});

export const sets = pgTable("sets", {
  id: serial("id").primaryKey(),
  exerciseLogId: integer("exercise_log_id")
    .notNull()
    .references(() => exerciseLogs.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  reps: integer("reps").notNull(),
  weight: numeric("weight").notNull(),
});

export type WorkoutLogRow = typeof workoutLogs.$inferSelect;
export type ExerciseLogRow = typeof exerciseLogs.$inferSelect;
export type SetRow = typeof sets.$inferSelect;
```

Note: `onDelete: "cascade"` on the child tables means deleting a `workoutLog` also deletes its `exerciseLogs` and their `sets` — required for `deleteWorkoutLog` (Task 12) to be a single-statement operation instead of manual cascading deletes.

- [ ] **Step 2: Generate and apply the migration**

Run: `npx drizzle-kit generate`
Run: `npx drizzle-kit migrate`
Expected: `workout_logs`, `exercise_logs`, `sets` tables created, with indexes on `workout_logs.user_id`, `exercise_logs.workout_log_id`, `sets.exercise_log_id` (Drizzle creates an index automatically for `references()` foreign keys via the generated migration — confirm by inspecting the generated SQL file under `drizzle/`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/workouts/schema.ts drizzle/
git commit -m "feat: add workout_logs, exercise_logs, sets schema and migration"
```

---

### Task 11: Suggested-workout pure function (TDD)

**Files:**
- Create: `src/lib/server/workouts/suggest.ts`
- Test: `src/lib/server/workouts/suggest.test.ts`

**Interfaces:**
- Consumes: nothing (pure function, no DB).
- Produces: `suggestNextWorkout(logs: SuggestInput[]): Suggestion`, `SuggestInput = { label: string; date: string; exerciseNames: string[] }`, `Suggestion = { label: string; reason: string; exercises: string[] }` — consumed by `getSuggestionForUser` in Task 12, which the dashboard page uses in Task 15.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/server/workouts/suggest.test.ts
import { describe, expect, it } from "vitest";
import { suggestNextWorkout } from "./suggest";

describe("suggestNextWorkout", () => {
  it("suggests the label that has gone longest without being logged", () => {
    const logs = [
      { label: "Push Day", date: "2026-08-05", exerciseNames: ["Bench Press"] },
      { label: "Pull Day", date: "2026-08-01", exerciseNames: ["Deadlift"] },
      { label: "Leg Day", date: "2026-07-20", exerciseNames: ["Squat"] },
    ];
    const result = suggestNextWorkout(logs);
    expect(result.label).toBe("Leg Day");
    expect(result.exercises).toEqual(["Squat"]);
  });

  it("includes the day count since the last session of that label in the reason", () => {
    const logs = [
      { label: "Push Day", date: "2026-08-05", exerciseNames: ["Bench Press"] },
      { label: "Leg Day", date: "2026-07-20", exerciseNames: ["Squat"] },
    ];
    // relative to a fixed "today" passed explicitly, to keep the test deterministic
    const result = suggestNextWorkout(logs, new Date("2026-08-07"));
    expect(result.reason).toContain("18 days");
    expect(result.reason).toContain("Leg Day");
  });

  it("falls back to a generic message when there are no logs yet", () => {
    const result = suggestNextWorkout([]);
    expect(result.label).toBe("Full Body");
    expect(result.reason).toContain("Log your first workout");
    expect(result.exercises).toEqual([]);
  });

  it("handles a single distinct label by re-suggesting it", () => {
    const logs = [
      { label: "Push Day", date: "2026-08-01", exerciseNames: ["Bench Press"] },
    ];
    const result = suggestNextWorkout(logs, new Date("2026-08-07"));
    expect(result.label).toBe("Push Day");
    expect(result.exercises).toEqual(["Bench Press"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/server/workouts/suggest.test.ts`
Expected: FAIL — `./suggest` module not found.

- [ ] **Step 3: Implement `suggestNextWorkout`**

```ts
// src/lib/server/workouts/suggest.ts
export type SuggestInput = {
  label: string;
  date: string; // ISO date, e.g. "2026-08-05"
  exerciseNames: string[];
};

export type Suggestion = {
  label: string;
  reason: string;
  exercises: string[];
};

export function suggestNextWorkout(
  logs: SuggestInput[],
  today: Date = new Date()
): Suggestion {
  if (logs.length === 0) {
    return {
      label: "Full Body",
      reason: "Log your first workout to get personalized suggestions.",
      exercises: [],
    };
  }

  const mostRecentByLabel = new Map<string, SuggestInput>();
  for (const log of logs) {
    const existing = mostRecentByLabel.get(log.label);
    if (!existing || log.date > existing.date) {
      mostRecentByLabel.set(log.label, log);
    }
  }

  let oldest: SuggestInput | null = null;
  for (const log of mostRecentByLabel.values()) {
    if (!oldest || log.date < oldest.date) {
      oldest = log;
    }
  }

  // Non-null: mostRecentByLabel has at least one entry since logs.length > 0.
  const chosen = oldest!;
  const daysSince = Math.round(
    (today.getTime() - new Date(chosen.date).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    label: chosen.label,
    reason: `It's been ${daysSince} days since your last ${chosen.label} session.`,
    exercises: chosen.exerciseNames,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/server/workouts/suggest.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/workouts/suggest.ts src/lib/server/workouts/suggest.test.ts
git commit -m "feat: add suggestNextWorkout pure function with tests"
```

---

### Task 12: Workout queries and Server Actions

**Files:**
- Create: `src/lib/server/workouts/queries.ts`
- Create: `src/lib/server/workouts/actions.ts`

**Interfaces:**
- Consumes: `db`, `workoutLogs`, `exerciseLogs`, `sets` (Task 10), `verifySession` (Task 5), `suggestNextWorkout` (Task 11).
- Produces:
  - `getWorkoutLogsForUser(userId: number): Promise<WorkoutLogWithDetails[]>`
  - `getWorkoutLogById(id: number, userId: number): Promise<WorkoutLogWithDetails | null>`
  - `getSuggestionForUser(userId: number): Promise<Suggestion>`
  - `createWorkoutLog(formData: FormData): Promise<{ error: string } | never>` (redirects on success)
  - `updateWorkoutLog(id: number, formData: FormData): Promise<{ error: string } | never>`
  - `deleteWorkoutLog(id: number): Promise<{ error: string } | void>`
  - `WorkoutLogWithDetails = { id: number; date: string; label: string; notes: string | null; exercises: { id: number; exerciseName: string; sets: { setNumber: number; reps: number; weight: number }[] }[] }`
  All consumed by the page rewiring in Task 13 and the `WorkoutForm` rewiring in Task 14.

- [ ] **Step 1: Implement queries**

```ts
// src/lib/server/workouts/queries.ts
import "server-only";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { workoutLogs, exerciseLogs, sets } from "./schema";
import { suggestNextWorkout, type Suggestion } from "./suggest";

export type WorkoutLogWithDetails = {
  id: number;
  date: string;
  label: string;
  notes: string | null;
  exercises: {
    id: number;
    exerciseName: string;
    sets: { setNumber: number; reps: number; weight: number }[];
  }[];
};

export async function getWorkoutLogsForUser(
  userId: number
): Promise<WorkoutLogWithDetails[]> {
  const logs = await db
    .select()
    .from(workoutLogs)
    .where(eq(workoutLogs.userId, userId))
    .orderBy(desc(workoutLogs.date));

  return Promise.all(logs.map((log) => attachDetails(log)));
}

export async function getWorkoutLogById(
  id: number,
  userId: number
): Promise<WorkoutLogWithDetails | null> {
  const [log] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, userId)));

  if (!log) return null;
  return attachDetails(log);
}

async function attachDetails(log: {
  id: number;
  date: string;
  label: string;
  notes: string | null;
}): Promise<WorkoutLogWithDetails> {
  const exercises = await db
    .select()
    .from(exerciseLogs)
    .where(eq(exerciseLogs.workoutLogId, log.id))
    .orderBy(exerciseLogs.order);

  const exercisesWithSets = await Promise.all(
    exercises.map(async (ex) => {
      const exSets = await db
        .select()
        .from(sets)
        .where(eq(sets.exerciseLogId, ex.id))
        .orderBy(sets.setNumber);

      return {
        id: ex.id,
        exerciseName: ex.exerciseName,
        sets: exSets.map((s) => ({
          setNumber: s.setNumber,
          reps: s.reps,
          weight: Number(s.weight),
        })),
      };
    })
  );

  return {
    id: log.id,
    date: log.date,
    label: log.label,
    notes: log.notes,
    exercises: exercisesWithSets,
  };
}

export async function getSuggestionForUser(userId: number): Promise<Suggestion> {
  const logs = await getWorkoutLogsForUser(userId);
  return suggestNextWorkout(
    logs.map((log) => ({
      label: log.label,
      date: log.date,
      exerciseNames: log.exercises.map((e) => e.exerciseName),
    }))
  );
}
```

- [ ] **Step 2: Implement Server Actions**

```ts
// src/lib/server/workouts/actions.ts
"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { verifySession } from "@/lib/server/auth/dal";
import { workoutLogs, exerciseLogs, sets } from "./schema";

type ParsedExercise = {
  exerciseName: string;
  order: number;
  setsList: { setNumber: number; reps: number; weight: number }[];
};

function parseWorkoutForm(formData: FormData): {
  label: string;
  date: string;
  notes: string | null;
  exercises: ParsedExercise[];
} {
  const exerciseCount = Number(formData.get("exerciseCount") ?? 0);
  const exercises: ParsedExercise[] = [];

  for (let i = 0; i < exerciseCount; i++) {
    const exerciseName = String(formData.get(`exercise-${i}-name`) ?? "").trim();
    if (!exerciseName) continue;

    const setCount = Number(formData.get(`exercise-${i}-setCount`) ?? 0);
    const setsList = [];
    for (let s = 0; s < setCount; s++) {
      setsList.push({
        setNumber: s + 1,
        reps: Number(formData.get(`exercise-${i}-set-${s}-reps`) ?? 0),
        weight: Number(formData.get(`exercise-${i}-set-${s}-weight`) ?? 0),
      });
    }

    exercises.push({ exerciseName, order: i, setsList });
  }

  return {
    label: String(formData.get("label") ?? "").trim(),
    date: String(formData.get("date") ?? ""),
    notes: String(formData.get("notes") ?? "").trim() || null,
    exercises,
  };
}

export async function createWorkoutLog(formData: FormData) {
  const session = await verifySession();
  const parsed = parseWorkoutForm(formData);

  if (!parsed.label || !parsed.date || parsed.exercises.length === 0) {
    return { error: "Add a workout name, date, and at least one exercise." };
  }

  const [log] = await db
    .insert(workoutLogs)
    .values({
      userId: session.userId,
      label: parsed.label,
      date: parsed.date,
      notes: parsed.notes,
    })
    .returning({ id: workoutLogs.id });

  await insertExercisesAndSets(log.id, parsed.exercises);

  revalidatePath("/history");
  revalidatePath("/dashboard");
  redirect("/history");
}

export async function updateWorkoutLog(id: number, formData: FormData) {
  const session = await verifySession();
  const parsed = parseWorkoutForm(formData);

  if (!parsed.label || !parsed.date || parsed.exercises.length === 0) {
    return { error: "Add a workout name, date, and at least one exercise." };
  }

  const [existing] = await db
    .select({ id: workoutLogs.id })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, session.userId)));

  if (!existing) {
    return { error: "Workout not found." };
  }

  await db
    .update(workoutLogs)
    .set({ label: parsed.label, date: parsed.date, notes: parsed.notes })
    .where(eq(workoutLogs.id, id));

  // Simplest correct approach for an edit: replace all exercises/sets for this log.
  // exerciseLogs -> sets cascade delete (see schema.ts), so this is one statement.
  await db.delete(exerciseLogs).where(eq(exerciseLogs.workoutLogId, id));
  await insertExercisesAndSets(id, parsed.exercises);

  revalidatePath("/history");
  revalidatePath("/dashboard");
  redirect("/history");
}

export async function deleteWorkoutLog(id: number) {
  const session = await verifySession();

  const [existing] = await db
    .select({ id: workoutLogs.id })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.userId, session.userId)));

  if (!existing) {
    return { error: "Workout not found." };
  }

  await db.delete(workoutLogs).where(eq(workoutLogs.id, id));
  revalidatePath("/history");
  revalidatePath("/dashboard");
}

async function insertExercisesAndSets(
  workoutLogId: number,
  exercises: ParsedExercise[]
) {
  for (const exercise of exercises) {
    const [exerciseLog] = await db
      .insert(exerciseLogs)
      .values({
        workoutLogId,
        exerciseName: exercise.exerciseName,
        order: exercise.order,
      })
      .returning({ id: exerciseLogs.id });

    if (exercise.setsList.length > 0) {
      await db.insert(sets).values(
        exercise.setsList.map((s) => ({
          exerciseLogId: exerciseLog.id,
          setNumber: s.setNumber,
          reps: s.reps,
          weight: String(s.weight),
        }))
      );
    }
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/workouts/queries.ts src/lib/server/workouts/actions.ts
git commit -m "feat: add workout log queries and CRUD server actions"
```

---

### Task 13: Rewire `WorkoutForm` to submit via Server Actions

**Files:**
- Modify: `src/components/workout-form.tsx`
- Modify: `src/app/(app)/log/page.tsx`
- Modify: `src/app/(app)/log/[id]/page.tsx`

**Interfaces:**
- Consumes: `createWorkoutLog`, `updateWorkoutLog` (Task 12), `getWorkoutLogById` (Task 12), `verifySession` (Task 5), `getExerciseOptionsForUser`/`addCustomExercise` (Task 14).

**Execution order note:** this task depends on Task 14 (exercises) for `ExercisePicker`'s data source. Execute **Task 14 before Task 13** — the controller will dispatch them in that order (14 then 13) even though they are numbered and written in the order 13, 14 above.

- [ ] **Step 1: Change `WorkoutForm`'s submit contract from `onSave` callback to a form `action`**

Replace the `handleSave`/`onSave` prop pattern with a hidden-field-based `FormData` submission compatible with `createWorkoutLog`/`updateWorkoutLog`'s parsing convention (`exerciseCount`, `exercise-{i}-name`, `exercise-{i}-setCount`, `exercise-{i}-set-{s}-reps`, `exercise-{i}-set-{s}-weight`).

```tsx
// src/components/workout-form.tsx
// (keep existing imports; remove the `onSave` prop and `handleSave` function)
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExercisePicker } from "@/components/exercise-picker";
import { Trash2, Plus } from "lucide-react";
import type { WorkoutLogWithDetails } from "@/lib/server/workouts/queries";

type DraftSet = { id: string; reps: string; weight: string };
type DraftExercise = { id: string; exerciseName: string; sets: DraftSet[] };

let idCounter = 0;
const nextId = () => `d${idCounter++}`;

function toDraftExercises(log?: WorkoutLogWithDetails): DraftExercise[] {
  if (!log) {
    return [
      { id: nextId(), exerciseName: "", sets: [{ id: nextId(), reps: "", weight: "" }] },
    ];
  }
  return log.exercises.map((ex) => ({
    id: nextId(),
    exerciseName: ex.exerciseName,
    sets: ex.sets.map((s) => ({
      id: nextId(),
      reps: String(s.reps),
      weight: String(s.weight),
    })),
  }));
}

export function WorkoutForm({
  initialLog,
  exerciseOptions,
  onAddCustomExercise,
  action,
  onCancel,
}: {
  initialLog?: WorkoutLogWithDetails;
  exerciseOptions: string[];
  onAddCustomExercise: (name: string) => void;
  action: (formData: FormData) => void;
  onCancel?: () => void;
}) {
  const [workoutLabel, setWorkoutLabel] = useState(initialLog?.label ?? "Push Day");
  const [workoutDate, setWorkoutDate] = useState(
    initialLog?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(initialLog?.notes ?? "");
  const [exercises, setExercises] = useState<DraftExercise[]>(() =>
    toDraftExercises(initialLog)
  );

  function addExercise() {
    setExercises((prev) => [
      ...prev,
      { id: nextId(), exerciseName: "", sets: [{ id: nextId(), reps: "", weight: "" }] },
    ]);
  }

  function removeExercise(id: string) {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }

  function updateExerciseName(id: string, name: string) {
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, exerciseName: name } : e))
    );
  }

  function addSet(exerciseId: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? { ...e, sets: [...e.sets, { id: nextId(), reps: "", weight: "" }] }
          : e
      )
    );
  }

  function removeSet(exerciseId: string, setId: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
          : e
      )
    );
  }

  function updateSet(
    exerciseId: string,
    setId: string,
    field: "reps" | "weight",
    value: string
  ) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? {
              ...e,
              sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
            }
          : e
      )
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="exerciseCount" value={exercises.length} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="workout-label">Workout name</Label>
              <Input
                id="workout-label"
                name="label"
                value={workoutLabel}
                onChange={(e) => setWorkoutLabel(e.target.value)}
                placeholder="e.g. Push Day"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="workout-date">Date</Label>
              <Input
                id="workout-date"
                name="date"
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workout-notes">Notes (optional)</Label>
            <Textarea
              id="workout-notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {exercises.map((exercise, exIdx) => (
          <Card key={exercise.id}>
            <input type="hidden" name={`exercise-${exIdx}-name`} value={exercise.exerciseName} />
            <input type="hidden" name={`exercise-${exIdx}-setCount`} value={exercise.sets.length} />
            <CardHeader className="flex flex-row items-end justify-between gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor={`exercise-${exercise.id}`}>Exercise</Label>
                <ExercisePicker
                  id={`exercise-${exercise.id}`}
                  value={exercise.exerciseName}
                  options={exerciseOptions}
                  onChange={(name) => updateExerciseName(exercise.id, name)}
                  onAddCustom={onAddCustomExercise}
                />
              </div>
              {exercises.length > 1 && (
                <Button variant="ghost" size="icon" type="button" onClick={() => removeExercise(exercise.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>Set</span>
                <span>Reps</span>
                <span>Weight (kg)</span>
                <span />
              </div>
              {exercise.sets.map((set, setIdx) => (
                <div key={set.id} className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{setIdx + 1}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    name={`exercise-${exIdx}-set-${setIdx}-reps`}
                    value={set.reps}
                    onChange={(e) => updateSet(exercise.id, set.id, "reps", e.target.value)}
                    placeholder="10"
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    name={`exercise-${exIdx}-set-${setIdx}-weight`}
                    value={set.weight}
                    onChange={(e) => updateSet(exercise.id, set.id, "weight", e.target.value)}
                    placeholder="60"
                  />
                  {exercise.sets.length > 1 ? (
                    <Button variant="ghost" size="icon" type="button" onClick={() => removeSet(exercise.id, set.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" type="button" className="mt-1 w-fit" onClick={() => addSet(exercise.id)}>
                <Plus className="h-3.5 w-3.5" /> Add set
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="secondary" type="button" onClick={addExercise}>
        <Plus className="h-4 w-4" /> Add exercise
      </Button>

      <div className="sticky bottom-16 flex gap-2 md:bottom-4">
        {onCancel && (
          <Button variant="outline" type="button" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="flex-1" size="lg">
          {initialLog ? "Save Changes" : "Save Workout"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Rewire the "new log" page**

```tsx
// src/app/(app)/log/page.tsx
import { WorkoutForm } from "@/components/workout-form";
import { createWorkoutLog } from "@/lib/server/workouts/actions";
import { getExerciseOptionsForUser } from "@/lib/server/exercises/queries";
import { addCustomExercise } from "@/lib/server/exercises/actions";
import { verifySession } from "@/lib/server/auth/dal";

export default async function LogWorkoutPage() {
  const session = await verifySession();
  const exerciseOptions = await getExerciseOptionsForUser(session.userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Log Workout</h1>
        <p className="text-sm text-muted-foreground">
          Add exercises and sets as you go
        </p>
      </div>

      <WorkoutForm
        exerciseOptions={exerciseOptions}
        onAddCustomExercise={addCustomExercise}
        action={createWorkoutLog}
      />
    </div>
  );
}
```

- [ ] **Step 3: Rewire the "edit log" page**

```tsx
// src/app/(app)/log/[id]/page.tsx
import Link from "next/link";
import { verifySession } from "@/lib/server/auth/dal";
import { getWorkoutLogById } from "@/lib/server/workouts/queries";
import { updateWorkoutLog } from "@/lib/server/workouts/actions";
import { getExerciseOptionsForUser } from "@/lib/server/exercises/queries";
import { addCustomExercise } from "@/lib/server/exercises/actions";
import { WorkoutForm } from "@/components/workout-form";
import { Button } from "@/components/ui/button";

export default async function EditWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();
  const log = await getWorkoutLogById(Number(id), session.userId);

  if (!log) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Workout not found</h1>
        <Button render={<Link href="/history" />} nativeButton={false} className="w-fit">
          Back to history
        </Button>
      </div>
    );
  }

  const exerciseOptions = await getExerciseOptionsForUser(session.userId);
  const updateAction = updateWorkoutLog.bind(null, log.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Workout</h1>
        <p className="text-sm text-muted-foreground">{log.label}</p>
      </div>

      <WorkoutForm
        initialLog={log}
        exerciseOptions={exerciseOptions}
        onAddCustomExercise={addCustomExercise}
        action={updateAction}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, log in, visit `/log`, create a workout with two exercises and multiple sets, submit.
Expected: redirected to `/history` and the new workout appears with correct exercises/sets. Edit it via the pencil icon, change a value, save, confirm the change persists.

- [ ] **Step 5: Commit**

```bash
git add src/components/workout-form.tsx "src/app/(app)/log/page.tsx" "src/app/(app)/log/[id]/page.tsx"
git commit -m "feat: rewire WorkoutForm and log pages to use server actions"
```

---

### Task 14: Exercises schema, queries, and Server Actions

**Files:**
- Create: `src/lib/server/exercises/schema.ts`
- Create: `src/lib/server/exercises/queries.ts`
- Create: `src/lib/server/exercises/actions.ts`
- Modify: `src/components/exercise-picker.tsx`

**Interfaces:**
- Produces: `customExercises` table; `getExerciseOptionsForUser(userId: number): Promise<string[]>`; `addCustomExercise(name: string): Promise<void>` (Server Action, reads the current user via `verifySession` itself rather than taking a `userId` param, so it can be passed directly as a callback).
- Consumed by: `log/page.tsx` and `log/[id]/page.tsx` (Task 13), `exercise-picker.tsx`.

- [ ] **Step 1: Define the schema**

```ts
// src/lib/server/exercises/schema.ts
import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { users } from "@/lib/server/auth/schema";

export const customExercises = pgTable("custom_exercises", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
});
```

Add `"./src/lib/server/exercises/schema.ts"` to the `schema` array in `drizzle.config.ts` (Task 2).

- [ ] **Step 2: Generate and apply the migration**

Run: `npx drizzle-kit generate`
Run: `npx drizzle-kit migrate`
Expected: `custom_exercises` table created with an index on `user_id`.

- [ ] **Step 3: Implement queries and actions**

```ts
// src/lib/server/exercises/queries.ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { customExercises } from "./schema";

export const BASE_EXERCISE_CATALOG = [
  "Bench Press",
  "Incline Dumbbell Press",
  "Barbell Squat",
  "Deadlift",
  "Overhead Press",
  "Barbell Row",
  "Pull Up",
  "Bicep Curl",
  "Tricep Pushdown",
  "Lat Pulldown",
];

export async function getExerciseOptionsForUser(userId: number): Promise<string[]> {
  const rows = await db
    .select({ name: customExercises.name })
    .from(customExercises)
    .where(eq(customExercises.userId, userId));

  const custom = rows.map((r) => r.name);
  const seen = new Set(BASE_EXERCISE_CATALOG.map((n) => n.toLowerCase()));
  const merged = [...BASE_EXERCISE_CATALOG];
  for (const name of custom) {
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      merged.push(name);
    }
  }
  return merged;
}
```

```ts
// src/lib/server/exercises/actions.ts
"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { verifySession } from "@/lib/server/auth/dal";
import { customExercises } from "./schema";
import { BASE_EXERCISE_CATALOG } from "./queries";

export async function addCustomExercise(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const isBase = BASE_EXERCISE_CATALOG.some(
    (n) => n.toLowerCase() === trimmed.toLowerCase()
  );
  if (isBase) return;

  const session = await verifySession();

  const [existing] = await db
    .select({ id: customExercises.id })
    .from(customExercises)
    .where(
      and(eq(customExercises.userId, session.userId), eq(customExercises.name, trimmed))
    );

  if (existing) return;

  await db.insert(customExercises).values({ userId: session.userId, name: trimmed });
}
```

- [ ] **Step 4: Update `ExercisePicker`'s `onAddCustom` to accept an async action**

`src/components/exercise-picker.tsx`'s `onAddCustom` prop type changes from `(name: string) => void` to `(name: string) => void | Promise<void>` — no other changes needed since it's already called fire-and-forget in `commit()`. Modify only the type signature:

```tsx
// src/components/exercise-picker.tsx
// change the prop type on the component signature:
onAddCustom,
}: {
  id?: string;
  value: string;
  options: string[];
  onChange: (name: string) => void;
  onAddCustom: (name: string) => void | Promise<void>;
}) {
```

- [ ] **Step 5: Manually verify in the browser**

Log in, go to `/log`, type a brand-new exercise name in the picker, select "Add [name]", save the workout. Reload `/log` and confirm the custom exercise now appears in the picker's option list for that same user.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/exercises/ drizzle/ src/components/exercise-picker.tsx drizzle.config.ts
git commit -m "feat: add per-user custom exercises backed by the database"
```

---

### Task 15: Rewire dashboard and history pages

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/history/page.tsx`

**Interfaces:**
- Consumes: `verifySession` (Task 5), `getWorkoutLogsForUser`, `getSuggestionForUser` (Task 12), `deleteWorkoutLog` (Task 12).

- [ ] **Step 1: Rewire the dashboard**

```tsx
// src/app/(app)/dashboard/page.tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { verifySession } from "@/lib/server/auth/dal";
import { getWorkoutLogsForUser, getSuggestionForUser } from "@/lib/server/workouts/queries";
import { Flame, TrendingUp, CalendarDays } from "lucide-react";

export default async function DashboardPage() {
  const session = await verifySession();
  const [workoutLogs, suggestion] = await Promise.all([
    getWorkoutLogsForUser(session.userId),
    getSuggestionForUser(session.userId),
  ]);

  const totalSetsThisWeek = workoutLogs
    .flatMap((w) => w.exercises)
    .flatMap((e) => e.sets).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Good to see you 👋</h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s up for today, {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-primary" />
              Today&apos;s Suggested Workout
            </CardTitle>
          </div>
          <Badge variant="secondary">{suggestion.label}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
          <div className="flex flex-wrap gap-2">
            {suggestion.exercises.map((ex) => (
              <Badge key={ex} variant="outline">
                {ex}
              </Badge>
            ))}
          </div>
          <Button render={<Link href="/log" />} nativeButton={false} className="mt-2 w-full sm:w-fit">
            Start Logging
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Workouts
            </span>
            <span className="text-2xl font-semibold">{workoutLogs.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Sets logged
            </span>
            <span className="text-2xl font-semibold">{totalSetsThisWeek}</span>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Last workout</span>
            <span className="text-2xl font-semibold">{workoutLogs[0]?.label ?? "—"}</span>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent Logs</h2>
          <Link href="/history" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {workoutLogs.slice(0, 2).map((log) => (
            <Card key={log.id}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{log.label}</p>
                  <p className="text-xs text-muted-foreground">{log.date}</p>
                </div>
                <Badge variant="outline">{log.exercises.length} exercises</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewire the history page (client wrapper for delete/pagination interactivity, server component for data)**

Split into a server page that fetches data and a client component that renders the existing interactive accordion/pagination/dialog UI, since delete needs a Server Action call from client-side state:

```tsx
// src/app/(app)/history/page.tsx
import { verifySession } from "@/lib/server/auth/dal";
import { getWorkoutLogsForUser } from "@/lib/server/workouts/queries";
import { HistoryList } from "./history-list";

export default async function HistoryPage() {
  const session = await verifySession();
  const logs = await getWorkoutLogsForUser(session.userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-muted-foreground">All your logged workouts</p>
      </div>
      <HistoryList logs={logs} />
    </div>
  );
}
```

Create `src/app/(app)/history/history-list.tsx` with the existing accordion/pagination/delete-dialog JSX from the current `history/page.tsx` (Read the current file's markup, keep it verbatim), but:
- Rename the component to `HistoryList`, accepting `{ logs: WorkoutLogWithDetails[] }` as props instead of calling `useWorkoutLogs()`.
- Remove the `deleteLog` call from `useWorkoutLogs`; replace with:
```tsx
import { deleteWorkoutLog } from "@/lib/server/workouts/actions";
// ...
onClick={async () => {
  if (pendingDeleteId) {
    await deleteWorkoutLog(pendingDeleteId);
  }
  setPendingDeleteId(null);
}}
```
- Change `log.exercises.length` usages and `s.weight`/`s.reps` display — these already match `WorkoutLogWithDetails`'s shape, so no other changes needed.
- Mark the file `"use client"` (it retains `useState`/`useEffect` for pagination and the delete dialog).

- [ ] **Step 3: Manually verify in the browser**

Log in with an account that has a few logs (from Task 13's manual testing), visit `/dashboard` — confirm stats and suggestion reflect real data. Visit `/history`, delete a log via the trash icon and confirm dialog, confirm it disappears and the count updates.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx" "src/app/(app)/history/page.tsx" "src/app/(app)/history/history-list.tsx"
git commit -m "feat: rewire dashboard and history pages to real per-user data"
```

---

### Task 16: User profile queries and Server Action

**Files:**
- Create: `src/lib/server/users/validation.ts`
- Create: `src/lib/server/users/queries.ts`
- Create: `src/lib/server/users/actions.ts`

**Interfaces:**
- Consumes: `db`, `users` (Task 3), `verifySession` (Task 5).
- Produces: `getUserProfile(userId: number): Promise<User>` (thin re-export wrapper is unnecessary — pages use `getCurrentUser` from the DAL directly; this task's `queries.ts` is reserved for future user-domain reads beyond the DAL's scope, per the design's stated intent — kept present but minimal for now); `updateProfile(prevState, formData): Promise<ProfileFormState>` for `useActionState`.

- [ ] **Step 1: Define the Zod schema**

```ts
// src/lib/server/users/validation.ts
import * as z from "zod";

export const ProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  heightCm: z.coerce.number().positive().optional().or(z.literal("")),
  weightKg: z.coerce.number().positive().optional().or(z.literal("")),
  dob: z.string().optional(),
  gender: z.enum(["male", "female", "other", "prefer-not-to-say"]).optional(),
  goal: z
    .enum(["build-muscle", "lose-weight", "maintain", "improve-endurance"])
    .optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active"]).optional(),
  unitPreference: z.enum(["kg", "lb"]),
});

export type ProfileFormState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined;
```

- [ ] **Step 2: Implement the update action**

```ts
// src/lib/server/users/actions.ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { verifySession } from "@/lib/server/auth/dal";
import { ProfileSchema, type ProfileFormState } from "./validation";

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await verifySession();

  const validated = ProfileSchema.safeParse({
    name: formData.get("name"),
    heightCm: formData.get("heightCm") || "",
    weightKg: formData.get("weightKg") || "",
    dob: formData.get("dob") || undefined,
    gender: formData.get("gender") || undefined,
    goal: formData.get("goal") || undefined,
    activityLevel: formData.get("activityLevel") || undefined,
    unitPreference: formData.get("unitPreference"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, heightCm, weightKg, dob, gender, goal, activityLevel, unitPreference } =
    validated.data;

  await db
    .update(users)
    .set({
      name,
      heightCm: heightCm === "" ? null : String(heightCm),
      weightKg: weightKg === "" ? null : String(weightKg),
      dob: dob || null,
      gender,
      goal,
      activityLevel,
      unitPreference,
    })
    .where(eq(users.id, session.userId));

  revalidatePath("/settings");
  return { message: "Profile updated." };
}
```

```ts
// src/lib/server/users/queries.ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { users, type User } from "@/lib/server/auth/schema";

export async function getUserProfile(userId: number): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user ?? null;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/users/
git commit -m "feat: add profile update server action and validation"
```

---

### Task 17: Avatar upload via Vercel Blob

**Files:**
- Create: `src/lib/server/users/avatar-actions.ts`

**Interfaces:**
- Consumes: `@vercel/blob`'s `put`/`del`, `verifySession`, `db`, `users`.
- Produces: `uploadAvatar(formData: FormData): Promise<{ error: string } | { url: string }>`.

- [ ] **Step 1: Implement the upload action**

```ts
// src/lib/server/users/avatar-actions.ts
"use server";

import { put, del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/auth/schema";
import { verifySession } from "@/lib/server/auth/dal";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB, matches the UI's stated limit

export async function uploadAvatar(
  formData: FormData
): Promise<{ error: string } | { url: string }> {
  const session = await verifySession();
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file to upload." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File must be an image." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Image must be 2MB or smaller." };
  }

  const [current] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, session.userId));

  const blob = await put(`avatars/${session.userId}-${Date.now()}`, file, {
    access: "public",
  });

  await db
    .update(users)
    .set({ avatarUrl: blob.url })
    .where(eq(users.id, session.userId));

  if (current?.avatarUrl) {
    await del(current.avatarUrl).catch(() => {
      // Old blob may already be gone; not worth failing the upload over.
    });
  }

  revalidatePath("/settings");
  return { url: blob.url };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (Requires `BLOB_READ_WRITE_TOKEN` in `.env.local` — create a Blob store in the Vercel dashboard/CLI if not already done, per Task 1's `.env.local.example`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/users/avatar-actions.ts
git commit -m "feat: add avatar upload server action using vercel blob"
```

---

### Task 18: Rewire the settings page

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` (Task 5), `updateProfile` (Task 16), `uploadAvatar` (Task 17).

- [ ] **Step 1: Split into a server data-loading page and a client form component**

```tsx
// src/app/(app)/settings/page.tsx
import { getCurrentUser } from "@/lib/server/auth/dal";
import { AccountSettingsForm } from "./account-settings-form";

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
    </div>
  );
}
```

Create `src/app/(app)/settings/account-settings-form.tsx` adapted from the existing settings page markup (Read the current file, keep the Card/Label/Input/Select structure verbatim), with these changes:
- `"use client"` at the top.
- Props: `{ user: User }` (import `User` type from `@/lib/server/auth/schema`).
- Wrap the "Profile"/"Personal Info"/"Preferences" cards in a single `<form action={action}>` using `useActionState(updateProfile, undefined)`, matching the login/signup pattern from Task 7.
- Every `Input`/`Select` gets a `name` attribute matching `ProfileSchema`'s keys (`name`, `heightCm`, `weightKg`, `dob`, `gender`, `goal`, `activityLevel`, `unitPreference`) and `defaultValue={user.<field> ?? ...}` instead of hardcoded defaults.
- Email input keeps `disabled` and `defaultValue={user.email}` (no `name` attribute needed since it's never submitted).
- The avatar upload button/file input becomes its own small `<form>` calling `uploadAvatar` via `useActionState`, submitting on file selection (`onChange` triggers `formRef.current?.requestSubmit()`), showing `user.avatarUrl` as the `AvatarImage src` when present.
- The bottom "Save changes" button becomes `type="submit"` inside the main profile form (no separate `onClick` needed) with `disabled={pending}`.

- [ ] **Step 2: Manually verify in the browser**

Log in, visit `/settings`, change height/weight/goal/unit, click "Save changes" — reload the page and confirm values persisted. Upload a small JPG as avatar, confirm it displays and persists after reload. Try uploading a >2MB file and confirm the error message shows.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/settings/page.tsx" "src/app/(app)/settings/account-settings-form.tsx"
git commit -m "feat: rewire account settings page to persist profile and avatar"
```

---

### Task 19: Wire real user identity into `AppShell` and clean up dead code

**Files:**
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Delete: `src/lib/mock-data.ts`
- Delete: `src/hooks/use-workout-logs.ts`
- Delete: `src/hooks/use-exercise-options.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (Task 5), `logout` (Task 6).

- [ ] **Step 1: Read the current `AppShell` and `(app)/layout.tsx` to find where user name/avatar/logout would attach**

Run: `grep -n "Avatar\|initials\|Aashil\|logout\|Sign out" src/components/layout/app-shell.tsx`

- [ ] **Step 2: Pass the current user into `AppShell` and add a logout control**

Make `src/app/(app)/layout.tsx` async, call `getCurrentUser()`, and pass `user` as a prop into `<AppShell user={user}>`. Inside `AppShell`, replace any hardcoded name/avatar display with `user.name`/`user.avatarUrl`, and add a logout button/menu item that calls the `logout` Server Action from Task 6 (e.g. `<form action={logout}><button type="submit">Sign out</button></form>` or wired into an existing dropdown-menu item if one exists in the shell already).

- [ ] **Step 3: Confirm no remaining imports of the deleted modules**

Run: `grep -rn "mock-data\|use-workout-logs\|use-exercise-options" src/`
Expected: no matches (all pages/components from Tasks 13-18 already stopped importing these).

- [ ] **Step 4: Delete the dead files**

```bash
rm src/lib/mock-data.ts src/hooks/use-workout-logs.ts src/hooks/use-exercise-options.ts
```

- [ ] **Step 5: Full manual regression pass**

Run: `npm run dev`. As a fresh signup: sign up → land on dashboard → log a workout → see it in history → edit it → delete it → update settings/avatar → sign out → sign back in → confirm data persisted. Then run `npm run promote-admin -- <that email>` and confirm `/admin` is now reachable (admin page content itself is still mocked — phase 2 — but the route should no longer redirect away).

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (session round-trip + suggestNextWorkout).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire real user identity into app shell; remove mock/localStorage code"
```

---

## Self-Review Notes

- **Spec coverage:** auth (signup/login/logout/session/DAL) → Tasks 4-7; route protection → Task 8; first-admin bootstrap → Task 9; workout CRUD → Tasks 10-13; suggested workout → Task 11/15; per-user custom exercises → Task 14; profile persistence → Task 16/18; avatar via Vercel Blob → Task 17/18; error handling pattern (`useActionState`, `{error}` shapes, ownership checks in every action) → present in Tasks 6, 12, 16, 17; scalability notes (serverless driver, indexed FKs, stateless JWT, pagination reuse) → Task 2 (driver choice), Task 10 (indexes), Task 4 (stateless session), Task 15 (existing pagination preserved as-is in `HistoryList`). Testing plan (Vitest for pure logic) → Tasks 4, 11.
- **Admin panel data wiring** is explicitly out of scope per the spec's non-goals — not included here, correctly deferred to phase 2.
- **Type consistency check:** `WorkoutLogWithDetails` (Task 12) is used identically in Task 13 (`WorkoutForm` props), Task 15 (dashboard/history), matching field names (`label`, `date`, `notes`, `exercises[].exerciseName`, `exercises[].sets[].{setNumber,reps,weight}`) throughout. `SessionPayload` (Task 4) fields (`userId`, `role`) match usage in `dal.ts` (Task 5), `actions.ts` (Task 6), `proxy.ts` (Task 8), and `workouts/actions.ts` (Task 12).
