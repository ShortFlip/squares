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
