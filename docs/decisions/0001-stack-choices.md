# Stack choices, and the version table they were written with

- **Date:** undated (table last edited in #12, 2026-09-08)
- **Symptom:** The table said Next.js 14+, Tailwind 3.x and Zustand 4.x; `package.json` has next 16.2.3, tailwindcss ^4 and zustand ^5.0.12, and no email/Google sign-in exists in `src/`.
- **Measurement:** none recorded
- **Rule:** Stay on Next.js + Supabase (Realtime, anonymous Auth, Storage) + Zustand + shadcn/ui: no custom socket server, no Redux. Read versions from `package.json`, not from a table in a doc.
- **Code site:** `package.json`; `src/app/globals.css` (`@theme inline`, Tailwind v4); `AGENTS.md` (Next.js 16 warning)

## Original note (moved verbatim from CLAUDE.md, 2026-09-22)

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14+ |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| UI Components | shadcn/ui | latest |
| State Management | Zustand | 4.x |
| Database | Supabase (PostgreSQL) | - |
| Real-time | Supabase Realtime (WebSocket channels) | - |
| Auth | Supabase Auth (anonymous + optional email/Google) | - |
| File Storage | Supabase Storage (images) | - |
| Testing | Vitest | 3.x |
| Hosting | Cloudflare Workers (OpenNext), deployed by GitHub Actions on push to `master` | - |

### Why these choices
- Next.js + Supabase: Owner already uses this stack (wardrobe app). No new paradigms to learn.
- Supabase Realtime: WebSocket channels for live game sync without a custom socket server.
- Zustand: Lightweight game state without Redux ceremony.
- shadcn/ui: Copy-paste components, fully customizable, dark mode built-in.
