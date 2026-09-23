import type { SquareItem } from '@/types/card';

/** What the rejoin path needs to put a player back on the card they had. */
export interface RestoredCard {
  card: SquareItem[];
  boardSize: number;
  freeSpace: boolean;
  /** True when the card came from game_players.card_data rather than a regeneration. */
  fromDb: boolean;
}

/**
 * Pick the card a rejoining player should see: the one stored in
 * `game_players.card_data` when it is usable, otherwise a fresh regeneration.
 *
 * Why the stored card wins: regeneration shuffles the template's items as they
 * are NOW. The host can edit the template mid-night, and then seed + playerId
 * no longer reproduce the old layout, so the saved marks (grid indices) would
 * land on different squares. `card_data` is what the player was actually
 * marking, so it is the only safe source once it exists.
 *
 * Board size and free space are read off the stored card too, for the same
 * reason: win detection must walk the grid the player is looking at, not the
 * grid the edited template would produce.
 */
export function resolveRestoredCard(
  cardData: unknown,
  fallback: { boardSize: number; freeSpace: boolean },
  regenerate: () => SquareItem[],
): RestoredCard {
  if (Array.isArray(cardData) && cardData.length > 0) {
    const side = Math.round(Math.sqrt(cardData.length));
    // A non-square length means the row is corrupt or half-written; trusting
    // it would break every row/column check, so fall through to regeneration.
    if (side * side === cardData.length) {
      const card = cardData as SquareItem[];
      return {
        card,
        boardSize: side,
        freeSpace: card.some((item) => item?.isFreeSpace === true),
        fromDb: true,
      };
    }
  }
  return { card: regenerate(), ...fallback, fromDb: false };
}

/**
 * The round's start time for the store. The DB's `games.started_at` when we
 * have it, so a refresh mid-round keeps timing from the real start instead of
 * restarting the clock (which recorded impossibly fast bingo times).
 * Falls back to "now" only for a legacy payload that carries no timestamp.
 */
export function resolveGameStartedAt(
  startedAt: string | null | undefined,
  now: () => Date = () => new Date(),
): string {
  if (startedAt && !Number.isNaN(new Date(startedAt).getTime())) return startedAt;
  return now().toISOString();
}

/**
 * Milliseconds from round start to this bingo, or null when it can't be
 * trusted. `startedAt` is the DB's clock and `nowMs` is this browser's, so a
 * badly skewed PC clock can make the difference negative; a negative time
 * would become everyone's unbeatable "best time", so it is dropped instead.
 */
export function computeBingoTimeMs(startedAt: string | null, nowMs: number): number | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return null;
  const elapsed = nowMs - start;
  return elapsed >= 0 ? elapsed : null;
}
