import { textKey } from '@/lib/library/card-draft';
import type { SquareItem } from '@/types/card';

/*
 * Item heat: how often a library item actually gets marked once it lands on a
 * card. Built from past rounds' game_players rows (card_data + marks), so there
 * is no table of its own. The point is card building: an item marked 90% of the
 * time makes lines easy, one marked 5% of the time is a dead square, and a card
 * full of dead squares is why the second bingo never comes.
 */

/** One game_players row from a round that counts: the card as dealt and its marks. */
export interface HeatRow {
  /** game_players.card_data — typed Json in the DB, so it is checked here, not trusted. */
  cardData: unknown;
  /** game_players.marks — grid indexes. */
  marks: unknown;
}

export interface ItemHeat {
  marked: number;
  appearances: number;
}

/** item id → heat. An item that never appeared has no entry (no rate, not 0%). */
export type HeatMap = Record<string, ItemHeat>;

interface HeatItem {
  id: string;
  text: string;
}

function isSquare(value: unknown): value is SquareItem {
  return typeof value === 'object' && value !== null && typeof (value as SquareItem).text === 'string';
}

/**
 * Build a resolver from a square to a library item id. libraryItemId wins;
 * older rounds predate the library and only have text, so they fall back to
 * trimmed, lower-cased text (the same key the library dedupes on).
 */
function resolverFor(items: HeatItem[]): (square: SquareItem) => string | null {
  const ids = new Set(items.map((item) => item.id));
  const byText = new Map(items.map((item) => [textKey(item.text), item.id]));
  return (square) => {
    if (square.isFreeSpace) return null;
    if (square.libraryItemId && ids.has(square.libraryItemId)) return square.libraryItemId;
    return byText.get(textKey(square.text)) ?? null;
  };
}

/** Tally appearances and marks per item across every counted row. */
export function computeHeat(items: HeatItem[], rows: HeatRow[]): HeatMap {
  const resolve = resolverFor(items);
  const heat: HeatMap = {};
  for (const row of rows) {
    if (!Array.isArray(row.cardData)) continue;
    const marked = new Set(Array.isArray(row.marks) ? row.marks.filter((m): m is number => typeof m === 'number') : []);
    // One card can hold a text twice in a very old round; count each square,
    // since each one is a real chance to be marked.
    row.cardData.forEach((square, index) => {
      if (!isSquare(square)) return;
      const id = resolve(square);
      if (!id) return;
      const entry = (heat[id] ??= { marked: 0, appearances: 0 });
      entry.appearances += 1;
      if (marked.has(index)) entry.marked += 1;
    });
  }
  return heat;
}

/** marked ÷ appearances, or null when it has never appeared (unknown is not cold). */
export function hitRate(heat: ItemHeat | undefined): number | null {
  if (!heat || heat.appearances === 0) return null;
  return heat.marked / heat.appearances;
}

export interface CardHeat {
  /** Average hit rate of the squares that have data; null when none do. */
  rate: number | null;
  withData: number;
  /** Non-FREE squares on the card. */
  total: number;
}

/**
 * The drawn set's temperature: a plain average of per-item rates, so one item
 * seen 40 times does not drown out the rest. Squares with no history are left
 * out rather than counted as 0%, and reported so the number is not overstated.
 */
export function cardHeat(set: SquareItem[], items: HeatItem[], heat: HeatMap): CardHeat {
  const resolve = resolverFor(items);
  let sum = 0;
  let withData = 0;
  let total = 0;
  for (const square of set) {
    if (square.isFreeSpace) continue;
    total += 1;
    const id = resolve(square);
    const rate = id ? hitRate(heat[id]) : null;
    if (rate === null) continue;
    sum += rate;
    withData += 1;
  }
  return { rate: withData ? sum / withData : null, withData, total };
}
