# CLAUDE.md — Squares

> A real-time multiplayer bingo platform for small friend groups.

---

## Project Overview

**Squares** is a web-hosted, real-time multiplayer bingo app. A host creates a custom bingo card template, starts a game room, and friends join via a short room code. The host calls items from a caller panel, players mark squares on their synced boards, and the system detects/verifies wins. Game history, leaderboards, and stats persist across sessions — no account required (but optionally supported).

**Target audience:** 3-5 friends playing recurring bingo nights.
**Working title:** "Squares" (may be renamed — name is only referenced in `package.json`, `<title>`, and the logo component).

---

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

---

**Before writing or changing any interface code — read `DESIGN.md`.**
If a request conflicts with DESIGN.md, say so before building.
Part 2 is intentionally incomplete. Do not fill the gap with framework
defaults; follow its guardrails and ask.

## Design Direction

### Aesthetic: "Arcade Lounge"
Think neon-lit bowling alley meets modern game night — playful but polished. NOT corporate SaaS, NOT kiddy/classroom.

### Design Tokens
- **Background:** Deep charcoal (`#0f0f14`) with subtle noise texture
- **Surface:** Slightly lighter (`#1a1a24`) for cards, panels, modals
- **Primary accent:** Electric violet (`#7c3aed`) — used sparingly for CTAs, active states, winner effects
- **Secondary accent:** Warm amber (`#f59e0b`) — marked squares, highlights
- **Success:** Emerald (`#10b981`) — bingo confirmation, win states
- **Danger:** Rose (`#f43f5e`) — errors, destructive actions
- **Text primary:** `#f1f5f9`
- **Text secondary:** `#94a3b8`
- **Grid lines:** `#2d2d3a` default, customizable per card template

### Typography
- **Display/Headers:** A bold, characterful font (e.g., Outfit, Clash Display, or Satoshi) — NOT Inter, NOT Roboto
- **Body/UI:** A clean geometric sans (e.g., General Sans, Plus Jakarta Sans)
- **Monospace (codes/stats):** JetBrains Mono

### Key Visual Elements
- Squares glow subtly when marked (box-shadow pulse)
- Winner gets a confetti cannon animation + board highlight
- Caller panel has a "now calling" card flip animation
- Room code displayed large and bold — easy to read aloud over a call
- Dark mode is default; light mode supported

### Component Patterns
- Use shadcn/ui as the base — customize colors/radius to match tokens
- Border radius: `rounded-lg` (8px) for cards, `rounded-md` (6px) for buttons
- Consistent 4px spacing scale (Tailwind default)
- All interactive elements need hover, active, focus, and disabled states
- Transitions: 150ms ease for micro-interactions, 300ms for panel/modal transitions

---

## Architecture

### Data Flow
```
Browser (Player) ←→ Supabase Realtime Channel ←→ Browser (Host)
                          ↕
                    Supabase PostgreSQL
```

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

### Persistence Without Login
1. On first visit, generate a UUID (`browserId`) stored in `localStorage`
2. Create a Supabase anonymous auth session
3. Link all game history/stats to this anonymous user
4. If user later creates an account (email/Google), merge anonymous data into the new profile
5. `browserId` serves as the fallback identity if auth session expires

### Card Shuffling
- **Full shuffle:** Fisher-Yates on the entire item array, then fill grid left-to-right, top-to-bottom
- **Column-locked shuffle:** Partition items into N column groups, Fisher-Yates within each group
- **Seed-based RNG:** Use a seeded PRNG (e.g., `mulberry32`) so each player's card is reproducible from `(templateId, gameSeed, playerId)` — critical for server-side win verification without storing every card

### Win Detection
Runs in the browser on every mark (`src/lib/game/win-detection.ts`). Checks the
player's marks against each enabled pattern:
- **Row / Column / Diagonal / Four Corners / Blackout**, plus custom boolean grids
- `bestLine()` returns the closest incomplete line, which drives the "one away"
  label, the hot lane on my board, and every rail miniature's status

A detected win auto-claims — there is no BINGO button. The round keeps running
so second place can still happen.

---

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

---

## Project Structure

