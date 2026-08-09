# RepSetGo — Tech Stack, in Plain English

This explains what each piece of the app does and why it was picked, without assuming you already know the jargon.

## The big picture

Your app has three jobs: show pages to users, store their data somewhere permanent, and keep that data private to the right person. Everything below exists to do one of those three things.

## The framework: Next.js

**What it is:** the toolkit that turns your code into actual web pages. It handles routing (deciding what shows up at `/dashboard` vs `/settings`), rendering (turning your code into HTML), and lets the same codebase run both "show a page" logic and "save this to the database" logic.

**Why it matters here:** most of your pages (dashboard, history, log, settings) are written as functions that run *on the server*, fetch straight from the database, and send back finished HTML. There's no separate "API" your frontend has to call and wait on — the data is already there when the page arrives. Saving data (logging a workout, updating your profile) works the same way: a function called a **Server Action** runs on the server when you submit a form, no manual API-building required.

**Why this one, not something else:** it's the standard choice for this kind of app right now, has excellent docs, and lets a small app avoid needing a separate backend server at all — one codebase does both.

## The language: TypeScript

**What it is:** JavaScript with a spell-checker for *types* — it stops you from, say, accidentally treating a number like text, or forgetting a field a function needed.

**Why it matters here:** you're not writing this code by hand line-by-line — I am, often across many files at once. TypeScript catches a huge class of "oops, this doesn't actually fit together" mistakes before the app even runs, which matters a lot more when the code is being generated than when a single person is typing every line themselves.

## The database: Neon (Postgres)

**What it is:** Postgres is a battle-tested, general-purpose database — think of it as a very organized set of spreadsheets (`users`, `workout_logs`, `exercise_logs`, `sets`) that can be searched and cross-referenced instantly. Neon is a company that hosts Postgres for you, so you don't have to run your own database server.

**Why it matters here:** every real thing your app needs to remember — accounts, workouts, custom exercises, profile info — lives here. It's what replaced the old version's approach of stashing everything in the browser's local storage, which meant your data vanished if you cleared your browser or switched devices.

**Why this one:** Neon's free tier is generous, it works natively with the hosting platform you're using (Vercel), and — unlike some free-tier databases — it doesn't fully delete your project after a week of inactivity, just "goes to sleep" and wakes up in a second or two on the next request.

## The database toolkit: Drizzle

**What it is:** a translator between TypeScript code and actual database queries. Instead of writing raw SQL (`SELECT * FROM users WHERE id = ...`), the code says `db.select().from(users).where(eq(users.id, id))` — same result, but TypeScript-checked, so a typo in a column name is caught before it ever runs.

**Why this one:** it's lightweight — no extra background process, no code-generation step to babysit — which matters for a small app that shouldn't need heavyweight infrastructure to do simple things.

## Logging people in: bcryptjs + jose

Two small, separate tools for two separate jobs:

- **bcryptjs** scrambles passwords before they're stored, one-way — the database never holds your actual password, just a scrambled version that can be checked against but not reversed. Industry-standard approach; if the database were ever leaked, passwords wouldn't be readable.
- **jose** creates and checks the signed "session cookie" your browser holds after logging in — a small encrypted note saying "this browser belongs to user #7, role: user" that the server can verify wasn't tampered with, without having to check the database on every single click.

**Why hand-rolled instead of an off-the-shelf login library:** with only two account types (regular user, admin) and no need for "log in with Google" or similar, writing this directly is *less* code and complexity than adopting a bigger auth library and learning its rules — and it matches the pattern Next.js's own documentation recommends for exactly this situation.

## File storage: Vercel Blob

**What it is:** a place to store actual files (your profile photo) — separate from the database, which is better suited to structured data like "reps: 10, weight: 60kg" than raw image bytes.

**Why it matters here:** your avatar upload doesn't touch the database directly — the image goes to Blob storage, and the database just remembers *where* it is. Your store is configured **private**, meaning image files aren't fetchable by just anyone with the link — the app itself checks you're logged in before handing one over.

## Validation: Zod

**What it is:** a way of describing "what a valid piece of data looks like" (e.g., "email must look like an email, password must be at least 8 characters") in code, so the server can reject bad input with a clear reason instead of crashing or silently accepting garbage.

**Why it matters here:** used on signup/login and your profile form — anywhere a person types something that gets saved.

## Styling: Tailwind CSS

**What it is:** instead of writing separate CSS files, you describe how something should look directly where you use it (`text-sm text-muted-foreground` means "small, muted-color text"). The visual building blocks (buttons, cards, dropdowns) come from a component library called **Base UI** underneath, styled with Tailwind on top.

**Why it matters here:** it's why the app's look was buildable quickly and consistently across every page without a separate design tool.

## Testing: Vitest

**What it is:** a way to write small, automated checks that catch mistakes — e.g., "if I feed this function a made-up set of workout logs, does it correctly figure out which workout to suggest next?" These run in seconds and don't need a real browser or database.

**Why it matters here:** the trickiest pieces of logic (session security, workout-suggestion logic, form validation limits) have tests, so future changes can't quietly break them without a red flag.

## What's *not* here, on purpose

- **No separate backend/API server** — Next.js's Server Actions replace what would otherwise be a whole second codebase talking over HTTP.
- **No client-side data-fetching library** (like TanStack Query, Redux, etc.) — pages fetch their own data on the server before they're sent to you, so there's no separate "loading" dance to manage in the browser for most of the app.
- **No caching layer** (Redis, etc.) — deliberately skipped; the database queries are fast enough on their own at this app's scale, and caching adds complexity that isn't earning its keep yet.
