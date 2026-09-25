# Item Library — build plan

**Source of truth:** `docs/plans/item-library.md` (the spec) for behaviour. Where
this plan's decision log says otherwise, the decision log wins; it records what
changed after the spec was written, and why.

**Orchestrator:** one session on Opus 5.5 (high). It writes no feature code. It
spawns one Opus subagent per phase, verifies each result itself (diff, tests,
build, Playwright screenshots through `.playwright-mcp/pw.cjs`), and ships.

**Shipping rule:** one squash-merged PR per phase via `/ship`, CI gates and the
dry run green before merge. Every phase leaves the app runnable and deployable.
Run straight through (Ryann, 2026-09-24); stop only for the game-colour pick
(Phase 4) and for any gate that fails twice.

## Pre-flight findings

| # | Finding in the repo | Resolution |
|---|---|---|
| 1 | First round (`GameLobby`), New Round and reconnect (`RoomClient`) all fetch `card_templates` by `rooms.template_id`; a null id breaks all three. | Every room keeps a `template_id`. A saved card is hosted directly; an unsaved card is hosted from a new `card_templates` row with `saved = false`. No round-bootstrap code changes. |
| 2 | A set shorter than N² (N²−1 with free space) renders a short card, and `resolveRestoredCard` treats a non-square card as corrupt. | Save Card and Host This Card are disabled until the set is full ("24 needed, 19 so far"). |
| 3 | `imageUrl` is stored but never rendered anywhere. | The library is text only. |
| 4 | `card_templates` update/delete require the owner's `auth.uid()`; RLS blocks silently (0 rows, no error). | New tables follow the same pattern: select and insert open, update and delete owner-only. Every update/delete in new code checks the returned row count and toasts a failure. |
| 5 | Migrations are applied by hand; there is no script for applying them or regenerating types. | The orchestrator runs `npx supabase db push` and `npx supabase gen types typescript --linked` against the linked project. |
| 6 | `RoomSettings` in `types/game.ts` is unused; `buildGameSetup` casts settings inline. | Left alone; not in scope. |

## Phase map

| Phase | Scope | Model / Effort | Run as | PR branch |
|---|---|---|---|---|
| 1 | Migration, generated types, template import, domain types, pure card-builder functions + tests | Opus 5.5 / high | subagent; orchestrator applies the migration | `library-data` |
| 2 | `/library` page: items pane and card pane (build, pin, swap, mix, reshuffle, save, load) | Opus 5.5 / medium | subagent, `ui-pass` rules | `library-page` |
| 3 | Hosting: Host This Card, Create Room picks saved cards with the last one preselected, landing Saved Cards | Opus 5.5 / high | subagent | `host-from-library` |
| 4 | Game tint + icon + legend on the hero board and the History snapshot; colours picked by Ryann from rendered variants | Opus 5.5 / medium | subagent, `ui-pass` with variants | `game-legend` |

The Agent tool has no per-subagent effort setting; the effort column records
intent. Next batch after Phase 4: retire `/create` and `BoardEditor`.

## Settled data shapes

### Migration `supabase/migrations/20260924000000_item_library.sql`

```sql
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.players(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  kind text not null default 'tag' check (kind in ('game', 'tag')),
  color text,          -- game tags only: a GameColorKey, never raw CSS
  icon text,           -- game tags only: a GameIconKey
  created_at timestamptz not null default now()
);
create unique index tags_owner_name_key on public.tags (owner_id, lower(name));

create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.players(id) on delete cascade,
  text text not null check (length(btrim(text)) > 0),
  game_tag_id uuid references public.tags(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index library_items_owner_text_key on public.library_items (owner_id, lower(text));

create table public.library_item_tags (
  item_id uuid not null references public.library_items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (item_id, tag_id)
);

alter table public.card_templates
  add column saved boolean not null default true,  -- false = a one-night copy
  add column mix jsonb;                            -- CardMix, null on legacy cards
```

- RLS on all three tables: `select using (true)`, `insert with check (true)`,
  update and delete only when the row's owner is
  `(select id from public.players where auth_id = auth.uid() limit 1)`.
  `library_item_tags` checks the owner through its item.
- Import, in the same migration, per `card_templates.creator_id`: one `tag`
  (kind `tag`) per distinct template name; one library item per distinct
  trimmed, case-insensitive item text (skipping blanks and the free-space slot);
  one `library_item_tags` row linking each item to every template it came from.
  Game tags are not guessed.
- Existing templates default to `saved = true`: they are the saved cards.

### Types (`src/types/library.ts`)

```ts
export type TagKind = 'game' | 'tag';
export type GameColorKey = 'sky' | 'cyan' | 'rose' | 'orange' | 'pink';
export type GameIconKey = 'flame' | 'crosshair' | 'car' | 'target' | 'swords' | 'gamepad';

export interface Tag { id: string; ownerId: string; name: string; kind: TagKind; color: GameColorKey | null; icon: GameIconKey | null }
export interface LibraryItem { id: string; text: string; gameTagId: string | null; tagIds: string[] }

/** One lane of the mix. gameTagId null is the No Game lane. count is squares, not percent. */
export interface MixLane { gameTagId: string | null; count: number }
export interface CardMix { lanes: MixLane[] }

/** What the board needs to draw a game's tint and icon, frozen into the card. */
export interface LegendEntry { gameTagId: string; name: string; color: GameColorKey; icon: GameIconKey }
```