```
squares/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── layout.tsx                # Root layout (fonts, theme, player provider)
│   │   ├── globals.css               # Tokens, theme blocks, glass + animation utilities
│   │   ├── page.tsx                  # Landing — create, join, Rejoin chip
│   │   ├── create/page.tsx           # Card template creator/editor
│   │   ├── room/[code]/page.tsx      # Game room — lobby → playing → game over
│   │   ├── history/page.tsx          # Nights (one per room) + per-round drill-down
│   │   └── leaderboard/page.tsx      # Co-player rankings
│   │
│   ├── components/
│   │   ├── board/
│   │   │   ├── BingoBoard.tsx        # The NxN grid — marking, hot lane, called wash
│   │   │   ├── BingoSquare.tsx       # One square — text, image, marked/called state
│   │   │   ├── MiniBoard.tsx         # Someone else's board at ~90–108px, glanceable
│   │   │   ├── BoardEditor.tsx       # Template editor grid + item pool
│   │   │   ├── BoardPreview.tsx      # Read-only shuffled preview
│   │   │   └── CardStylePicker.tsx   # Per-template style presets
│   │   ├── game/
│   │   │   ├── RoomClient.tsx        # Room state machine + all Supabase writes
│   │   │   ├── GameLobby.tsx         # Pre-game waiting room
│   │   │   ├── GameView.tsx          # The Scoreboard screen: header, hero board, rail
│   │   │   ├── RailCard.tsx          # One other player in the rail — mini + progress
│   │   │   ├── WinBanner.tsx         # In-flow gold win band (never an overlay)
│   │   │   ├── HostControls.tsx      # New Round / End Night — used by header AND banner
│   │   │   ├── GameOver.tsx          # Night over — Play Again (host) or waiting copy
│   │   │   ├── CallerPanel.tsx       # Traditional mode only — call list, next button
│   │   │   ├── CalledItems.tsx       # Traditional mode only — call history
│   │   │   ├── PlayerList.tsx        # Lobby roster
│   │   │   ├── CreateRoomDialog.tsx  # Name + template + settings
│   │   │   ├── TemplateList.tsx      # Saved templates on the landing page
│   │   │   ├── DisplayNameDialog.tsx # First-visit name prompt
│   │   │   ├── PlayerProvider.tsx    # Identity resolution at the app root
│   │   │   ├── ProfileModal.tsx      # Name, avatar, theme, claim code (no /profile page)
│   │   │   └── ThemePicker.tsx       # The six app themes
│   │   ├── layout/RoomCodeDisplay.tsx
│   │   ├── stats/PlayerStats.tsx
│   │   └── ui/                       # shadcn/ui primitives + PlayerAvatar
│   │
│   ├── lib/
│   │   ├── supabase/{client,server,types}.ts
│   │   ├── game/
│   │   │   ├── shuffle.ts            # Fisher-Yates + column-locked; draws N² from the pool
│   │   │   ├── win-detection.ts      # checkWin + bestLine/bestLineLabel
│   │   │   ├── seed-rng.ts           # Seeded PRNG (mulberry32 behind seededRng)
│   │   │   ├── room-code.ts          # 6-char codes, unambiguous alphabet
│   │   │   ├── call-list.ts          # Randomized call order (traditional mode)
│   │   │   ├── game-setup.ts         # Shared round bootstrap: seed, items, call list
│   │   │   ├── game-players.ts       # loadGamePlayers — everyone's cards + marks
│   │   │   ├── import.ts             # parseImport — newlines then commas, dedupe
│   │   │   └── __tests__/            # Vitest: shuffle, win-detection, call-list, import
│   │   ├── utils/
│   │   │   ├── browser-id.ts         # localStorage UUID identity
│   │   │   ├── last-room.ts          # Remembers the last room for the Rejoin chip
│   │   │   ├── copy-link.ts          # Guarded clipboard write + toast fallback
│   │   │   └── player-color.ts       # Deterministic avatar color + initials
│   │   ├── utils.ts                  # cn() — clsx + tailwind-merge
│   │   ├── theme.ts                  # The six app themes
│   │   ├── card-styles.ts            # Card style presets
│   │   ├── sound.ts                  # Web Audio synthesis — no audio files
│   │   ├── win-confetti.ts           # The two-cannon burst and the second-place burst
│   │   ├── achievements.ts           # Badges derived from stats
│   │   └── dev-state.ts              # `?state=` harness, DEV-only, stripped from prod
│   │
│   ├── stores/                       # Zustand: gameStore, editorStore, playerStore
│   ├── hooks/                        # useRealtimeRoom, useGameState, usePlayer
│   └── types/                        # game.ts, card.ts, player.ts
│
├── supabase/migrations/              # 0001 schema → RLS fixes → avatars →
│                                     # enable_realtime → claim_codes
├── .design/                          # UPGRADE-PLAN.md, mockups/SPEC.md, refs (gitignored)
├── .github/workflows/deploy.yml      # Build + deploy to Cloudflare Workers on push to master
├── public/                           # Static SVGs only — sounds are synthesized
├── CLAUDE.md                         # ← You are here
├── DESIGN.md                         # Design intent; Part 1 binding
├── vitest.config.ts
├── next.config.ts
├── open-next.config.ts
├── wrangler.toml
├── tsconfig.json
├── components.json
└── README.md
```

