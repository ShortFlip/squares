# Item Library — spec

**Status: draft, waiting on Ryann's go. Nothing is built.** Written 2026-09-24
from his direction on 2026-09-23 and 2026-09-24. Building it needs a database
migration, and every migration needs his separate yes.

## The problem, in his words

He keeps his bingo lists outside the app and pastes them in, and one pasted
list is one card forever. He wants the lists to live in Squares: "something I
can pick from a pool of different things… an infinite list of things inside a
database, tagged a certain way." A night is usually Rocket League and Call of
Duty mixed, and players need to see which square belongs to which game.

## What changes

| Today | After |
|---|---|
| A template is one list plus its board settings (size, free space, style). | One **library** of items. Items are reused across rooms. |
| Pick a template when creating a room. | Room creation **builds tonight's set** from the library. |
| A template can hold more than N² items; each player draws their own subset (PR #10). | Tonight's set is **up to N² items** (24 on a 5×5 with free space). **Every board gets the same set, shuffled.** |
| No way to tell which game a square is about. | Each square carries its game as a **tint + icon**, with a **legend** above the board. |
| A good card has to be rebuilt by hand. | A card you built can be **saved by name and reused** in one click. |

## Decisions (settled 2026-09-24)

1. **Tags: one game, plus extra tags.** An item has at most one *game* tag
   (Rocket League, Call of Duty). The game gives it its colour and icon on the
   board. It can also have any number of *extra* tags (Mechanics, Toxic,
   Clutch), which only filter the library. An item with no game (Snack Break,
   Rage Quit) is valid and stays untinted on the board. Sub-categories are
   extra tags, so they can be added any time without a rebuild.
2. **Tonight's set is up to N² items, the same on every board.** "I would pick
   up to 24 out of the different items in the library." Each player's board is
   that same set in a different order, from the existing seeded shuffle. Rounds
   re-shuffle positions; the set stays the same all night, and Play Again
   reuses it.
3. **Pin what you want; the mix fills the rest.** He can hand-pick
   (pin) any number of items, up to the board size. Whatever is not pinned is
   filled at random according to the **mix**. Reshuffle re-rolls only the
   unpinned items. Swap on one item replaces just that one.
4. **The mix is a slider, any split.** "What if I want to do 20%, 80%?" Yes.
   The slider snaps to whole squares, because a board cannot hold half an item,
   and shows both the count and the percentage: 20/80 on 24 squares is
   **5 RL · 19 CoD**. Pins always win: pinning 8 RL items with the slider at 5
   moves the slider to 8 and shows the real split.
5. **Overlay: tint + icon + legend.** Each game tag carries a colour and a
   lookalike icon (a boost flame for Rocket League, a crosshair for Call of
   Duty). **No real game logos**: the repo is public and logos are
   trademarked art. The legend lists only the games on tonight's board.
6. **Owner only.** Your library is yours. Other players see its items on their
   boards but never browse or edit it.
7. **Existing templates become saved cards, and their items join the
   library.** Each template keeps working as a saved card (decision 9) with no
   conversion. Its items are also copied into the library with an extra tag
   named after the template. Duplicates are merged (case-insensitive). Game
   tags are not guessed; he assigns them in bulk on the library page.
8. **Board settings move to room creation.** Board size, free space, card
   style and shuffle mode become room settings. The last setup is remembered,
   so a normal Thursday is Create Room, then Create.
9. **Saved cards.** "What if I made a card and I want to save it and we can
   reuse it? I don't want to sit there and make a whole new card." In Create
   Room, **Save Card** stores tonight's set with a name, together with its board
   size, free space, style and mix. **Load Saved Card** brings it back exactly,
   ready to use as it is or to tweak. A saved card is a frozen copy: fixing a
   typo in the library does not change it. The landing's card list becomes
   **Saved Cards**. A legacy template that holds more than the board needs
   loads as a pool, and the room draws its 24 from it (Reshuffle draws again).

## How a night works

1. Landing → **Host a Game → Create a Room**. The dialog opens on last time's
   setup: 5×5, free space on, 30% RL / 70% CoD, same style. Or he picks a
   saved card from the landing's Saved Cards, or from Load Saved Card in the
   dialog.
2. Tonight's 24 are already filled, from the mix or from the saved card. He
   can Reshuffle, swap any single item, or pin specific items from the
   library. **Save Card** keeps this set for next time.
3. **Create Room.** The set is frozen into the room.
4. Everyone's board is those 24 in a different order. Squares show their
   game's tint and icon; the legend sits above the board.
5. New Round and Play Again reshuffle positions from the same set.

## Screens

The sketches below settle what goes where. The look (colours, sizes, spacing) is
decided with `ui-pass` during the build, from rendered variants on the real app.

### Library (`/library`, replaces the template editor)

```
 Library                                   [Import List]
 Filter: [All Games ▾] [Rocket League] [Call of Duty] [No Game]
         [Mechanics] [Toxic] …            Search [________]
 ─────────────────────────────────────────────────────────
 ☐  ▲  Demo at kickoff          Rocket League · Mechanics
 ☐  +  Kill Trade               Call of Duty
 ☐     Snack Break              (no game)
 …
 3 selected:  [Set Game ▾] [Add Tag ▾] [Remove Tag ▾] [Delete]
```

- **Import List** is today's paste box (`parseImport`: newlines, then commas,
  deduped), plus a game and extra tags applied to everything pasted.
  Items already in the library are skipped and counted ("22 added, 2 already
  in your library").
- Editing an item edits its text or image in place. Image items stay
  supported.
- Deleting an item never changes a past night: history reads each player's
  saved card, not the library.

### Room creation (the Create Room dialog grows)

```
 New Room                        [Load Saved Card ▾]  [Save Card]
 Name [Thursday Night]   Size [5×5]   Free Space [On]   Style [Arcade ▾]
 Mix   Rocket League ◀────●──────────▶ Call of Duty
       5 RL · 19 CoD (21% / 79%)            + Add a game or No Game
 ─────────────────────────────────────────────────────────
 Tonight's 24                    [Reshuffle]  [Pin From Library]
 ▲ Demo at kickoff        📌            ⇄
 + Kill Trade                           ⇄
 …
                                              [Create Room]
```

- Two games in the mix: one split slider. Three or more: one slider per game,
  locked to the board total. **No Game** can join the mix as its own lane
  (default 0%).
- If a game has fewer items than its share, the slider stops at what exists
  and says so ("Only 4 Rocket League items").

### Game screen

```
 RYANN                                 7 / 25
 [▲ Rocket League]  [+ Call of Duty]        ← legend, above the board
 ┌──────────┬──────────┬──────────┐
 │▲  tint   │+  tint   │  no tint │
 │ Demo at  │  Kill    │  Snack   │
 │ kickoff  │  Trade   │  Break   │
 └──────────┴──────────┴──────────┘
```

- **Marked beats tint.** A marked square is amber in every theme (DESIGN.md);
  the game icon stays visible on it, so the game is still readable.
- Tints must not be confused with the colours that already mean something on
  the board: amber (marked), emerald (best line), gold (win), violet (free
  space).
- **Rail miniatures stay untinted.** They carry state through shape and the
  existing colours; a game tint on a 20px tile is noise.
- The History card snapshot shows tints and icons, so a past card reads the
  same way.

## Data

- **New tables**, all owned by a player:
  - `tags`: `id, owner_id, name, kind ('game' | 'tag'), color, icon, created_at`.
  - `library_items`: `id, owner_id, text, image_url, game_tag_id (nullable), created_at`.
  - `library_item_tags`: `item_id, tag_id` for the extra tags.
- **Saved cards reuse `card_templates`.** It already holds a name, board size,
  free space, shuffle mode, style and an items snapshot, which is exactly a
  saved card. It gains an optional `mix` (`jsonb`), and its items gain
  `gameTagId`. `rooms.template_id` records which saved card a room started
  from, so History keeps showing the card's name.
- **Rooms get no new columns.** `rooms.settings` (already `jsonb`) gains the
  room's board setup, its mix, the frozen set (a snapshot of text, image and
  game per item, not foreign keys) and a legend snapshot (name, colour, icon
  per game). A snapshot means editing the library mid-night changes nothing in
  a live room. `rooms.template_id` stays, nullable, so old nights still read
  their template.
