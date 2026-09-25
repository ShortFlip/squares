import { Bomb, CarFront, Crosshair, Flame, Gamepad2, Skull, Swords, Target, type LucideIcon } from 'lucide-react';
import type { GameColorKey, GameIconKey } from '@/types/library';

/**
 * The colour each game colour key resolves to: the game marker icon on the
 * board, the legend chips and the library's glyphs.
 *
 * Settled 2026-09-24 (DESIGN.md Part 2 Rulings). Two rules, both measured on
 * the real pixels rather than the tokens:
 * - At least 3:1 against the Latte square (~L0.99), so the 16px marker still
 *   reads on the light theme, and 3:1 on the bare Latte ground (L0.96) too,
 *   except sky at 2.9:1 (the marker never sits on bare ground). Every value
 *   clears 4:1 on the Midnight square. The first-pass values were bright
 *   enough for Midnight only (cyan was 1.7:1 on Latte, sky 2.2:1).
 * - Clear of the colours the board already uses for state: amber (marked,
 *   hue 70), gold (win, ~88), emerald (best line, ~152-162) and violet (free
 *   space, 278). Orange is the nearest to amber, so it is darker and redder
 *   than amber (0.145 apart in OKLab, was 0.097) and cannot pass for a mark.
 *   Rose sits by --destructive (hue 13), which never appears on the board.
 *
 * The DB stores the key, never this string, so retuning is a code change only.
 */
export const GAME_COLORS: Record<GameColorKey, string> = {
  sky: 'oklch(0.64 0.15 240)',
  cyan: 'oklch(0.61 0.11 200)',
  rose: 'oklch(0.62 0.22 8)',
  orange: 'oklch(0.66 0.19 38)',
  pink: 'oklch(0.66 0.21 345)',
};

/**
 * The corner marker for each game icon key. Lookalike glyphs only (a car for
 * Rocket League, a crosshair for Call of Duty): real game logos are
 * trademarked art and the repo is public.
 */
export const GAME_ICONS: Record<GameIconKey, LucideIcon> = {
  flame: Flame,
  crosshair: Crosshair,
  // The front view, not lucide's side-view Car: at the 16px board marker the
  // side view is a thin strip that reads as a van; the front view fills the
  // square and reads as a car head-on, which is how Rocket League shows one.
  car: CarFront,
  target: Target,
  swords: Swords,
  gamepad: Gamepad2,
  // Added 2026-09-24 so a shooter or a party game has an obvious pick too.
  // Keys are plain text in tags.icon, so a new key needs no migration.
  skull: Skull,
  bomb: Bomb,
};

// Picker order. Derived from the records rather than listed again so a key
// added to the type (and therefore to the Record) can never be missing from a
// picker. Object key order is insertion order, so this order is stable.
export const GAME_COLOR_KEYS = Object.keys(GAME_COLORS) as GameColorKey[];
export const GAME_ICON_KEYS = Object.keys(GAME_ICONS) as GameIconKey[];

/** Narrow a `tags.color` column (plain text in the DB) to a known key. */
export function isGameColorKey(value: unknown): value is GameColorKey {
  return typeof value === 'string' && Object.hasOwn(GAME_COLORS, value);
}

/** Narrow a `tags.icon` column (plain text in the DB) to a known key. */
export function isGameIconKey(value: unknown): value is GameIconKey {
  return typeof value === 'string' && Object.hasOwn(GAME_ICONS, value);
}
