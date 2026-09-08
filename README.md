# Squares

A real-time multiplayer bingo app for small friend groups. A host builds a custom
card template, starts a room, and friends join with a six-character code. Everyone
gets their own deterministically shuffled card, marks squares live, and wins are
announced to the whole room.

Desktop-first — this is a personal project for a recurring game night, not a
product.

## Stack

- Next.js (App Router) + React + TypeScript (strict)
- Tailwind CSS + shadcn/ui, sonner for toasts
- Zustand for game state
- Supabase — Postgres, Auth (anonymous), Storage, and Realtime (broadcast +
  postgres_changes fallback)
- Cloudflare Workers (via OpenNext) for hosting

## Running locally

```bash
npm install
npm run dev          # http://localhost:3000
npx tsc --noEmit     # type check
npm run lint
```

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only — never expose to the client |

## Database

Migrations live in `supabase/migrations/` and are applied manually against the
Supabase project (`supabase db push`, or pasted into the SQL editor). They are
ordered by filename timestamp.

## Deployment

Deploys are automatic: pushing to `master` runs the GitHub Actions workflow that
builds with OpenNext and publishes to **Cloudflare Workers with Assets**. Do not
use Cloudflare Pages or `wrangler pages deploy` — this project is a Worker.

A second scheduled workflow pings Supabase twice a week to keep the free-tier
project from being paused for inactivity.