Styling is Tailwind v4 — the theme lives in `globals.css` (`@theme inline`), so
there is no `tailwind.config.ts`. The `game_nights` table exists in the schema
but is unused: a **night is a room**, and `/history` groups by room.

---

## Phase Plan

### Phase 1: Core MVP — "Let's Play Bingo"
Everything needed for a functional game night.

**1.1 — Project scaffold**
- `npx create-next-app@latest squares --typescript --tailwind --app --src-dir`
- Install deps: `@supabase/supabase-js`, `@supabase/ssr`, `zustand`, `canvas-confetti`
- Init shadcn/ui: `npx shadcn@latest init`
- Add shadcn components: button, input, dialog, card, badge, tooltip, dropdown-menu, separator, select, label, textarea, tabs
- Set up Tailwind config with design tokens (colors, fonts)
- Set up Supabase client (browser + server)
- Set up root layout with font loading + theme provider

**1.2 — Database schema**
- Create Supabase project
- Write and run migration `001_initial_schema.sql`
- Set up RLS policies
- Generate TypeScript types with `supabase gen types`

**1.3 — Player identity**
- `browser-id.ts` — generate/retrieve UUID from localStorage
- `usePlayer` hook — resolve current player (anonymous or authed)
- Auto-create player record on first visit
- Display name prompt on first visit (stored in DB)

**1.4 — Card template creator**
- Board size selector (3x3 through 6x6)
- Text entry per square (click to edit)
- Bulk paste word list (auto-fills grid)
- Free space toggle
- Shuffle mode toggle (full vs. column-locked)
- Card title input
- Preview mode (see a shuffled version)
- Save template to DB

**1.5 — Room creation + join flow**
- Host creates room → selects template → gets 6-char room code
- Join page: enter room code → enter display name → enter lobby
- Lobby shows connected players, host can start game
- Shareable URL: `/room/[code]`

**1.6 — Real-time game engine**
- `useRealtimeRoom` hook — subscribe to room channel
- Host caller panel: ordered call list, "Call Next" button, called items display
- Player board: shuffled card generated from seed, click to mark squares
- Real-time events: `item_called`, `square_marked`, `bingo_claimed`
- Call history visible to all players

**1.7 — Win detection + verification**
- Client-side win check on each mark (for instant feedback)
- "BINGO!" button appears when win detected
- Server-side verification via Edge Function (regenerate card from seed, validate marks against calls)
- Winner announcement broadcast to all players
- Confetti cannon animation

**1.8 — Round management**
- Host can start new round (reshuffles all cards, resets marks)
- Round counter visible in room
- Game results saved to DB after each round

**1.9 — Landing page**
- Clean, inviting landing page
- Two CTAs: "Create a Game" and "Join a Game"
- Room code input for joining
- Brief explanation of what Squares is

---

### Phase 2: Customization Engine
- Custom background images (upload to Supabase Storage)
- Custom square colors (called, uncalled, marked, free space)
- Custom grid line color, width, style
- Google Fonts picker + font color
- Text shadow/outline toggle
- Images per square (drag-and-drop)
- Text + image combo per square
- Save/load card templates
- Dark/light mode toggle

