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
    card = fisherYates(indexed, rng).slice(0, total);
  } else {
    // Column-locked: partition items into boardSize groups and shuffle within
    // each group. This keeps items in their "home" column across rounds —
    // good for themed boards (e.g. column 1 = movies, column 2 = sports).
    const groupSize = Math.ceil(indexed.length / boardSize);
    const columns = Array.from({ length: boardSize }, (_, col) => {
      const partition = indexed.slice(col * groupSize, (col + 1) * groupSize);
      return fisherYates(partition, rng);
    });

    card = [];
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        card.push(columns[col][row] ?? { text: '' });
      }
    }
    card = card.slice(0, total);
  }

  if (freeSpace) {
    card[centerIndex] = { text: 'FREE', isFreeSpace: true };
  }

  return card;
}
