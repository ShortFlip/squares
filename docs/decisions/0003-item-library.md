# 0003 — Item Library: every room keeps a card row

- **Date:** 2026-09-24
- **Symptom:** A pasted list was one card forever. The same item was retyped
  for every card, and nothing on the board said which game a square belonged
  to.
- **Measurement:** The import moved 1,105 items across 37 owners into the
  library, expected equal to actual. Live gates: Phase 2 passed 36/36,
  Phase 3 30/30 (run twice), Phase 4 17/17. Unit tests went from 90 to 184.
- **Rule:**
  1. Every room keeps a `template_id`. A card hosted without being saved is
     written to `card_templates` with `saved = false`. GameLobby, New Round and
     reconnect all read the card through `rooms.template_id`, and a null id
     breaks all three.
  2. Removing a saved card sets `saved = false` and never deletes the row.
     History reads a night's card name, style and legend through that row.
  3. Owner-only writes (update/delete on `tags`, `library_items`,
     `library_item_tags` and `card_templates`) must chain `.select('id')` and
     treat 0 rows as a failure. RLS blocks them silently.
  4. After `supabase gen types typescript --linked`, re-mark
     `players.Insert.claim_code` optional. A trigger fills it, and the
     generated type makes it required, which breaks `PlayerProvider`.
  5. A card's legend rides in `card_templates.styles.legend`. A card without a
     legend (every card made before the library) must render exactly as before.
- **Code sites:**
  - `supabase/migrations/20260924000000_item_library.sql`
  - `src/lib/game/card-builder.ts`
  - `src/lib/library/` (`api.ts`, `card-draft.ts`, `hosting.ts`, `legend.ts`)
  - `src/stores/libraryStore.ts`
  - `src/app/library/page.tsx`, `src/components/library/`
  - `src/components/game/CreateRoomDialog.tsx`,
    `src/components/game/TemplateList.tsx` (Saved Cards)
  - `src/components/board/BingoSquare.tsx`,
    `src/components/board/BoardLegend.tsx`

## Note

Spec: `docs/plans/item-library.md`. The build plan and its decision log are in
`docs/plans/item-library-build.md`. Where they disagree, the decision log wins.

| Phase | PR | What landed |
|---|---|---|
| Spec | #25 | Tagged pool, saved cards, one shared set per night |
| 1 | #26 | Three tables, `card_templates.saved` and `mix`, template import, `card-builder.ts` |
| 2 | #27 | `/library`: items pane (import, filter, bulk game/tags) and card pane (mix slider, pins, swap, save, load) |
| 3 | #28 | Host This Card, Create a Room preselects the last card, landing Saved Cards |
| 4 | #29 | Game icon marker, legend beside the score, History snapshot markers, palette retuned for Latte |

Corrected assumptions:

- The spec put card building in Create Room. Ryann moved it to the library
  page, and Create Room now only picks a saved card.
- The spec snapshotted the set into `rooms.settings`. That was replaced by
  `saved = false` rows (rule 1).
- The spec called for "tint + icon + legend". On the real board, a full tint
  made orange squares read as marked amber, and an edge bar was "too much going
  on". The marker is the icon alone.
- `imageUrl` was never rendered, so the library is text only.

Not done:

- `/create` and `BoardEditor` are still reachable by URL. Retire them next.
- Gate runs left test players, libraries, cards and rooms in the live
  database.
- ~~Square text renders at line height 1.5, not the intended 1.25:
  `squareClassName`'s text size class makes `cn` drop `leading-tight`. This
  predates the library.~~ Fixed 2026-09-25: `leading-tight` now sits on the
  square's text span, where nothing is merged into it.
