# Punch list

## 2026-09-26 — after the first game night on the Item Library

> I used this last night and the one thing that's a little confusing is being able to, how to add, different items to different cards. Like in the library section, I feel like the pinning thing, it makes sense, but I'm a little confused about how to make sure what I'm picking on the left goes over the other side, you know what I mean? Other than that, the board worked well. I think what we need also for if we're going to have the free space on a smaller grid than a 5x5, we need to have the free space in random areas because it was generating, it was put in the same spot for all of our cards, which is not a problem, but, I think that needs to be a thing as well. Also, when we were playing Rocket League last night, it was very hard to obtain any of those things we got, so maybe we just like, here's what I'm envisioning. When we're playing a game, we are, we usually start with Rocket League and then we'll go and jump to Modern Warfare, but then we still have like, say if we have two squares that are Rocket League-esque on the board. We'll never hit those. I was thinking, if we don't hit those, give us an option like mid-match to like, re-roll or get remove the Rocket League ones, just to add other ones back in that are actually Modern Warfare. Those are just my takeaways from last night.

| # | Item | Size | Status |
|---|------|------|--------|
| 1 | Library: unclear how picking on the left reaches the card on the right | Tweak | Shipped #36 (not seen live) |
| 2 | Free space in a random spot per card (grids under 5×5) | Feature | Shipped #39 (not seen live) |
| 3 | Mid-round swap of one game's squares for the other game's | Feature | Shipped #37 (test next game night) |
| 4 | Item hit-rate heatmap from past rounds | Feature | Shipped #38 (not seen live) |

### 1 — Library left→right flow (tweak)
The card auto-fills from the Mix; `+` on the left pins an item into it, bumping an unpinned square. Nothing on screen says that. Fix: one hint line under the `24 / 24` count ("Mix fills the card · + on the left pins an item in, bumping an unpinned square"), and a brief amber flash on the square that landed on the right. ui-pass round with before/after screenshots.

### 2 — Random free-space position (feature)
- **What:** each player's FREE square lands at a seeded random index instead of the fixed centre.
- **Data shape:** no schema change — position is already implicit in `card_data` (`isFreeSpace`). Win detection and `bestLine` currently hard-code `floor(N²/2)`; they must read the index from the card instead.
- **Layout call:** random on every size, or only under 5×5 (5×5 keeps the classic centre)? Recommend: only under 5×5, since the centre is the tradition on 5×5 and 3×3/4×4 have no true centre anyway.
- **Model:** Opus 5.5 · **Effort:** medium
- **Done:** two players on a 4×4 get FREE in different spots; a line through each FREE wins; Vitest covers win detection with an off-centre FREE.

### 3 — Mid-round game swap (feature)
- **What:** a host button in the game header — "Swap Rocket League → Modern Warfare" — that replaces every **unmarked** square of one game on every card with fresh items from the other game, mid-round.
- **Data shape:** rewrites `game_players.card_data` for each player; new broadcast `cards_swapped` so tabs reload cards. Marked squares stay put. No schema change.
- **Layout call:** host-only, in `HostControls`, appears only when the card has 2+ games.
- **Model:** Opus 5.5 · **Effort:** high (new write path across every player's card mid-round)
- **Done:** two browser contexts; host swaps; both boards show no unmarked Rocket League squares, marks intact, no reload needed.

### 4 — Item hit-rate heatmap (feature)
> "a bunch of ones … picked more often than others … we usually get one bingo and then we get 75% of the way on the second one and we never get a second one … a heat map distribution of what items were called … based on the historical playthroughs"
- **What:** per item, hit rate = times marked ÷ times it was on a card, over every past round. Shown as a heat column/badge in the Library item list (cold blue → hot amber), sortable, plus a "Card Heat" estimate on the card builder (average hit rate of the drawn set).
- **Data shape:** no new table — every round already stores `game_players.card_data` + `marks`. Compute from those (match by `libraryItemId`, fall back to lower-cased text for pre-library rounds). Cache later only if it gets slow.
- **Layout call:** heat lives in the Library row (thin bar + %), not a separate page — it's used while building a card.
- **Model:** Opus 5.5 · **Effort:** medium
- **Done:** Library rows show hit % that matches a hand count from the DB for 3 items; sorting by heat works; card builder shows the set's average.
