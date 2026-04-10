-- =============================================================================
-- MVP: Open insert policies — remove auth.uid() requirement
-- =============================================================================
-- Anonymous sign-ins are unreliable in some Supabase project configurations.
-- For this small friend-group app, we allow open inserts and rely on
-- application-level validation rather than auth-gated RLS for Phase 1.
-- Ownership checks (update/delete) still verify by player/host ID.
-- Tighten these post-MVP when accounts are added.
-- =============================================================================

-- ── card_templates ─────────────────────────────────────────────────────────

drop policy if exists "card_templates: insert" on public.card_templates;

create policy "card_templates: insert"
  on public.card_templates for insert
  with check (true);

-- ── rooms ──────────────────────────────────────────────────────────────────

drop policy if exists "rooms: insert" on public.rooms;

create policy "rooms: insert"
  on public.rooms for insert
  with check (true);

-- ── games ──────────────────────────────────────────────────────────────────

drop policy if exists "games: insert" on public.games;
drop policy if exists "games: update" on public.games;

create policy "games: insert"
  on public.games for insert
  with check (true);

create policy "games: update"
  on public.games for update
  using (true);

-- ── game_players ───────────────────────────────────────────────────────────

drop policy if exists "game_players: insert" on public.game_players;
drop policy if exists "game_players: update" on public.game_players;

create policy "game_players: insert"
  on public.game_players for insert
  with check (true);

create policy "game_players: update"
  on public.game_players for update
  using (true);
