import { describe, it, expect } from 'vitest';
import {
  buildLegend,
  defaultMix,
  itemsForSave,
  laneKeysFor,
  matchCardItems,
  mixForBuild,
  mixFromSet,
  planImport,
  rebalanceLanes,
  reconcileCardSet,
  sameSet,
  textKey,
} from '../card-draft';
import { buildCardSet, countByLane, splitFromPercent, type LaneKey } from '@/lib/game/card-builder';
import { seededRng } from '@/lib/game/seed-rng';
import type { SquareItem } from '@/types/card';
import type { CardMix, LibraryItem, Tag } from '@/types/library';

const RL = 'game-rl';
const COD = 'game-cod';

function lane(prefix: string, gameTagId: string | null, n: number): LibraryItem[] {
  return Array.from({ length: n }, (_, i) => {
    const num = String(i + 1).padStart(2, '0');
    return { id: `${prefix}-${num}`, text: `${prefix} item ${num}`, gameTagId, tagIds: [] };
  });
}

const POOL: LibraryItem[] = [...lane('rl', RL, 20), ...lane('cod', COD, 30), ...lane('ng', null, 3)];

const TAGS: Tag[] = [
  { id: RL, ownerId: 'me', name: 'Rocket League', kind: 'game', color: 'sky', icon: 'flame' },
  { id: COD, ownerId: 'me', name: 'Call of Duty', kind: 'game', color: 'orange', icon: 'crosshair' },
  { id: 'tag-mech', ownerId: 'me', name: 'Mechanics', kind: 'tag', color: null, icon: null },
];

const mix = (...lanes: Array<[string | null, number]>): CardMix => ({
  lanes: lanes.map(([gameTagId, count]) => ({ gameTagId, count })),
});
const ids = (set: SquareItem[]) => set.map((s) => s.libraryItemId);
const inLane = (set: SquareItem[], key: LaneKey) => set.filter((s) => (s.gameTagId ?? null) === key);
const rng = (seed = 'seed') => seededRng(seed);

/** A 24-slot card at a 7/17 split, built the way the page builds its first card. */
function card717(): SquareItem[] {
  return reconcileCardSet({
    current: [], pool: POOL, slots: 24, mix: mix([RL, 7], [COD, 17]), pinnedIds: [], rng: rng(),
  }).set;
}

describe('textKey / planImport', () => {
  it('trims and lower-cases', () => {
    expect(textKey('  Kill Trade ')).toBe('kill trade');
    expect(textKey(undefined)).toBe('');
  });

  it('skips repeats within the paste and anything already in the library', () => {
    const plan = planImport(['Kill Trade', ' kill trade ', 'Demo', 'Aerial Goal', ''], ['DEMO']);
    expect(plan.fresh).toEqual(['Kill Trade', 'Aerial Goal']);
    expect(plan.skipped).toBe(2);
  });
});

describe('lanes and the default mix', () => {
  it('offers games that have items in tag order, then No Game', () => {
    expect(laneKeysFor(POOL, TAGS)).toEqual([RL, COD, null]);
    expect(laneKeysFor(lane('rl', RL, 2), TAGS)).toEqual([RL]);
  });

  it('splits evenly across games with No Game at 0', () => {
    expect(defaultMix([RL, COD, null])).toEqual(mix([RL, 1], [COD, 1], [null, 0]));
    const built = buildCardSet({ pool: POOL, slots: 24, mix: defaultMix([RL, COD, null]), pinnedIds: [], rng: rng() });
    expect(built.mix.lanes.map((l) => l.count)).toEqual([12, 12, 0]);
  });

  it('splits across No Game when there are no games at all', () => {
    expect(defaultMix([null])).toEqual(mix([null, 1]));
  });

  it('uses the requested mix once one exists', () => {
    expect(mixForBuild(mix([RL, 5]), [RL, COD])).toEqual(mix([RL, 5]));
    expect(mixForBuild({ lanes: [] }, [RL, COD])).toEqual(mix([RL, 1], [COD, 1]));
  });

  it('reads the real split off a set, ignoring text-only squares', () => {
    const set: SquareItem[] = [...card717(), { text: 'Legacy square' }];
    expect(mixFromSet(set)).toEqual(mix([RL, 7], [COD, 17]));
  });
});

