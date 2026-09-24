import { describe, it, expect } from 'vitest';
import { buildGameSetup, type GameSetup, type TemplateLike } from '../game-setup';
import { generateCard } from '../shuffle';
import type { SquareItem } from '@/types/card';

/** Build a pool of n distinctly-labelled items. */
function pool(n: number): SquareItem[] {
  return Array.from({ length: n }, (_, i) => ({ text: `Item ${i + 1}` }));
}

/** A 5×5 free-space template row unless a test overrides part of it. */
function template(items: SquareItem[], overrides: Partial<TemplateLike> = {}): TemplateLike {
  return {
    items,
    board_size: 5,
    free_space: true,
    shuffle_mode: 'full',
    styles: {},
    ...overrides,
  };
}

/** A pool with an empty `{ text: '' }` slot spliced in at `index`. */
function withBlankAt(items: SquareItem[], index: number): SquareItem[] {
  return [...items.slice(0, index), { text: '' }, ...items.slice(index)];
}

const isBlank = (item: SquareItem) => !item.isFreeSpace && !(item.text?.trim() || item.imageUrl);

// Enough players that a bug hitting "most cards" (the April bug hit ~96%)
// can't slip through on one lucky shuffle.
const PLAYERS = ['player-a', 'player-b', 'player-c', 'player-d', 'player-e', 'player-f'];

/** Deal one card per test player from a setup, exactly as RoomClient does. */
function dealCards(setup: GameSetup): SquareItem[][] {
  return PLAYERS.map((playerId) =>
    generateCard(
      setup.items,
      setup.seed,
      playerId,
      setup.boardSize,
      setup.shuffleMode,
      setup.freeSpace,
    ),
  );
}

/**
 * The card invariants a player actually sees: N² squares, FREE at the center
 * only when free space is on, no blank squares, no item twice, and every
 * square's originalIndex pointing at the same item in setup.items (the index
 * the call list and win verification use).
 */
function expectPlayableCard(card: SquareItem[], setup: GameSetup) {
  const total = setup.boardSize * setup.boardSize;
  const center = Math.floor(total / 2);
  expect(card).toHaveLength(total);

  card.forEach((square, i) => {
    expect(isBlank(square)).toBe(false);
    expect(Boolean(square.isFreeSpace)).toBe(setup.freeSpace && i === center);
  });

  const real = card.filter((s) => !s.isFreeSpace);
  expect(new Set(real.map((s) => s.originalIndex)).size).toBe(real.length);
  for (const square of real) {
    expect(setup.items[square.originalIndex!].text).toBe(square.text);
  }
}

describe('buildGameSetup item filter', () => {
  it('drops a legacy trailing blank slot so no card or call shows a blank', () => {
    // Guards the April-10 freeSpace bug: pre-fix templates saved 24 items plus
    // an empty slot at index 24, which surfaced as a blank square and a blank call.
    const legacy = withBlankAt(pool(24), 24);

    for (const shuffle_mode of ['full', 'column']) {
      const setup = buildGameSetup(template(legacy, { shuffle_mode }), null, 'seed-1');
      expect(setup.items).toHaveLength(24);
      expect(setup.items.some(isBlank)).toBe(false);
      for (const card of dealCards(setup)) expectPlayableCard(card, setup);
    }
  });

  it('drops an empty center slot so the call list never points at a blank', () => {
    // Guards the other pre-fix layout (empty slot left at the center index):
    // its index used to land in the call list, so the caller called nothing.
    const centerBlank = withBlankAt(pool(24), 12);
    const setup = buildGameSetup(template(centerBlank), null, 'seed-1');

    expect(setup.callList).toHaveLength(24);
    for (const index of setup.callList) expect(isBlank(setup.items[index])).toBe(false);
  });

  it('treats whitespace-only text as empty but keeps image-only items', () => {
    // Guards the content test itself: "   " is blank on screen, an image is not.
    const items = [...pool(3), { text: '   ' }, { imageUrl: 'https://img.test/a.png' }];
    const setup = buildGameSetup(template(items, { board_size: 3, free_space: false }), null);

    expect(setup.items).toHaveLength(4);
    expect(setup.items.at(-1)).toEqual({ imageUrl: 'https://img.test/a.png' });
  });

  it('keeps call-list and card indices pointing into the same setup.items', () => {
    // Guards index drift: the call list and every card must index the same array,
    // or players see the wrong squares light up when an item is called.
    const setup = buildGameSetup(template(withBlankAt(pool(30), 7)), null, 'seed-1');

    expect([...setup.callList].sort((a, b) => a - b)).toEqual(
      Array.from({ length: setup.items.length }, (_, i) => i),
    );
    for (const card of dealCards(setup)) expectPlayableCard(card, setup);
  });
});

