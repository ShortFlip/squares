# Wins are verified client-side; there is no Edge Function

- **Date:** 2026-09-08 (#12 rewrote the Data Flow paragraph; the gap was logged in the 2026-09-07 audit)
- **Symptom:** The docs described server-side (Edge Function) verification and a `bingo_claimed` / `square_marked` / `round_reset` event set that were never built or are never sent.
- **Measurement:** none recorded
- **Rule:** A win is whatever the claimant's tab detects: it auto-claims, writes the result, and broadcasts `bingo_confirmed`. RLS insert/update is `true` on every game table. Deliberate for three friends on a call; it must change before anyone else is invited in.
- **Code site:** `src/components/game/RoomClient.tsx` (every `broadcast(...)` call), `src/hooks/useRealtimeRoom.ts` (handlers + `postgres_changes` fallback), `src/types/game.ts` (unused event union), `supabase/migrations/20260410000003_open_insert_rls.sql`, `20260410000005_open_update_rls.sql`

## Original note (moved verbatim from CLAUDE.md, 2026-09-22)

No server code runs in the game loop. Win verification is **client-side**: the
claimant's own tab detects the pattern, claims it, and the claim is broadcast to
everyone. There is no Edge Function and no server authority over the result.
That is a deliberate call for a three-friend honor-system game — see "Next Up".

### Real-time Game Sync
Each game room subscribes to a Supabase Realtime channel: `room:{roomCode}`.

**Broadcast events:**
- `item_called` — Host calls next item → all players receive it
- `square_marked` — Player marks a square → host sees it (for verification)
- `bingo_claimed` — Player claims bingo → triggers server-side verification
- `bingo_confirmed` — Server confirms valid bingo → all players see winner
- `round_reset` — Host starts new round → all cards reshuffle, marks clear
- `player_joined` / `player_left` — Presence tracking

**Authority model:** Host is the source of truth for game progression. Only the host can call items, confirm bingos, and reset rounds. Win verification runs server-side (Edge Function) to prevent client-side cheating.