describe('rebalanceLanes', () => {
  const avail = countByLane(POOL);

  it('keeps the total at the slots when one lane moves', () => {
    const next = rebalanceLanes(mix([RL, 8], [COD, 8], [null, 8]).lanes, 0, 12, 24, avail);
    expect(next.map((l) => l.count).reduce((a, b) => a + b, 0)).toBe(24);
    expect(next[0].count).toBe(12);
  });

  it('shares the rest in proportion to what the other lanes hold', () => {
    // No Game only has 3 items, so it is capped and Call of Duty takes the rest.
    const next = rebalanceLanes(mix([RL, 12], [COD, 12], [null, 0]).lanes, 0, 7, 24, avail);
    expect(next.map((l) => l.count)).toEqual([7, 17, 0]);
  });

  it('shares evenly when the other lanes are all at 0', () => {
    const next = rebalanceLanes(mix([RL, 24], [COD, 0], [null, 0]).lanes, 0, 18, 24, avail);
    expect(next.map((l) => l.count)).toEqual([18, 3, 3]);
  });
});

describe('reconcileCardSet', () => {
  it('builds a full card at the requested split', () => {
    const set = card717();
    expect(set).toHaveLength(24);
    expect(inLane(set, RL)).toHaveLength(7);
    expect(inLane(set, COD)).toHaveLength(17);
    expect(new Set(ids(set)).size).toBe(24);
  });

  it('moving the split one notch changes exactly one square', () => {
    const before = card717();
    const [a, b] = splitFromPercent(((8 / 24) * 100), 24);
    const after = reconcileCardSet({
      current: before, pool: POOL, slots: 24, mix: mix([RL, a], [COD, b]), pinnedIds: [], rng: rng('other'),
    }).set;
    expect(inLane(after, RL)).toHaveLength(8);
    const beforeIds = new Set(ids(before));
    expect(ids(after).filter((id) => !beforeIds.has(id))).toHaveLength(1);
    // The new square takes the dropped square's place: every other position is untouched.
    const moved = after.filter((s, i) => s.libraryItemId !== before[i].libraryItemId);
    expect(moved).toHaveLength(1);
  });

  it('keeps pins first and never drops them on a reshuffle', () => {
    const pins = ['rl-03', 'cod-10'];
    const first = reconcileCardSet({
      current: card717(), pool: POOL, slots: 24, mix: mix([RL, 7], [COD, 17]), pinnedIds: pins, rng: rng(),
    }).set;
    expect(ids(first).slice(0, 2)).toEqual(pins);

    // Reshuffle = reconcile from the pins alone with a fresh seed.
    const reshuffled = reconcileCardSet({
      current: first.slice(0, 2), pool: POOL, slots: 24, mix: mix([RL, 7], [COD, 17]), pinnedIds: pins, rng: rng('again'),
    }).set;
    expect(ids(reshuffled).slice(0, 2)).toEqual(pins);
    expect(reshuffled).toHaveLength(24);
    expect(ids(reshuffled).slice(2)).not.toEqual(ids(first).slice(2));
  });

  it('pins win over the split and drop only what they must', () => {
    const before = card717();
    const pins = lane('rl', RL, 9).map((i) => i.id); // 9 RL pins with the slider at 7
    const result = reconcileCardSet({
      current: before, pool: POOL, slots: 24, mix: mix([RL, 7], [COD, 17]), pinnedIds: pins, rng: rng(),
    });
    expect(inLane(result.set, RL)).toHaveLength(9);
    expect(result.mix.lanes.find((l) => l.gameTagId === RL)?.count).toBe(9);
    expect(result.set).toHaveLength(24);
  });

  it('refills a square whose item left the library, and re-lanes a changed game', () => {
    const before = card717();
    const goneId = inLane(before, COD)[0].libraryItemId!;
    const pool = POOL.filter((i) => i.id !== goneId);
    const after = reconcileCardSet({
      current: before, pool, slots: 24, mix: mix([RL, 7], [COD, 17]), pinnedIds: [], rng: rng(),
    }).set;
    expect(ids(after)).not.toContain(goneId);
    expect(after).toHaveLength(24);
    expect(inLane(after, COD)).toHaveLength(17);
  });

  it('keeps a text-only square and never draws its twin', () => {
    const legacy: SquareItem = { text: 'RL ITEM 01' }; // same text as rl-01, different case
    const result = reconcileCardSet({
      current: [legacy], pool: POOL, slots: 24, mix: mix([RL, 1], [COD, 0]), pinnedIds: [], rng: rng(),
    });
    expect(result.set[0]).toBe(legacy);
    expect(result.set).toHaveLength(24);
    expect(ids(result.set)).not.toContain('rl-01');
  });

  it('reports the shortfall when the library is too small', () => {
    const result = reconcileCardSet({
      current: [], pool: lane('rl', RL, 19), slots: 24, mix: mix([RL, 1]), pinnedIds: [], rng: rng(),
    });
    expect(result.set).toHaveLength(19);
    expect(result.shortBy).toBe(5);
  });

  it('is deterministic for a seed', () => {
    const a = reconcileCardSet({ current: [], pool: POOL, slots: 24, mix: mix([RL, 7], [COD, 17]), pinnedIds: [], rng: rng('x') });
    const b = reconcileCardSet({ current: [], pool: POOL, slots: 24, mix: mix([RL, 7], [COD, 17]), pinnedIds: [], rng: rng('x') });
    expect(ids(a.set)).toEqual(ids(b.set));
  });

  it('a rebuild with nothing changed changes nothing', () => {
    const before = card717();
    const after = reconcileCardSet({
      current: before, pool: POOL, slots: 24, mix: mix([RL, 7], [COD, 17]), pinnedIds: [], rng: rng('different'),
    }).set;
    expect(sameSet(before, after)).toBe(true);
  });
});

