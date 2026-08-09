# RepSetGo

Simple, fast gym logging. Track workouts, sets, and reps; get suggested
next workouts based on your history; install it as a PWA on your phone.

Live at [myrepsetgo.vercel.app](https://myrepsetgo.vercel.app).

## Features

- Email/password auth with sessions (JWT, `jose`), optional "remember me"
- Log workouts with exercises, sets, reps, and weight; edit or delete past logs
- Custom exercises alongside a built-in catalog of common gym exercises
- Dashboard suggestions for your next workout, ranked by exercise frequency
- Avatar upload (Vercel Blob, private access)
- Welcome email on signup (Resend)
- Admin panel: manage users (roles, active/inactive, delete), toggle open registration
- Installable PWA (manifest, service worker, offline app-shell caching)

## Tech Stack

- [Next.js](https://nextjs.org) (App Router, Server Actions) + React 19
- [Drizzle ORM](https://orm.drizzle.team) + [Neon Postgres](https://neon.tech)
- [Vercel Blob](https://vercel.com/docs/vercel-blob) for avatar storage
- [Resend](https://resend.com) for transactional email
- `jose` (JWT sessions), `bcryptjs` (password hashing), `zod` (validation)
- Tailwind CSS + [Base UI](https://base-ui.com) components
- [Vitest](https://vitest.dev) for tests

## Getting Started

1. Copy `.env.local.example` to `.env.local` and fill in the values:
   - `DATABASE_URL` — Neon Postgres connection string
   - `SESSION_SECRET` — generate with `openssl rand -base64 32`
   - `BLOB_READ_WRITE_TOKEN` — from Vercel Storage > Blob
   - `RESEND_API_KEY` — from resend.com dashboard
   - `RESEND_FROM_EMAIL` — sender address (Resend's shared test domain works until you verify your own)

2. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build and start
- `npm run lint` — run ESLint
- `npm test` — run the Vitest suite
- `npm run promote-admin -- <email>` — promote an existing user to admin

## Deployment

Deployed on [Vercel](https://vercel.com). The `master` branch is the
production branch — merging into it triggers a production deploy. Other
branches (e.g. `development`) get their own preview deployment.
