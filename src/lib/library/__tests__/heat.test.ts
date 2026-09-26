import { describe, expect, it } from 'vitest';
import { cardHeat, computeHeat, hitRate } from '../heat';

const items = [
  { id: 'a', text: 'Airstrike' },
  { id: 'b', text: 'Knife Kill' },
  { id: 'c', text: 'Never Seen' },
];

describe('computeHeat', () => {
  it('counts marks over appearances by libraryItemId', () => {
    const heat = computeHeat(items, [
      { cardData: [{ text: 'Airstrike', libraryItemId: 'a' }, { text: 'Knife Kill', libraryItemId: 'b' }], marks: [0] },
      { cardData: [{ text: 'Knife Kill', libraryItemId: 'b' }, { text: 'Airstrike', libraryItemId: 'a' }], marks: [1, 0] },
    ]);
    expect(heat.a).toEqual({ marked: 2, appearances: 2 });
    expect(heat.b).toEqual({ marked: 1, appearances: 2 });
    expect(hitRate(heat.b)).toBe(0.5);
  });

  it('falls back to trimmed, lower-cased text for pre-library rounds', () => {
    const heat = computeHeat(items, [{ cardData: [{ text: '  airSTRIKE ' }], marks: [0] }]);
    expect(heat.a).toEqual({ marked: 1, appearances: 1 });
  });

  it('skips FREE even when it is marked', () => {
    const heat = computeHeat(
      [...items, { id: 'f', text: 'FREE' }],
      [{ cardData: [{ text: 'FREE', isFreeSpace: true }], marks: [0] }],
    );
    expect(heat).toEqual({});
  });

  it('gives no rate, not 0%, to an item that never appeared', () => {
    const heat = computeHeat(items, [{ cardData: [{ text: 'Airstrike', libraryItemId: 'a' }], marks: [] }]);
    expect(heat.c).toBeUndefined();
    expect(hitRate(heat.c)).toBeNull();
    expect(hitRate(heat.a)).toBe(0);
  });

  it('adds up across players and rounds and ignores malformed rows', () => {
    const card = [{ text: 'Airstrike', libraryItemId: 'a' }];
    const heat = computeHeat(items, [
      { cardData: card, marks: [0] },
      { cardData: card, marks: [] },
      { cardData: card, marks: [0] },
      { cardData: null, marks: [0] },
    ]);
    expect(heat.a).toEqual({ marked: 2, appearances: 3 });
  });
});

describe('cardHeat', () => {
  it('averages the squares with data and counts the rest', () => {
    const heat = { a: { marked: 1, appearances: 1 }, b: { marked: 0, appearances: 2 } };
    const result = cardHeat(
      [
        { text: 'Airstrike', libraryItemId: 'a' },
        { text: 'Knife Kill', libraryItemId: 'b' },
        { text: 'Never Seen', libraryItemId: 'c' },
        { text: 'FREE', isFreeSpace: true },
      ],
      items,
      heat,
    );
    expect(result).toEqual({ rate: 0.5, withData: 2, total: 3 });
  });
});
