# Identity is a browser ID and a claim code, not an account

- **Date:** undated (claim codes landed in #11, 2026-09-08)
- **Symptom:** The plan promised email/Google accounts with an anonymous-data merge; `src/` calls only `signInAnonymously` and has no merge path.
- **Measurement:** none recorded
- **Rule:** Identity is the `localStorage` `browserId` plus a Supabase anonymous session; a new PC re-points at an existing player with `players.claim_code`. Do not assume an account, a login screen or a merge exists.
- **Code site:** `src/lib/utils/browser-id.ts`, `src/components/game/PlayerProvider.tsx`, `src/components/game/ProfileModal.tsx`, `supabase/migrations/20260908000000_claim_codes.sql`

## Original note (moved verbatim from CLAUDE.md, 2026-09-22)

### Persistence Without Login
1. On first visit, generate a UUID (`browserId`) stored in `localStorage`
2. Create a Supabase anonymous auth session
3. Link all game history/stats to this anonymous user
4. If user later creates an account (email/Google), merge anonymous data into the new profile
5. `browserId` serves as the fallback identity if auth session expires
