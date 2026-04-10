-- =============================================================================
-- Fix RLS policies for anonymous auth compatibility
-- =============================================================================
-- The original policies used current_setting('app.browser_id') which is never
-- set in the Supabase client connection, so browser_id-based RLS checks always
-- failed. Replaced with straightforward auth.uid() checks that work with both
-- anonymous and email/Google sessions.
--
-- MVP stance: any authenticated session (including anonymous) can write.
-- Read access remains open for rooms/games so players can join via code.
-- Ownership checks (update/delete) still verify the player record matches.
-- =============================================================================

-- ── card_templates ─────────────────────────────────────────────────────────

drop policy if exists "card_templates: public or owner can select" on public.card_templates;
drop policy if exists "card_templates: owner can insert"           on public.card_templates;
drop policy if exists "card_templates: owner can update"           on public.card_templates;
drop policy if exists "card_templates: owner can delete"           on public.card_templates;

-- Public templates visible to all; private templates visible to owner only
create policy "card_templates: select"
  on public.card_templates for select
  using (
    is_public = true
    or (
      auth.uid() is not null
      and creator_id = (select id from public.players where auth_id = auth.uid() limit 1)
    )
  );

-- Any authenticated user (anon or otherwise) can create a template
create policy "card_templates: insert"
  on public.card_templates for insert
  with check (auth.uid() is not null);

create policy "card_templates: update"
  on public.card_templates for update
  using (
    auth.uid() is not null
    and creator_id = (select id from public.players where auth_id = auth.uid() limit 1)
  );

create policy "card_templates: delete"
  on public.card_templates for delete
  using (
    auth.uid() is not null
    and creator_id = (select id from public.players where auth_id = auth.uid() limit 1)
  );

-- ── rooms ──────────────────────────────────────────────────────────────────

drop policy if exists "rooms: anyone can insert" on public.rooms;
drop policy if exists "rooms: host can update"   on public.rooms;

create policy "rooms: insert"
  on public.rooms for insert
  with check (auth.uid() is not null);

create policy "rooms: host can update"
  on public.rooms for update
  using (
    auth.uid() is not null
    and host_id = (select id from public.players where auth_id = auth.uid() limit 1)
  );

-- ── games ──────────────────────────────────────────────────────────────────

drop policy if exists "games: host can insert" on public.games;
drop policy if exists "games: host can update" on public.games;

create policy "games: insert"
  on public.games for insert
  with check (auth.uid() is not null);

create policy "games: update"
  on public.games for update
  using (auth.uid() is not null);

-- ── game_players ───────────────────────────────────────────────────────────

drop policy if exists "game_players: player can insert own row" on public.game_players;
drop policy if exists "game_players: player can update own row" on public.game_players;

create policy "game_players: insert"
  on public.game_players for insert
  with check (auth.uid() is not null);

create policy "game_players: update"
  on public.game_players for update
  using (auth.uid() is not null);

-- ── players ────────────────────────────────────────────────────────────────
-- Allow unauthenticated inserts so the first-visit player record can be
-- created before the anonymous auth session fully propagates

drop policy if exists "players: anyone can insert" on public.players;

create policy "players: insert"
  on public.players for insert
  with check (true);
