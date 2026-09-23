# Card generation and win detection: the code is the spec

- **Date:** undated (item pool landed in #10, 2026-09-08)
- **Symptom:** The planned algorithms take the first N² items, justify seeding by server-side verification, and list a `custom` pattern; the pool now holds more items than squares, each card is stored in `game_players.card_data`, and `custom` matches nothing.
- **Measurement:** none recorded
- **Rule:** Cards stay reproducible from the seed (`seededRng`, mulberry32), but the stored `card_data` is what history and the rail read. `custom` is typed but unimplemented (`matchesPattern` returns false): implement it before offering it anywhere.
- **Code site:** `src/lib/game/shuffle.ts` (`generateCard`), `seed-rng.ts` (`seededRng`), `win-detection.ts` (`matchesPattern`), `room-code.ts` (`ALPHABET`), `src/types/game.ts` (`WinPattern`)

## Original note (moved verbatim from CLAUDE.md, 2026-09-22)

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
