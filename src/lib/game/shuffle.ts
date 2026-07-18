import { seededRng } from './seed-rng';
import type { SquareItem } from '@/types/card';

/**
 * Fisher-Yates shuffle using a provided RNG.
 * Returns a new array — does not mutate the input.
 */
export function fisherYates<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate a player's shuffled card grid.
 *
 * Combines the game seed with the player ID so every player gets a
 * unique shuffle from the same game. The result is a flat array of
 * boardSize*boardSize items in row-major order.
 *
 * @param items       - full item pool from the card template (N*N items)
 * @param seed        - game seed (changes each round, same for all players)
 * @param playerId    - player UUID (makes each player's card unique)
 * @param boardSize   - 3 through 6
 * @param shuffleMode - 'full' = Fisher-Yates on whole pool;
 *                      'column' = shuffle within boardSize partitions
 * @param freeSpace   - if true, replace center item with FREE sentinel
 */
export function generateCard(
  items: SquareItem[],
  seed: string,
  playerId: string,
  boardSize: number,
  shuffleMode: 'full' | 'column',
  freeSpace: boolean,
): SquareItem[] {
  const rng = seededRng(`${seed}:${playerId}`);
  const total = boardSize * boardSize;
  const centerIndex = Math.floor(total / 2);

  // Tag each item with its original pool index BEFORE shuffling.
  // This lets win verification check whether a marked square's item was actually called.
  const indexed: SquareItem[] = items.map((item, i) => ({ ...item, originalIndex: i }));

  let card: SquareItem[];

  if (shuffleMode === 'full') {
    // Filter empty slots from the pool before shuffling. This handles both:
    // - New templates: center slot (index 12 for 5×5) is empty and intentionally never filled
    // - Legacy templates (pre-April-10 fix): the empty slot ended up at the last index (e.g. 24)
    //   rather than at centerIndex, so a position-based exclusion would silently eat a real item.
    // Filtering by content is position-agnostic and correct in both cases.
    const pool = indexed.filter((item) => item.text?.trim() || item.imageUrl);
    card = fisherYates(pool, rng).slice(0, freeSpace ? total - 1 : total);

    if (freeSpace) {
      // card has (total-1) items — splice FREE into the center position
      card = [
        ...card.slice(0, centerIndex),
        { text: 'FREE', isFreeSpace: true },
        ...card.slice(centerIndex),
      ];
    }
  } else {
    // Column-locked: partition items into boardSize groups and shuffle within
    // each group. This keeps items in their "home" column across rounds —
    // good for themed boards (e.g. column 1 = movies, column 2 = sports).
    //
    // Partitions are sized by NEED, not a uniform ceil split: each column needs
    // boardSize items, except the center column when freeSpace is on (FREE
    // occupies one of its rows). A uniform split of an (N²-1)-item pool leaves
    // the last column one short, which used to render a blank playable square.
    const centerCol = centerIndex % boardSize;
    const needs = Array.from({ length: boardSize }, (_, col) =>
      boardSize - (freeSpace && col === centerCol ? 1 : 0),
    );
    const totalNeed = needs.reduce((a, b) => a + b, 0);

    // Spread any surplus pool items round-robin so oversized pools still add
    // round-to-round variety in every column.
    const sizes = [...needs];
    let extra = indexed.length - totalNeed;
    for (let col = 0; extra > 0; col = (col + 1) % boardSize, extra--) sizes[col]++;

    const columns: SquareItem[][] = [];
    let offset = 0;
    for (let col = 0; col < boardSize; col++) {
      columns.push(fisherYates(indexed.slice(offset, offset + sizes[col]), rng));
      offset += sizes[col];
    }

    card = [];
    const pointers = Array(boardSize).fill(0);
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (freeSpace && row * boardSize + col === centerIndex) {
          card.push({ text: 'FREE', isFreeSpace: true });
        } else {
          // Blank fallback only happens if the template genuinely has too few items
          card.push(columns[col][pointers[col]++] ?? { text: '' });
        }
      }
    }
  }

  return card;
}
