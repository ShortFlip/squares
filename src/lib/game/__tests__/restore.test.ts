import { describe, it, expect, vi } from 'vitest';
import { resolveRestoredCard, resolveGameStartedAt, computeBingoTimeMs } from '../restore';
import { generateCard } from '../shuffle';
import type { SquareItem } from '@/types/card';

const pool = (n: number, prefix = 'item'): SquareItem[] =>
  Array.from({ length: n }, (_, i) => ({ text: `${prefix} ${i}` }));

const FALLBACK = { boardSize: 5, freeSpace: true };

describe('resolveRestoredCard', () => {
  it('uses the stored card and never regenerates when card_data is usable', () => {
    const stored = generateCard(pool(30), 'seed', 'player-a', 5, 'full', true);
    const regenerate = vi.fn(() => pool(25, 'fresh'));
    const result = resolveRestoredCard(stored, FALLBACK, regenerate);
    expect(result.card).toBe(stored);
    expect(result.fromDb).toBe(true);
    expect(regenerate).not.toHaveBeenCalled();
  });

  it('keeps the old card when the template was edited mid-night', () => {
    // The card the player was marking, from the template as it was at round start.
    const before = generateCard(pool(30), 'seed', 'player-a', 5, 'full', true);
    // The host renames items; regenerating from the edited pool gives different text.
    const edited = pool(30, 'edited');
    const result = resolveRestoredCard(before, FALLBACK, () =>
      generateCard(edited, 'seed', 'player-a', 5, 'full', true),
    );
    expect(result.card.map((s) => s.text)).toEqual(before.map((s) => s.text));
  });

  it('reads board size and free space off the stored card, not the template', () => {
    // Stored 4x4 without a free space, template now says 5x5 with one.
    const stored = generateCard(pool(20), 'seed', 'player-a', 4, 'full', false);
    const result = resolveRestoredCard(stored, FALLBACK, () => pool(25));
    expect(result.boardSize).toBe(4);
    expect(result.freeSpace).toBe(false);

    const withFree = generateCard(pool(30), 'seed', 'player-a', 5, 'full', true);
    expect(resolveRestoredCard(withFree, { boardSize: 5, freeSpace: false }, () => []).freeSpace).toBe(true);
  });

  it.each([
    ['missing (first join)', null],
    ['undefined', undefined],
    ['empty', []],
    ['not an array', { cells: [] }],
    ['a non-square length', pool(24)],
  ])('regenerates when card_data is %s', (_label, cardData) => {
    const fresh = pool(25, 'fresh');
    const result = resolveRestoredCard(cardData, FALLBACK, () => fresh);
    expect(result.card).toBe(fresh);
    expect(result.fromDb).toBe(false);
    expect(result.boardSize).toBe(5);
    expect(result.freeSpace).toBe(true);
  });
});

describe('resolveGameStartedAt', () => {
  const now = () => new Date('2026-09-23T20:00:00.000Z');

  it('prefers the DB start time over now', () => {
    expect(resolveGameStartedAt('2026-09-23T19:45:00+00:00', now)).toBe('2026-09-23T19:45:00+00:00');
  });

  it('falls back to now for a legacy payload with no timestamp', () => {
    expect(resolveGameStartedAt(undefined, now)).toBe('2026-09-23T20:00:00.000Z');
    expect(resolveGameStartedAt(null, now)).toBe('2026-09-23T20:00:00.000Z');
  });

  it('falls back to now for an unparseable timestamp', () => {
    expect(resolveGameStartedAt('not a date', now)).toBe('2026-09-23T20:00:00.000Z');
  });
});

describe('computeBingoTimeMs', () => {
  const start = '2026-09-23T19:45:00.000Z';
  const startMs = new Date(start).getTime();

  it('measures from the round start, so a refresh does not reset the clock', () => {
    expect(computeBingoTimeMs(start, startMs + 90_000)).toBe(90_000);
  });

  it('returns null with no start time', () => {
    expect(computeBingoTimeMs(null, startMs)).toBeNull();
  });

  it('returns null rather than a negative time from a skewed PC clock', () => {
    expect(computeBingoTimeMs(start, startMs - 5_000)).toBeNull();
  });
});