- `SquareItem` gains `libraryItemId?: string` and `gameTagId?: string`.
  `generateCard` already spreads the item, so both reach `card_data`.
- `CardStyles` gains `legend?: LegendEntry[]`. The legend rides in `styles`
  because every place that draws a card (GameView via `buildGameSetup`, History
  via its template embed) already reads `styles`; no query changes.
- `src/lib/game-colors.ts`: `GAME_COLORS: Record<GameColorKey, string>`
  (provisional oklch values, tuned in Phase 4) and `GAME_ICONS:
  Record<GameIconKey, LucideIcon>` (Flame, Crosshair, Car, Target, Swords,
  Gamepad2). Lookalike icons only; never game logos.

### Pure functions (`src/lib/game/card-builder.ts`, unit-tested)

- `slotsFor(boardSize, freeSpace)` → N² or N²−1.
- `allocateMix(lanes, slots, available)` → counts per lane that sum to `slots`
  by largest remainder, each capped at the items that lane has, with the
  shortfall handed to lanes that still have items. Returns the counts and any
  lane that hit its cap.
- `splitFromPercent(percentFirst, slots)` → `[a, b]` whole squares for the
  two-lane slider (20% of 24 → `[5, 19]`).
- `buildCardSet({ pool, slots, mix, pinnedIds, rng })` → the set (length
  `slots` when possible) plus `shortBy`. Pins go in first and count against
  their lane; a lane whose pins exceed its count grows, and the other lanes
  shrink by largest remainder. The rest are drawn per lane with the seeded rng,
  never repeating an item.
- `swapItem(set, index, pool, rng)` → the set with that one item replaced by an
  unused item from the same lane, or unchanged if none is left.

## Phase 1 — Data

Why first: nothing else works without the tables and the builder maths.

Build: the migration above; `types.ts` regenerated; `src/types/library.ts`;
`SquareItem`/`CardStyles` additions; `src/lib/game-colors.ts`;
`card-builder.ts` with tests (lane caps, largest-remainder rounding, pins over
the lane count, No Game lane, determinism for a seed, no duplicates, `shortBy`).

**Done:** migration applied; `types.ts` has the three tables and the two
columns; a node check shows the library count equals the deduped template item
count for each owner; `npm test`, `tsc` and lint green.

## Phase 2 — The library page

Why here: it is the surface Ryann asked for, and it only needs Phase 1.

`/library`, owner-only by filter. Two panes at 1280×800.

- **Items pane (left):** filter chips (All, each game, No Game, then extra
  tags), search, Import List (paste → `parseImport` → pick a game and extra
  tags → "22 added, 2 already in your library"), inline text edit, per-item
  game select, multi-select with Set Game, Add Tag, Remove Tag, Delete. New
  Game (name, colour, icon) and New Tag. Each row has `+` to put the item on
  the card.
- **Card pane (right):** Load Saved ▾, size, free space, style preset, the mix
  (one split slider for two lanes, one slider per lane for three or more,
  locked to the slot total, showing "7 RL · 17 CoD"), the set with a count
  ("24 / 24"), pin toggle and swap per item, remove, Reshuffle (re-rolls
  unpinned), Save Card (name; saving under an existing saved name overwrites
  it after a confirm). A loaded legacy card is matched to library items by
  text, and a card larger than the slots loads as a pool with the slots drawn
  from it.
- Save Card writes `card_templates` with `saved = true`, `mix`, the set as
  `items` (each with `libraryItemId`, `gameTagId`) and `styles.legend` built
  from the games present.

**Done:** Playwright shots at 1280×800 with real lists: import, filter, bulk
Set Game, a 7/17 card built from the mix, a pin surviving Reshuffle, Save and
Load round-trip after a reload. Pre-flight clean (13px floor, proper caps).

## Phase 3 — Hosting

- Host This Card on the card pane opens `CreateRoomDialog` with the card. A
  saved, unchanged card is hosted by its id. Anything else is inserted first as
  a `card_templates` row with `saved = false`, named after the card or
  "Custom Card".
- `CreateRoomDialog` lists saved cards (`saved = true`) and preselects the card
  of my most recent room. If that card is an unsaved copy, it shows first as
  "Last Card (Unsaved)". A Build a Card link goes to `/library`.
- Landing `TemplateList` becomes **Saved Cards**: name, size, item count, the
  game split. Edit opens `/library?card=<id>`, New Card opens `/library`, and
  Delete **unsaves** (`saved = false`) so past nights keep their name, style
  and legend.
- A legacy card hosted straight from the dialog keeps today's behaviour,
  including per-player subsets when it holds more than the slots.