### Phase 3: Competitive Features
- All-time leaderboard (wins, win rate, games played, streaks)
- Game night history (date, participants, per-round results)
- Card snapshots (screenshot of winning card)
- Player profiles with stats dashboard
- Achievement badges

### Phase 4: Power Features
- Auto-caller with configurable interval
- Text-to-speech for called items
- Full-screen caller display
- Custom win pattern builder (visual editor)
- Game modes: Standard, Speed, Blackout, Pattern, Multi-winner
- In-game chat/reactions
- Sound effects
- Spectator mode
- Room passwords
- QR code to join
- Print support (PDF export)

### Phase 5: Social & Polish
- Share game results as images
- Rematch button
- Recurring game night scheduling
- PWA support
- WCAG 2.1 AA accessibility
- Mobile-optimized interactions

---

## Code Conventions

### General
- **TypeScript strict mode** — no `any` unless absolutely unavoidable (and comment why)
- **Functional components only** — no class components
- **Named exports** — no default exports except for Next.js pages/layouts
- **Barrel exports** — `index.ts` in each component directory
- **Comments** — explain the "why", not the "what". Add comments for non-obvious logic, game rules, and algorithm choices

### File Naming
- Components: `PascalCase.tsx`
- Utilities/hooks/stores: `camelCase.ts`
- Types: `camelCase.ts` (colocated with feature or in `types/`)

### Component Pattern
```tsx
// components/board/BingoSquare.tsx
'use client';

import { cn } from '@/lib/utils/cn';
import type { Square } from '@/types/card';

interface BingoSquareProps {
  square: Square;
  isMarked: boolean;
  isCalled: boolean;
  onMark: () => void;
}

export function BingoSquare({ square, isMarked, isCalled, onMark }: BingoSquareProps) {
  return (
    <button
      onClick={onMark}
      className={cn(
        'aspect-square flex items-center justify-center p-2 transition-all duration-150',
        'border border-grid-line text-sm font-medium',
        isMarked && 'bg-amber-500/20 ring-2 ring-amber-500',
        isCalled && !isMarked && 'bg-violet-500/10',
      )}
    >
      {square.text}
    </button>
  );
}
```

### State Management
- **Zustand stores** for game state, editor state, player identity
- **React state** for component-local UI state (modals, inputs, hover)
- **Supabase Realtime** for cross-client sync — events update Zustand stores
- Never put Supabase Realtime subscriptions in components directly — always go through `useRealtimeRoom` hook

### Supabase Patterns
- Use `@supabase/ssr` for server-side operations
- Browser client: `createBrowserClient()` in `lib/supabase/client.ts`
- Server client: `createServerClient()` in `lib/supabase/server.ts`
- Always handle Supabase errors explicitly — never swallow them
- Use generated types from `supabase gen types typescript`

### Error Handling
- Wrap all Supabase calls in try/catch
- Show user-facing errors via toast (shadcn/ui toast or sonner)
- Log errors to console in development
- Never expose raw database errors to users

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key  # Server-side only, never expose
```

---

## Key Algorithms

### Room Code Generation
```
Generate 6 uppercase alphanumeric characters (A-Z, 0-9)
Exclude ambiguous characters: O, 0, I, 1, L
Check uniqueness against rooms table
Retry if collision (statistically near-impossible with this character space)
```

### Seeded Card Generation
```
Input: (templateItems[], seed, playerId, boardSize, shuffleMode)
1. Combine seed + playerId to create player-specific seed
2. Initialize mulberry32 PRNG with this seed
3. If shuffleMode === 'full': Fisher-Yates shuffle entire items array
   If shuffleMode === 'column': partition items into boardSize groups, shuffle within each
4. Take first (boardSize × boardSize) items
5. If freeSpace: replace center item with FREE_SPACE sentinel
6. Return grid as 2D array
```

### Win Detection
```
Input: (marks: Set<number>, boardSize: number, winPatterns: string[])
For each pattern in winPatterns:
  If pattern === 'row': check each row for all marked
  If pattern === 'column': check each column for all marked
  If pattern === 'diagonal': check both diagonals
  If pattern === 'four_corners': check 4 corner indices
  If pattern === 'blackout': check all squares marked
  If pattern === 'custom': compare marks against custom boolean grid
