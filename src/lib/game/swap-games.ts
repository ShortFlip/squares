import { fisherYates } from './shuffle';
import type { SquareItem } from '@/types/card';

/**
 * Mid-round game swap: the night moved on from one game (Rocket League) to
 * another (Modern Warfare), and the squares still tied to the old game can
 * never be hit. These helpers replace them in place. Pure: no store, no
 * Supabase, so every rule here is covered by Vitest.
 */

/** Two ways the library decides "same item": its id, or trimmed case-insensitive text. */
function itemKeys(item: SquareItem): string[] {
  const keys: string[] = [];
  if (item.libraryItemId) keys.push(`id:${item.libraryItemId}`);
  const text = (item.text ?? '').trim().toLowerCase();
  if (text) keys.push(`text:${text}`);
  return keys;
}

/**
 * Every game with at least one real square across the round's cards, in the
 * order first seen. The FREE square and squares with no game are ignored, so
 * a legacy card with no games yields [] and the swap control never shows.
 */
export function gamesOnCards(cards: readonly (readonly SquareItem[])[]): string[] {
  const seen: string[] = [];
  for (const card of cards) {
    for (const item of card) {
      if (item.isFreeSpace || !item.gameTagId) continue;
      if (!seen.includes(item.gameTagId)) seen.push(item.gameTagId);
    }
  }
  return seen;
}

export interface SwapInput {
  card: readonly SquareItem[];
  /** Grid indexes this player has marked. Marks are positions, so an in-place swap keeps them valid. */
  marks: readonly number[];
  /** Everything the swap may draw from. Items of other games are ignored here. */
  pool: readonly SquareItem[];
  dropGameTagId: string;
  targetGameTagId: string;
  rng: () => number;
}

export interface SwapResult {
  card: SquareItem[];
  /** Squares that now hold a target-game item. */
  swapped: number;
  /** Dropped-game squares left as they were because the target game ran out. */
  skipped: number;
}

/**
 * Replace every unmarked square of `dropGameTagId` with a target-game item
 * that is not already on this card.
 *
 * Why unmarked only: a marked square already counts toward a line; changing
 * its text under the player would rewrite history. Why in place: marks and
 * win detection are index-based, so keeping every other square's position
 * keeps the player's progress exactly as it was.
 */
export function swapGameSquares({
  card,
  marks,
  pool,
  dropGameTagId,
  targetGameTagId,
  rng,
}: SwapInput): SwapResult {
  const marked = new Set(marks);
  const next = card.map((item) => ({ ...item }));

  // Keys of what is already on the card, so a swapped-in item never repeats one.
  const taken = new Set(card.flatMap(itemKeys));

  // Candidate order is the random part; the pool's own order must not decide
  // which Modern Warfare items everyone gets.
  const candidates = fisherYates(
    pool.filter(
      (item) =>
        !item.isFreeSpace &&
        item.gameTagId === targetGameTagId &&
        (item.text?.trim() || item.imageUrl),
    ),
    rng,
  );

  let swapped = 0;
  let skipped = 0;
  let cursor = 0;

  for (let index = 0; index < next.length; index++) {
    const square = next[index];
    if (square.isFreeSpace || marked.has(index) || square.gameTagId !== dropGameTagId) continue;

    // Next candidate not already on the card (including ones just swapped in,
    // and duplicates between the template pool and the library).
    let pick: SquareItem | undefined;
    while (cursor < candidates.length) {
      const candidate = candidates[cursor++];
      const keys = itemKeys(candidate);
      if (keys.some((key) => taken.has(key))) continue;
      pick = candidate;
      break;
    }

    if (!pick) {
      skipped++;
      continue;
    }
    for (const key of itemKeys(pick)) taken.add(key);
    next[index] = { ...pick };
    swapped++;
  }

  return { card: next, swapped, skipped };
}
