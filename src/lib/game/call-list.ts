import { fisherYates } from './shuffle';
import { seededRng } from './seed-rng';

/**
 * Generate a randomized call order for all items in a template.
 * Uses a separate seed prefix ('calls:') so the call order is independent
 * from card generation even if the same game seed is reused.
 *
 * Returns an array of item indices in the order they should be called.
 * e.g. [14, 3, 22, 7, ...] for a 25-item pool.
 */
export function generateCallList(itemCount: number, gameSeed: string): number[] {
  const rng = seededRng(`calls:${gameSeed}`);
  const indices = Array.from({ length: itemCount }, (_, i) => i);
  return fisherYates(indices, rng);
}
