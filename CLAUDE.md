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
| Hosting (dev) | Vercel | - |
| Hosting (prod) | Docker on Unraid (Sanctuary) behind Cloudflare tunnel | - |

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
                          ↕
                  Edge Functions (win verification)
```

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
Check all possible win conditions against the player's marks array:
- **Row:** Any complete horizontal line
- **Column:** Any complete vertical line
- **Diagonal:** Both diagonals (only on square grids)
- **Four Corners:** All 4 corner squares marked
- **Blackout:** Every square marked
- **Custom patterns:** Stored as a boolean grid in game settings

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
│   │   ├── layout.tsx                # Root layout (fonts, theme provider, Supabase provider)
│   │   ├── page.tsx                  # Landing page — create or join a game
│   │   ├── create/
│   │   │   └── page.tsx              # Card template creator/editor
│   │   ├── room/
│   │   │   └── [code]/
│   │   │       ├── page.tsx          # Game room — lobby → playing → results
│   │   │       └── host/
│   │   │           └── page.tsx      # Host-only caller panel (can be same page with role check)
│   │   ├── history/
│   │   │   └── page.tsx              # Past game nights + drill-down
│   │   ├── leaderboard/
│   │   │   └── page.tsx              # All-time stats + rankings
│   │   └── profile/
│   │       └── page.tsx              # Player profile + settings
│   │
│   ├── components/
│   │   ├── board/
│   │   │   ├── BingoBoard.tsx        # Renders the NxN grid — handles marking
│   │   │   ├── BingoSquare.tsx       # Individual square — text, image, marked state
│   │   │   ├── BoardEditor.tsx       # Drag-and-drop card template editor
│   │   │   └── BoardPreview.tsx      # Read-only preview of a card
│   │   ├── game/
│   │   │   ├── CallerPanel.tsx       # Host's call interface — call list, next button
│   │   │   ├── CalledItems.tsx       # Visual history of called items
│   │   │   ├── PlayerList.tsx        # Connected players + their status
│   │   │   ├── WinOverlay.tsx        # Confetti + winner announcement
│   │   │   └── GameLobby.tsx         # Pre-game waiting room
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── RoomCodeDisplay.tsx   # Big, bold room code component
│   │   └── ui/                       # shadcn/ui components (auto-generated)
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   ├── server.ts             # Server-side Supabase client
│   │   │   ├── middleware.ts         # Auth middleware for protected routes
│   │   │   └── types.ts             # Generated DB types (supabase gen types)
│   │   ├── game/
│   │   │   ├── shuffle.ts            # Fisher-Yates + column-locked shuffle
│   │   │   ├── win-detection.ts      # Check all win patterns against marks
│   │   │   ├── seed-rng.ts           # Seeded PRNG (mulberry32)
│   │   │   ├── room-code.ts          # Generate/validate 6-char room codes
│   │   │   └── call-list.ts          # Generate randomized call order
│   │   └── utils/
│   │       ├── cn.ts                 # clsx + tailwind-merge helper
│   │       ├── browser-id.ts         # localStorage UUID management
│   │       └── format.ts             # Date, number, duration formatters
│   │
│   ├── stores/
│   │   ├── gameStore.ts              # Zustand — live game state (calls, marks, players)
│   │   ├── editorStore.ts            # Zustand — card editor state
│   │   └── playerStore.ts            # Zustand — current player identity + prefs
│   │
│   ├── hooks/
│   │   ├── useRealtimeRoom.ts        # Subscribe to room channel, dispatch events
│   │   ├── useGameState.ts           # Derived game state (is it my turn, have I won, etc.)
│   │   └── usePlayer.ts             # Current player identity resolution
│   │
│   └── types/
│       ├── game.ts                   # Game, Room, Round types
│       ├── card.ts                   # CardTemplate, Square, Styles types
│       └── player.ts                 # Player, Stats types
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql    # Full schema from above
│   ├── functions/
│   │   └── verify-bingo/
│   │       └── index.ts              # Edge Function — server-side win verification
│   └── seed.sql                      # Optional dev seed data
│
├── public/
│   ├── sounds/                       # Dab sound, call chime, winner fanfare
│   └── patterns/                     # Default win pattern SVGs
│
├── docker/
│   ├── Dockerfile                    # Production build for Sanctuary
│   └── docker-compose.yml            # Next.js + optional local Supabase
│
├── CLAUDE.md                         # ← You are here
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
├── .env.local.example                # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
└── README.md
```

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

## Docker (Sanctuary Deployment)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Next.js config needs `output: 'standalone'` for Docker.

Cloudflare tunnel: `squares.shortflip.org` → `localhost:3000` on Sanctuary.

---

## Testing Strategy (Future)

- **Unit tests:** Win detection, shuffle algorithm, room code generation (Vitest)
- **Component tests:** Board rendering, square marking, caller panel (React Testing Library)
- **E2E:** Full game flow — create room, join, play, win (Playwright)
- Not required for Phase 1 MVP — add in Phase 3+

---

## Notes

- The name "Squares" is a working title and may change. It's only referenced in `package.json` `name` field, the root layout `<title>`, and any logo/branding components.
- This is a personal project for 3-5 friends. No need for rate limiting, abuse prevention, or enterprise features in MVP.
- Sound effects and confetti are non-negotiable. They make the game.
- Mobile experience matters — most players will be on phones during game night.