**Done:** a two-browser night from a library-built card: both boards hold the
same 24 in different orders; a 5/19 mix holds; Play Again reuses the set;
Saved Cards shows the card; Delete hides it and History still shows the night.

## Phase 4 — Game legend on the board

- `BingoSquare` takes the square's game (colour + icon) from `styles.legend`
  and `gameTagId`: a tint and a corner icon. Marked stays amber and keeps the
  icon. The hot lane and called washes must still read.
- A legend above the hero board lists only the games on this card.
- The History snapshot shows the same tints and legend. Rail minis stay plain.
- `?state=tinted` in `dev-state.ts` for captures.
- Colours and the tint treatment: three rendered variants of the real board
  (Midnight and Latte) → Ryann picks → values go into `GAME_COLORS` and
  DESIGN.md Part 2 Rulings.

**Done:** his pick applied; shots on Midnight and Latte of a live board with
marks, the hot lane and a win; History snapshot tinted.

## Decision log

| Date | Decision | By |
|---|---|---|
| 2026-09-24 | Card building lives on the library page (two panes: items, card). Create Room only picks a saved card, with the last one preselected. Supersedes the spec's "Create Room dialog grows". | Ryann |
| 2026-09-24 | Migration approved to apply with `supabase db push`. | Ryann |
| 2026-09-24 | Run phases 1–4 straight through; stop for the colour pick and for a gate failing twice. | Ryann |
| 2026-09-24 | Rooms keep `template_id`; unsaved cards become `saved = false` rows, not a snapshot in `rooms.settings` (finding 1). Supersedes the spec's data section. | Orchestrator |
| 2026-09-24 | The legend rides in `card_templates.styles.legend` so no read path changes. | Orchestrator |
| 2026-09-24 | Library is text only (finding 3). | Orchestrator |
| 2026-09-24 | Deleting a saved card unsaves it, so History keeps its name, style and legend. | Orchestrator |
| 2026-09-24 | A legacy card hosted from the dialog keeps per-player subsets; only cards built in the library are one shared set. | Orchestrator |
| 2026-09-24 | Phase 1 built: migration (3 tables, RLS, 2 card_templates columns, template import; not yet applied), `types/library.ts`, SquareItem/CardStyles fields, provisional `game-colors.ts`, `card-builder.ts` with 35 tests, read-only `.playwright-mcp/library-import-check.cjs` gate. | Phase 1 agent |
| 2026-09-24 | Migration applied with `supabase db push`; import check PASS (1,105 items, 37 owners, expected = actual). Types regenerated with `supabase gen types typescript --linked`; `players.Insert.claim_code` re-marked optional by hand because a trigger fills it; redo that edit after every regeneration. | Orchestrator |
| 2026-09-24 | Phase 2 built: `/library` with the items pane (filter chips, search, inline edit, per-row game, bulk Set Game / Add Tag / Remove Tag / Delete, New Game, New Tag, Import List) and the card pane (Load Saved, size, free space, style, split or per-lane mix, pin, swap, Reshuffle, Save with Replace confirm, `?card=`); `lib/library/api.ts` checks every update/delete row count; `card-draft.ts` reconcile keeps unpinned squares when counts move (24 tests); slider, switch, checkbox primitives added; live gate `.playwright-mcp/library-gate.cjs` 36/36. | Phase 2 agent |
| 2026-09-24 | Phase 3 built: Host This Card (primary, beside a secondary Save Card) hosts an unchanged saved card by id and anything else (unsaved, edited, a pool draw, a topped-up legacy card) as a new `saved = false` row named after the card or "Custom Card"; Create Room shows a handed-in card as a summary, otherwise lists saved cards with the last hosted card preselected ("Last Card (Unsaved)" first when it is a copy) and a Build a Card link; landing Saved Cards (Edit → `/library?card=`, Remove unsaves with a confirm, one Open Library); pure helpers in `lib/library/hosting.ts` (22 tests); live gate `.playwright-mcp/host-gate.cjs` 30/30. | Phase 3 agent |
| 2026-09-24 | Phase 4 treatment: icon-only game marker (top-left, game colour, 16/14/12px by square width), not a wash, edge bar or corner tab — picked by Ryann from rendered variants ("too much going on" with bar + marker). Rocket League uses `car` (drawn as lucide CarFront); icon keys gain `skull` and `bomb`. Palette retuned for Latte (sky, cyan, rose, orange, pink). | Ryann |
| 2026-09-24 | Phase 4 built: `lib/library/legend.ts` (`squareGame`, `cardLegend`, 13 tests); marker in `BingoSquare`; legend chips in the hero name row (the Your Board pill yields to them; `useLegendNamesFit` drops the names to icons when the row is full) and above the History snapshot; `?state=tinted`/`tinted6` harness (`&won=1`, `&called=1`); legacy cards pixel-identical to master (room and History, both themes); live gate `.playwright-mcp/marker-gate.cjs` 17/17. | Phase 4 agent |