describe('buildGameSetup pool sizes', () => {
  for (const shuffle_mode of ['full', 'column'] as const) {
    it(`uses all 24 items exactly once on a 5×5 free-space card (${shuffle_mode})`, () => {
      // Guards the exact-fit pool the April bug came from: 24 items + FREE must
      // fill all 25 squares with no blank and no item dropped or repeated.
      const setup = buildGameSetup(template(pool(24), { shuffle_mode }), null, 'seed-1');

      for (const card of dealCards(setup)) {
        expectPlayableCard(card, setup);
        const used = card.filter((s) => !s.isFreeSpace).map((s) => s.originalIndex);
        const called = [...setup.callList].sort((a, b) => a - b);
        expect([...used].sort((a, b) => a! - b!)).toEqual(called);
      }
    });

    it(`draws 24 of 25 items with free space on (${shuffle_mode})`, () => {
      // Guards the N² pool with free space on: one item sits out each card,
      // and it must never be replaced by a blank or a duplicate.
      const setup = buildGameSetup(template(pool(25), { shuffle_mode }), null, 'seed-1');
      for (const card of dealCards(setup)) expectPlayableCard(card, setup);
    });

    it(`fills all 25 squares from 25 items with free space off (${shuffle_mode})`, () => {
      // Guards the no-free-space exact fit: FREE must not appear and nothing is left out.
      const setup = buildGameSetup(
        template(pool(25), { shuffle_mode, free_space: false }),
        null,
        'seed-1',
      );
      for (const card of dealCards(setup)) {
        expectPlayableCard(card, setup);
        expect(new Set(card.map((s) => s.originalIndex)).size).toBe(25);
      }
    });
  }
});

describe('buildGameSetup seed reproducibility', () => {
  it('rebuilds the same call list and cards from a stored seed', () => {
    // Guards reconnect: RoomClient rebuilds from games.seed, and a different
    // call list or card would move the player's saved marks to other squares.
    const tpl = template(withBlankAt(pool(40), 24), { shuffle_mode: 'column' });
    const started = buildGameSetup(tpl, null);
    const rebuilt = buildGameSetup(tpl, null, started.seed);

    expect(rebuilt.callList).toEqual(started.callList);
    expect(dealCards(rebuilt)).toEqual(dealCards(started));
  });

  it('mints a fresh seed per round when none is passed', () => {
    // Guards "New Round" replaying the previous round's call order.
    const tpl = template(pool(30));
    expect(buildGameSetup(tpl, null).seed).not.toBe(buildGameSetup(tpl, null).seed);
  });
});

describe('buildGameSetup settings', () => {
  it('falls back to honor mode, row/column/diagonal and empty styles', () => {
    // Guards rooms created before settings existed (settings and styles null).
    const setup = buildGameSetup(template(pool(24), { styles: null }), null, 'seed-1');
    expect(setup.gameMode).toBe('honor');
    expect(setup.winPatterns).toEqual(['row', 'column', 'diagonal']);
    expect(setup.cardStyles).toEqual({});
  });

  it('passes room settings through', () => {
    // Guards the parse dropping a host's chosen patterns or mode for the defaults.
    const setup = buildGameSetup(
      template(pool(24)),
      { winPatterns: ['blackout'], gameMode: 'traditional' },
      'seed-1',
    );
    expect(setup.winPatterns).toEqual(['blackout']);
    expect(setup.gameMode).toBe('traditional');
  });
});
