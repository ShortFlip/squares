# The database schema as first written

- **Date:** undated (initial schema migration is 2026-04-10)
- **Symptom:** The written schema has no `players.claim_code`, describes owner-scoped RLS that later migrations opened to `true`, and lists `game_nights`, which nothing uses.
- **Measurement:** none recorded
- **Rule:** `supabase/migrations/` and the generated `src/lib/supabase/types.ts` are the schema. A night is a room; `game_nights` is unused.
- **Code site:** `supabase/migrations/*.sql`, `src/lib/supabase/types.ts`

## Original note (moved verbatim from CLAUDE.md, 2026-09-22)

## Database Schema

### Tables

**players**
- `id` UUID PK (default: gen_random_uuid())
- `browser_id` TEXT UNIQUE NOT NULL — localStorage UUID
- `auth_id` UUID NULLABLE FK → auth.users — linked after account creation
- `display_name` TEXT NOT NULL
- `avatar_url` TEXT NULLABLE
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()

**card_templates**
- `id` UUID PK
- `creator_id` UUID FK → players
- `name` TEXT NOT NULL
- `board_size` INT NOT NULL (3, 4, 5, or 6)
- `items` JSONB NOT NULL — array of `{ text?: string, imageUrl?: string, clue?: string }`
- `styles` JSONB NOT NULL — `{ background, squares, gridLines, font, textAlign, freeSpace }`
- `shuffle_mode` TEXT DEFAULT 'full' — 'full' | 'column'
- `free_space` BOOLEAN DEFAULT true
- `is_public` BOOLEAN DEFAULT false
- `created_at` TIMESTAMPTZ DEFAULT now()

**rooms**
- `id` UUID PK
- `host_id` UUID FK → players
- `join_code` TEXT UNIQUE NOT NULL — 6-char alphanumeric, uppercase
- `name` TEXT — optional room name
- `template_id` UUID FK → card_templates
- `status` TEXT DEFAULT 'waiting' — 'waiting' | 'playing' | 'finished'
- `settings` JSONB — `{ winPatterns: string[], autoCall: bool, callInterval: number }`
- `created_at` TIMESTAMPTZ DEFAULT now()

**games** (one per round within a room)
- `id` UUID PK
- `room_id` UUID FK → rooms
- `round_number` INT NOT NULL
- `call_list` JSONB NOT NULL — ordered array of item indices
- `calls_made` INT DEFAULT 0 — pointer into call_list
- `seed` TEXT NOT NULL — PRNG seed for card generation
- `status` TEXT DEFAULT 'active' — 'active' | 'won' | 'cancelled'
- `win_pattern` TEXT — which pattern was achieved
- `started_at` TIMESTAMPTZ DEFAULT now()
- `ended_at` TIMESTAMPTZ NULLABLE

**game_players** (join table — who played each game)
- `id` UUID PK
- `game_id` UUID FK → games
- `player_id` UUID FK → players
- `card_data` JSONB NOT NULL — the shuffled card grid for this player
- `marks` JSONB DEFAULT '[]' — array of marked square indices
- `won` BOOLEAN DEFAULT false
- `finish_position` INT NULLABLE — 1st, 2nd, etc. for multi-winner modes
- `bingo_time_ms` INT NULLABLE — time from game start to bingo claim

**game_nights** (aggregate — groups rooms into "nights" for leaderboard)
- `id` UUID PK
- `name` TEXT — e.g., "Friday Night Bingo - April 10"
- `room_ids` UUID[] — array of room IDs from this night
- `date` DATE NOT NULL
- `created_at` TIMESTAMPTZ DEFAULT now()

### Row-Level Security (RLS)
- Players can read their own data and any room they've joined
- Only room hosts can update room settings and game state
- Card templates: creator can CRUD; public templates readable by all
- Game results readable by all participants

### Indexes
- `rooms.join_code` — UNIQUE, used for room lookup on join
- `game_players(game_id, player_id)` — composite for quick lookups
- `players.browser_id` — UNIQUE, used for anonymous identity resolution
