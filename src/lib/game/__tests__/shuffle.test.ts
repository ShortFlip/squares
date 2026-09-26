import { describe, it, expect } from 'vitest';
import { generateCard, fisherYates } from '../shuffle';
import { seededRng } from '../seed-rng';
import type { SquareItem } from '@/types/card';

/** Build a pool of n distinctly-labelled items. */
function pool(n: number): SquareItem[] {
  return Array.from({ length: n }, (_, i) => ({ text: `Item ${i + 1}` }));
}

const texts = (card: SquareItem[]) => card.map((s) => s.text);

describe('fisherYates', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = fisherYates(input, seededRng('a'));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('generateCard', () => {
  it('is deterministic for the same seed and player', () => {
    const a = generateCard(pool(25), 'seed-1', 'player-a', 5, 'full', true);
    const b = generateCard(pool(25), 'seed-1', 'player-a', 5, 'full', true);
    expect(texts(a)).toEqual(texts(b));
  });

  it('gives different players different cards from the same seed', () => {
    const a = generateCard(pool(25), 'seed-1', 'player-a', 5, 'full', true);
    const b = generateCard(pool(25), 'seed-1', 'player-b', 5, 'full', true);
    expect(texts(a)).not.toEqual(texts(b));
  });

  it('draws exactly N² squares from a surplus pool, FREE at the center', () => {
    const card = generateCard(pool(40), 'seed-1', 'player-a', 5, 'full', true);
    expect(card).toHaveLength(25);
    expect(card[12].isFreeSpace).toBe(true);
    // The other 24 squares are distinct real items drawn from the 40-item pool.
    const others = card.filter((_, i) => i !== 12);
    expect(new Set(others.map((s) => s.text)).size).toBe(24);
  });

  it('draws a different subset from a surplus pool for a different seed', () => {
    const a = generateCard(pool(40), 'seed-1', 'player-a', 5, 'full', true);
    const b = generateCard(pool(40), 'seed-2', 'player-a', 5, 'full', true);
    expect(texts(a)).not.toEqual(texts(b));
  });

  it('fills every square when freeSpace is off', () => {
    const card = generateCard(pool(25), 'seed-1', 'player-a', 5, 'full', false);
    expect(card).toHaveLength(25);
    expect(card.every((s) => s.text && !s.isFreeSpace)).toBe(true);
  });

  it('deals different subsets of a 40-item pool to two rounds', () => {
    // The whole point of a surplus pool: round 2 is not round 1 reshuffled.
    const a = generateCard(pool(40), 'round-1-seed', 'player-a', 5, 'full', true);
    const b = generateCard(pool(40), 'round-2-seed', 'player-a', 5, 'full', true);

    for (const card of [a, b]) {
      expect(card).toHaveLength(25);
      expect(card[12].isFreeSpace).toBe(true);
    }

    const setOf = (card: SquareItem[]) =>
      new Set(card.filter((s) => !s.isFreeSpace).map((s) => s.text));
    expect(setOf(a)).not.toEqual(setOf(b));
  });

  it('skips a blank pool slot in full mode instead of dealing it', () => {
    // Guards the April-10 bug for callers that skip buildGameSetup's filter: a
    // legacy 24-items-plus-blank pool must still deal 24 real items around FREE.
    const legacy = [...pool(24), { text: '' }];
    for (const playerId of ['player-a', 'player-b', 'player-c', 'player-d']) {
      const card = generateCard(legacy, 'seed-1', playerId, 5, 'full', true);
      expect(card).toHaveLength(25);
      expect(card[12].isFreeSpace).toBe(true);
      const real = card.filter((s) => !s.isFreeSpace);
      expect(real.every((s) => s.text)).toBe(true);
      expect(new Set(texts(real)).size).toBe(24);
    }
  });

  it('draws a full, duplicate-free card from a surplus pool in column mode', () => {
    const card = generateCard(pool(40), 'seed-1', 'player-a', 5, 'column', true);
    expect(card).toHaveLength(25);
    expect(card[12].isFreeSpace).toBe(true);

    const real = card.filter((s) => !s.isFreeSpace);
    expect(real).toHaveLength(24);
    // Every square is a real item and no item appears twice.
    expect(real.every((s) => s.text && s.text.length > 0)).toBe(true);
    expect(new Set(real.map((s) => s.text)).size).toBe(24);
  });

  it('keeps column-mode items inside their partition', () => {
    // 24 items + free space: partitions are [0..4],[5..9],[10..13],[14..18],[19..23]
    // (the center column needs only 4 because FREE takes a row).
    const items = pool(24);
    const card = generateCard(items, 'seed-1', 'player-a', 5, 'column', true);
    const bounds = [
      [0, 5], [5, 10], [10, 14], [14, 19], [19, 24],
    ];
    for (let col = 0; col < 5; col++) {
      const [start, end] = bounds[col];
      const allowed = new Set(items.slice(start, end).map((s) => s.text));
      for (let row = 0; row < 5; row++) {
        const square = card[row * 5 + col];
        if (square.isFreeSpace) continue;
        expect(allowed.has(square.text!)).toBe(true);
      }
    }
  });
});

// ── Roaming FREE on small boards ───────────────────────────────────────────
// 3×3 and 4×4 put FREE at a seeded random square so every player's FREE is not
// in the same spot; 5×5 and up keep the classic centre and must not change.

/** Grid index of FREE, or -1. Pool position n+1 → "Item n+1" is how the pins read. */
const freeAt = (card: SquareItem[]) => card.findIndex((s) => s.isFreeSpace);
/** Pool position (1-based) per square, 0 for FREE — compact enough to pin. */
const layout = (card: SquareItem[]) =>
  card.map((s) => (s.isFreeSpace ? 0 : (s.originalIndex ?? -1) + 1));
const seeds = Array.from({ length: 40 }, (_, i) => `seed-${i}`);

describe('generateCard — free space position', () => {
  for (const size of [3, 4]) {
    for (const mode of ['full', 'column'] as const) {
      it(`${size}×${size} ${mode}: FREE lands off-centre for some seed`, () => {
        const centre = Math.floor((size * size) / 2);
        const spots = seeds.map((s) => freeAt(generateCard(pool(30), s, 'player-a', size, mode, true)));
        expect(spots.every((i) => i >= 0 && i < size * size)).toBe(true);
        expect(spots.some((i) => i !== centre)).toBe(true);
      });

      it(`${size}×${size} ${mode}: same seed and player gives the same card`, () => {
        const a = generateCard(pool(30), 'seed-7', 'player-a', size, mode, true);
        const b = generateCard(pool(30), 'seed-7', 'player-a', size, mode, true);
        expect(a).toEqual(b);
        expect(freeAt(a)).toBe(freeAt(b));
      });

      it(`${size}×${size} ${mode}: two players differ in FREE position for some seed`, () => {
        const differs = seeds.some(
          (s) =>
            freeAt(generateCard(pool(30), s, 'player-a', size, mode, true)) !==
            freeAt(generateCard(pool(30), s, 'player-b', size, mode, true)),
        );
        expect(differs).toBe(true);
      });

      it(`${size}×${size} ${mode}: exactly one FREE and no blank playable squares`, () => {
        for (const s of seeds) {
          const card = generateCard(pool(size * size - 1), s, 'player-a', size, mode, true);
          expect(card).toHaveLength(size * size);
          expect(card.filter((c) => c.isFreeSpace)).toHaveLength(1);
          // An exact-size pool must fill every square — the column-locked path
          // reserves its short column where FREE actually is, not at the centre.
          expect(card.every((c) => c.isFreeSpace || c.text)).toBe(true);
        }
      });
    }
  }

  it('column-locked 3×3 keeps every item in its home column around a roaming FREE', () => {
    for (const s of seeds) {
      // 8 items for 8 playable squares: FREE's column gets 2, the others 3.
      const card = generateCard(pool(8), s, 'player-a', 3, 'column', true);
      const freeCol = freeAt(card) % 3;
      const sizes = [0, 1, 2].map((c) => 3 - (c === freeCol ? 1 : 0));
      const starts = [0, sizes[0], sizes[0] + sizes[1]];
      card.forEach((sq, i) => {
        if (sq.isFreeSpace) return;
        const col = i % 3;
        const idx = sq.originalIndex ?? -1;
        expect(idx >= starts[col] && idx < starts[col] + sizes[col]).toBe(true);
      });
    }
  });

  // Pinned from master before this change: 5×5 and up must produce the exact
  // same cards, so rounds already stored (and re-generated) do not shift.
  it('5×5 full with FREE is unchanged (pinned)', () => {
    expect(layout(generateCard(pool(40), 'pin-seed', 'player-a', 5, 'full', true))).toEqual(
      [12, 10, 13, 29, 16, 19, 6, 1, 21, 32, 15, 26, 0, 3, 2, 20, 35, 22, 30, 36, 8, 34, 37, 14, 24],
    );
  });

  it('5×5 column with FREE is unchanged (pinned)', () => {
    expect(layout(generateCard(pool(40), 'pin-seed', 'player-a', 5, 'column', true))).toEqual(
      [5, 16, 19, 32, 39, 2, 10, 18, 29, 34, 3, 14, 0, 25, 40, 6, 15, 20, 30, 33, 1, 13, 24, 28, 36],
    );
  });

  it('6×6 full with FREE is unchanged (pinned)', () => {
    expect(layout(generateCard(pool(50), 'pin-seed', 'player-a', 6, 'full', true))).toEqual([
      44, 27, 2, 8, 48, 6, 39, 30, 35, 33, 38, 29, 40, 37, 18, 20, 19, 1, 0, 25, 10, 41, 16, 4,
      3, 13, 17, 28, 11, 46, 43, 47, 26, 49, 34, 24,
    ]);
  });

  it('5×5 without FREE is unchanged (pinned)', () => {
    expect(layout(generateCard(pool(30), 'pin-seed', 'player-a', 5, 'full', false))).toEqual(
      [25, 24, 16, 1, 7, 12, 28, 26, 2, 22, 9, 10, 27, 14, 17, 6, 11, 21, 15, 5, 8, 4, 19, 23, 20],
    );
  });
});
