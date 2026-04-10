-- =============================================================================
-- Squares — Initial Schema
-- Migration: 20260410000000_initial_schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PLAYERS
-- Represents a person playing Squares. Can be anonymous (browser_id only)
-- or linked to a Supabase auth account after optional sign-up.
-- ---------------------------------------------------------------------------
create table public.players (
  id          uuid primary key default gen_random_uuid(),
  browser_id  text unique not null,   -- localStorage UUID — fallback identity if auth session expires
  auth_id     uuid references auth.users(id) on delete set null, -- linked after account creation
  display_name text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger players_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- CARD TEMPLATES
-- The bingo card definition a host creates. Items are the pool of squares;
-- the actual per-player card is generated at game time from a seed.
-- ---------------------------------------------------------------------------
create table public.card_templates (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references public.players(id) on delete cascade,
  name         text not null,
  board_size   int  not null check (board_size between 3 and 6),
  -- items: array of { text?: string, imageUrl?: string, clue?: string }
  items        jsonb not null default '[]',
  -- styles: { background, squares, gridLines, font, textAlign, freeSpace }
  styles       jsonb not null default '{}',
  -- 'full' = Fisher-Yates entire pool; 'column' = shuffle within column groups
  shuffle_mode text not null default 'full' check (shuffle_mode in ('full', 'column')),
  free_space   boolean not null default true,
  is_public    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ROOMS
-- A game session. Has a short join_code players use to enter.
-- One template per room; multiple game rounds can happen within a room.
-- ---------------------------------------------------------------------------
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references public.players(id) on delete cascade,
  -- 6-char uppercase alphanumeric, ambiguous chars excluded (O, 0, I, 1, L)
  join_code   text unique not null,
  name        text,
  template_id uuid references public.card_templates(id) on delete set null,
  -- 'waiting' → 'playing' → 'finished'
  status      text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- { winPatterns: string[], autoCall: bool, callInterval: number }
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Fast lookup when players enter a room code
create index rooms_join_code_idx on public.rooms (join_code);

-- ---------------------------------------------------------------------------
-- GAMES
-- One round within a room. Tracks the call order, how many calls have been
-- made, and the PRNG seed used to generate each player's card reproducibly.
-- ---------------------------------------------------------------------------
create table public.games (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  round_number int  not null,
  -- Ordered array of item indices — the call sequence for this round
  call_list    jsonb not null default '[]',
  -- Pointer into call_list — how many items have been called so far
  calls_made   int  not null default 0,
  -- Seed used with mulberry32 PRNG to reproduce each player's shuffled card
  seed         text not null,
  status       text not null default 'active' check (status in ('active', 'won', 'cancelled')),
  win_pattern  text,  -- which pattern was achieved (row, column, diagonal, etc.)
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);

-- ---------------------------------------------------------------------------
-- GAME PLAYERS
-- Join table — one row per player per game round.
-- Stores the player's shuffled card and their marks.
-- ---------------------------------------------------------------------------
create table public.game_players (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games(id) on delete cascade,
  player_id       uuid not null references public.players(id) on delete cascade,
  -- The shuffled card grid for this player (generated from seed+playerId at game start)
  card_data       jsonb not null default '[]',
  -- Array of marked square indices — updated in real time as player marks squares
  marks           jsonb not null default '[]',
  won             boolean not null default false,
  -- 1st, 2nd, etc. — used for multi-winner modes
  finish_position int,
  -- Milliseconds from game start to bingo claim — for leaderboard stats
  bingo_time_ms   int,
  unique (game_id, player_id)
);

-- Composite index for the most common query pattern: all players in a game
create index game_players_game_id_player_id_idx on public.game_players (game_id, player_id);

-- ---------------------------------------------------------------------------
-- GAME NIGHTS
-- Aggregate grouping of rooms into a single "night" for leaderboards.
-- Created manually by the host before or after a session.
-- ---------------------------------------------------------------------------
create table public.game_nights (
  id         uuid primary key default gen_random_uuid(),
  name       text,  -- e.g. "Friday Night Bingo - April 10"
  room_ids   uuid[] not null default '{}',
  date       date not null,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.players       enable row level security;
alter table public.card_templates enable row level security;
alter table public.rooms          enable row level security;
alter table public.games          enable row level security;
alter table public.game_players   enable row level security;
alter table public.game_nights    enable row level security;

-- ---------------------------------------------------------------------------
-- PLAYERS policies
-- ---------------------------------------------------------------------------

-- Anyone can create a player record (needed for anonymous identity on first visit)
create policy "players: anyone can insert"
  on public.players for insert
  with check (true);

-- Players can read their own record; also readable by anyone in a shared room
-- (simplified to public read for MVP — tighten post-MVP if needed)
create policy "players: public read"
  on public.players for select
  using (true);

-- Players can only update their own record
create policy "players: owner can update"
  on public.players for update
  using (auth.uid() = auth_id)
  with check (auth.uid() = auth_id);

-- ---------------------------------------------------------------------------
-- CARD TEMPLATES policies
-- ---------------------------------------------------------------------------

-- Anyone can read public templates; creators can read their own private ones
create policy "card_templates: public or owner can select"
  on public.card_templates for select
  using (
    is_public = true
    or creator_id = (select id from public.players where auth_id = auth.uid())
    or creator_id = (select id from public.players where browser_id = current_setting('app.browser_id', true))
  );

-- Only the creator can insert, update, delete their templates
create policy "card_templates: owner can insert"
  on public.card_templates for insert
  with check (
    creator_id = (select id from public.players where auth_id = auth.uid())
    or creator_id = (select id from public.players where browser_id = current_setting('app.browser_id', true))
  );

create policy "card_templates: owner can update"
  on public.card_templates for update
  using (
    creator_id = (select id from public.players where auth_id = auth.uid())
    or creator_id = (select id from public.players where browser_id = current_setting('app.browser_id', true))
  );

create policy "card_templates: owner can delete"
  on public.card_templates for delete
  using (
    creator_id = (select id from public.players where auth_id = auth.uid())
    or creator_id = (select id from public.players where browser_id = current_setting('app.browser_id', true))
  );

-- ---------------------------------------------------------------------------
-- ROOMS policies
-- ---------------------------------------------------------------------------

-- Anyone can read rooms (needed to join via room code)
create policy "rooms: public read"
  on public.rooms for select
  using (true);

-- Any authenticated/anonymous player can create a room
create policy "rooms: anyone can insert"
  on public.rooms for insert
  with check (true);

-- Only the host can update room settings and status
create policy "rooms: host can update"
  on public.rooms for update
  using (
    host_id = (select id from public.players where auth_id = auth.uid())
    or host_id = (select id from public.players where browser_id = current_setting('app.browser_id', true))
  );

-- ---------------------------------------------------------------------------
-- GAMES policies
-- ---------------------------------------------------------------------------

-- All participants can read game state
create policy "games: public read"
  on public.games for select
  using (true);

-- Only the room host can insert/update games
create policy "games: host can insert"
  on public.games for insert
  with check (
    exists (
      select 1 from public.rooms r
      join public.players p on p.id = r.host_id
      where r.id = room_id
        and (p.auth_id = auth.uid()
          or p.browser_id = current_setting('app.browser_id', true))
    )
  );

create policy "games: host can update"
  on public.games for update
  using (
    exists (
      select 1 from public.rooms r
      join public.players p on p.id = r.host_id
      where r.id = room_id
        and (p.auth_id = auth.uid()
          or p.browser_id = current_setting('app.browser_id', true))
    )
  );

-- ---------------------------------------------------------------------------
-- GAME PLAYERS policies
-- ---------------------------------------------------------------------------

-- All game participants can read each other's game_players rows
create policy "game_players: public read"
  on public.game_players for select
  using (true);

-- Players can insert their own game_players row when joining a game
create policy "game_players: player can insert own row"
  on public.game_players for insert
  with check (
    player_id = (select id from public.players where auth_id = auth.uid())
    or player_id = (select id from public.players where browser_id = current_setting('app.browser_id', true))
  );

-- Players can update only their own row (marks, won, etc.)
create policy "game_players: player can update own row"
  on public.game_players for update
  using (
    player_id = (select id from public.players where auth_id = auth.uid())
    or player_id = (select id from public.players where browser_id = current_setting('app.browser_id', true))
  );

-- ---------------------------------------------------------------------------
-- GAME NIGHTS policies
-- ---------------------------------------------------------------------------

create policy "game_nights: public read"
  on public.game_nights for select
  using (true);

create policy "game_nights: anyone can insert"
  on public.game_nights for insert
  with check (true);