describe('matchCardItems', () => {
  it('matches by library id first, then by trimmed case-insensitive text', () => {
    const items: SquareItem[] = [
      { text: 'Whatever It Was Called', libraryItemId: 'cod-02' },
      { text: '  RL ITEM 05 ' },
      { text: 'Not In The Library' },
      { text: 'FREE', isFreeSpace: true },
    ];
    const { squares, unmatched } = matchCardItems(items, POOL);
    expect(squares).toEqual([
      { text: 'Whatever It Was Called', libraryItemId: 'cod-02', gameTagId: COD },
      { text: 'RL ITEM 05', libraryItemId: 'rl-05', gameTagId: RL },
      { text: 'Not In The Library' },
    ]);
    expect(unmatched).toBe(1);
  });

  it('never links two squares to one library item', () => {
    const { squares } = matchCardItems([{ text: 'rl item 01' }, { text: 'RL item 01' }], POOL);
    expect(squares[0].libraryItemId).toBe('rl-01');
    expect(squares[1].libraryItemId).toBeUndefined();
  });
});

describe('buildLegend / itemsForSave', () => {
  it('lists each game on the card once, in order of first appearance', () => {
    const set: SquareItem[] = [
      { text: 'a', libraryItemId: 'cod-01', gameTagId: COD },
      { text: 'b', libraryItemId: 'ng-01' },
      { text: 'c', libraryItemId: 'rl-01', gameTagId: RL },
      { text: 'd', libraryItemId: 'cod-02', gameTagId: COD },
    ];
    expect(buildLegend(set, TAGS)).toEqual([
      { gameTagId: COD, name: 'Call of Duty', color: 'orange', icon: 'crosshair' },
      { gameTagId: RL, name: 'Rocket League', color: 'sky', icon: 'flame' },
    ]);
  });

  it('leaves out a game whose tag is gone', () => {
    expect(buildLegend([{ text: 'x', gameTagId: 'deleted' }], TAGS)).toEqual([]);
  });

  it('saves text and the library link only', () => {
    expect(itemsForSave([
      { text: 'a', libraryItemId: 'rl-01', gameTagId: RL, originalIndex: 3 },
      { text: 'b' },
    ])).toEqual([
      { text: 'a', libraryItemId: 'rl-01', gameTagId: RL },
      { text: 'b' },
    ]);
  });
});