- `SquareItem` gains an optional `gameTagId`; `game_players.card_data` keeps
  it, and the room's legend snapshot turns it into a colour and icon.
- `buildGameSetup` already takes a template-shaped object (items, board size,
  free space, shuffle mode, styles). The room builds that object from its own
  settings, so the shuffle, the call list and win detection do not change.
- **RLS stays open** (docs/decisions/0002-client-side-win-verification.md).
  "Owner only" is a filter in the app, the same honour system as the rest.
- The migration also runs the one-time template import (decision 7).

## Build plan (only after his go)

Four phases, then ship, then the next batch. Each phase is proved by the
orchestrator from a diff and screenshots, never from a subagent's summary.

| # | Phase | Model | Effort | Run as | Done when |
|---|---|---|---|---|---|
| 1 | Migration, generated types, template import | Opus 5.5 | high | orchestrator (the migration needs his yes) | migration applied; `types.ts` regenerated; library count equals the deduped template item count; tsc and tests green |
| 2 | Library page: list, filter, import with tags, bulk Set Game / tags, delete | Opus 5.5 | medium | subagent, `ui-pass` | screenshots at 1280×800 with his real lists; floor and pre-flight clean |
| 3 | Room creation: mix slider, pins, reshuffle, swap, Save Card / Load Saved Card, remembered setup; rounds built from the room | Opus 5.5 | high | subagent | two-browser gate: both boards hold the same 24 in different orders; 5 RL · 19 CoD holds; a saved card reloads the same 24 after a page reload; Play Again reuses the set |
| 4 | Tint, icon and legend on the hero board and the History snapshot | Opus 5.5 | medium | subagent, `ui-pass` with rendered colour variants | screenshots on Midnight and Latte; marked squares still read as amber |

Next batch: retire the template editor (`/create`) once the import is
verified, rename the landing's `TemplateList` to Saved Cards, and point the
landing at the library.

## Not in this spec

- Sharing libraries between players, or a public item database.
- The other four overlay styles from the mockups (Glass Wash, Team Frame,
  Watermark, Header Stripe). Tint + icon + legend is the one overlay; the rest
  can come back as room options later.
- Each player drawing a different subset from a larger pool. `generateCard`
  still supports it, but the room setup no longer offers it.
