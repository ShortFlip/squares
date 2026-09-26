import { describe, it, expect } from 'vitest';
import { gamesOnCards, swapGameSquares } from '../swap-games';
import { seededRng } from '../seed-rng';
import { checkWin } from '../win-detection';
import type { SquareItem } from '@/types/card';

const RL = 'rl';
const MW = 'mw';

/** A 3×3 card: FREE in the centre, RL squares at 0, 1, 2 and 6, MW elsewhere. */
function card(): SquareItem[] {
  return [
    { text: 'Rl 1', gameTagId: RL, libraryItemId: 'r1' },
    { text: 'Rl 2', gameTagId: RL, libraryItemId: 'r2' },
    { text: 'Rl 3', gameTagId: RL, libraryItemId: 'r3' },
    { text: 'Mw 1', gameTagId: MW, libraryItemId: 'm1' },
    { text: 'FREE', isFreeSpace: true },
    { text: 'Mw 2', gameTagId: MW, libraryItemId: 'm2' },
    { text: 'Rl 4', gameTagId: RL, libraryItemId: 'r4' },
    { text: 'Mw 3', gameTagId: MW, libraryItemId: 'm3' },
    { text: 'Mw 4', gameTagId: MW, libraryItemId: 'm4' },
  ];
}

function mwPool(n: number, start = 1): SquareItem[] {
  return Array.from({ length: n }, (_, i) => ({
    text: `Mw ${start + i}`,
    gameTagId: MW,
    libraryItemId: `m${start + i}`,
  }));
}

describe('gamesOnCards', () => {
  it('lists each game once in first-seen order, ignoring FREE and untagged squares', () => {
    expect(gamesOnCards([card(), [{ text: 'x' }, { text: 'y', gameTagId: 'z' }]])).toEqual([RL, MW, 'z']);
    expect(gamesOnCards([[{ text: 'a' }, { text: 'FREE', isFreeSpace: true }]])).toEqual([]);
  });
});

describe('swapGameSquares', () => {
  it('changes only unmarked squares of the dropped game and never FREE', () => {
    const before = card();
    const marks = [1, 4]; // Rl 2 marked, FREE marked
    const result = swapGameSquares({
      card: before,
      marks,
      pool: mwPool(10),
      dropGameTagId: RL,
      targetGameTagId: MW,
      rng: seededRng('t'),
    });
    expect(result.swapped).toBe(3);
    expect(result.skipped).toBe(0);
    for (const i of [0, 2, 6]) expect(result.card[i].gameTagId).toBe(MW);
    // Marked RL square and every non-RL square untouched.
    for (const i of [1, 3, 4, 5, 7, 8]) expect(result.card[i]).toEqual(before[i]);
    expect(result.card[4].isFreeSpace).toBe(true);
  });

  it('never puts an item on the card twice, by id or by text', () => {
    const pool = [...mwPool(8), { text: '  mw 7 ', gameTagId: MW }, { text: 'Mw 8', gameTagId: MW, libraryItemId: 'm8' }];
    const result = swapGameSquares({
      card: card(),
      marks: [],
      pool,
      dropGameTagId: RL,
      targetGameTagId: MW,
      rng: seededRng('dupes'),
    });
    const texts = result.card.map((s) => (s.text ?? '').trim().toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('skips what it cannot fill when the target game runs short', () => {
    // m1..m4 are already on the card, so only m5 is new.
    const result = swapGameSquares({
      card: card(),
      marks: [],
      pool: mwPool(5),
      dropGameTagId: RL,
      targetGameTagId: MW,
      rng: seededRng('short'),
    });
    expect(result.swapped).toBe(1);
    expect(result.skipped).toBe(3);
    expect(result.card.filter((s) => s.gameTagId === RL)).toHaveLength(3);
    expect(result.card.filter((s) => s.text === 'Mw 5')).toHaveLength(1);
  });

  it('ignores pool items of other games', () => {
    const result = swapGameSquares({
      card: card(),
      marks: [],
      pool: [{ text: 'Other', gameTagId: 'other' }, { text: 'Rl 9', gameTagId: RL }],
      dropGameTagId: RL,
      targetGameTagId: MW,
      rng: seededRng('x'),
    });
    expect(result.swapped).toBe(0);
    expect(result.skipped).toBe(4);
  });

  it('is deterministic for the same rng and varies with a different one', () => {
    const run = (seed: string) =>
      swapGameSquares({
        card: card(),
        marks: [],
        pool: mwPool(30),
        dropGameTagId: RL,
        targetGameTagId: MW,
        rng: seededRng(seed),
      }).card.map((s) => s.text);
    expect(run('same')).toEqual(run('same'));
    expect(run('same')).not.toEqual(run('other'));
  });

  it('does not mutate the input card', () => {
    const before = card();
    const snapshot = JSON.parse(JSON.stringify(before));
    swapGameSquares({ card: before, marks: [], pool: mwPool(10), dropGameTagId: RL, targetGameTagId: MW, rng: seededRng('m') });
    expect(before).toEqual(snapshot);
  });

  it('keeps win detection working: a swapped-in square can complete a line', () => {
    const result = swapGameSquares({
      card: card(),
      marks: [1],
      pool: mwPool(10),
      dropGameTagId: RL,
      targetGameTagId: MW,
      rng: seededRng('win'),
    });
    // Top row: 0 and 2 were swapped, 1 was marked before. Marking the new ones wins.
    expect(result.card[0].gameTagId).toBe(MW);
    expect(checkWin(new Set([1]), 3, ['row'], true)).toBeNull();
    expect(checkWin(new Set([0, 1, 2]), 3, ['row'], true)).toBe('row');
  });
});