Return first matching pattern or null
```

---

## Deployment

Push to `master` and `.github/workflows/deploy.yml` runs `npm run cf:deploy`
(OpenNext build → `wrangler deploy`) onto **Cloudflare Workers**. The
`NEXT_PUBLIC_*` Supabase values are repo secrets, baked in at build time. There
is no Docker image and nothing runs on Sanctuary — the plan to self-host behind
a Cloudflare tunnel was dropped in favour of Workers.

---

## Testing Strategy

- **Unit tests (in place):** `npm test` runs Vitest over card generation and
  shuffling, win detection and `bestLine`, the call list, and the import parser.
- **Live gates (in place, not in CI):** each phase is proved against two real
  browser contexts via `.playwright-mcp/pw.cjs` (a CDP driver) pointed at the dev
  server, printing `GATE <name>: PASS/FAIL` lines.
- **Not done:** component tests, and a scripted end-to-end run in CI.

---

## Notes

- The name "Squares" is a working title and may change. It's only referenced in `package.json` `name` field, the root layout `<title>`, and any logo/branding components.
- This is a personal project for 3-5 friends. No need for rate limiting, abuse prevention, or enterprise features in MVP.
- Sound effects and confetti are non-negotiable. They make the game.
- **Desktop only.** Squares lives on a second monitor beside Discord while the
  main monitor is playing something else. Assume ~1280×800 minimum. No mobile work.

---

## Version history

| PR | Shipped | What landed |
|---|---|---|
| #7 | 2026-09-08 | Rejoin + connection truth. Vitest; `useRealtimeRoom` handles every channel status with resubscribe backoff and a `connection` state; everyone's cards and marks load from `game_players` into an `others` store slice; landing Rejoin chip. |
| #8 | 2026-09-08 | The Scoreboard game screen. Glass header with the room code and Copy link, a 608px hero board with the hot lane, a 300px rail of live miniatures, `bestLine`/`bestLineLabel`, the amber reconnecting bar, the SYNCING rail state, `--gold` in every theme, and the DEV-only `?state=` harness. |
| #9 | 2026-09-08 | The bingo moment. `WinOverlay` retired for an in-flow gold `WinBanner`; the hero grid shrinks 608→520 and stays markable; per-winner fanfare and two-cannon confetti; gold rail cards with `1ST`/`2ND` pills and a gold winning line. |
| #10 | 2026-09-08 | The item pool. A template holds more items than squares, so every round draws a fresh subset per player; `parseImport` splits newlines then commas and dedupes; count line and Save gate replace the old filled-squares widget. |
| #11 | 2026-09-08 | Identity and aftermath. `players.claim_code` re-points a new PC at an existing player; `/history` groups rounds into nights with cancelled rounds shown as `No winner`; `/leaderboard` scoped to co-players with cancelled rounds excluded. |
| #12 (this PR) | 2026-09-08 | Host controls and docs. `HostControls` moves into the game header so a round nobody wins is no longer a dead end; End Night cancels a winnerless final round so it never reaches the leaderboard; `isConnected` and other dead exports removed; CLAUDE.md and DESIGN.md brought back to reality. |

## Next Up

Known gaps, deliberate or otherwise. None of these block a game night.

- **Reconnect backoff has never met a real dropped socket.** The
  `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` path and its 1–2–4–8s backoff were
  exercised only through the `?state=reconnecting` harness.
- **RLS is wide open and win verification is client-side.** Insert and update
  are `true` for every game table, and a win is whatever the claimant's browser
  says it is. Deliberate — three friends on a voice call, no adversary. It is
  also the one thing that must change before anyone else is invited in.
- **Traditional caller mode was restyled, not redesigned.** `CallerPanel` and
  `CalledItems` were dropped into rail glass cards and left alone. Honor-system
  play is the real mode.
- **The light theme's glass inversion has never been reviewed on a real game
  screen.** Latte was checked on the landing page only; the header, banner and
  rail all assume white-on-dark translucency.
