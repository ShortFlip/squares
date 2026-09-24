import { Car, Crosshair, Flame, Gamepad2, Swords, Target, type LucideIcon } from 'lucide-react';
import type { GameColorKey, GameIconKey } from '@/types/library';

/**
 * The tint each game colour key resolves to.
 *
 * PROVISIONAL: Phase 4 renders variants on the real board (Midnight and Latte)
 * and Ryann picks the final values; they then go into DESIGN.md Part 2 Rulings.
 *
 * Why these hues: the board already gives meaning to amber (marked, oklch
 * 0.77 0.175 70), gold (win, hue ~88), emerald (best line, hue ~152–162) and
 * violet (free space / primary, hue 278). A game tint that sits near any of
 * them would read as a state rather than a game, so every hue here keeps at
 * least ~28° from all four. Rose sits near --destructive (hue 13), which never
 * appears on the board; Phase 4 should still check it does not read as an error.
 *
 * The DB stores the key, never this string, so retuning is a code change only.
 */
export const GAME_COLORS: Record<GameColorKey, string> = {
  sky: 'oklch(0.74 0.15 235)',
  cyan: 'oklch(0.80 0.13 205)',
  rose: 'oklch(0.68 0.20 12)',
  orange: 'oklch(0.72 0.19 42)',
  pink: 'oklch(0.72 0.20 345)',
};

/**
 * The corner icon for each game icon key. Lookalike glyphs only (a boost flame
 * for Rocket League, a crosshair for Call of Duty): real game logos are
 * trademarked art and the repo is public.
 */
export const GAME_ICONS: Record<GameIconKey, LucideIcon> = {
  flame: Flame,
  crosshair: Crosshair,
  car: Car,
  target: Target,
  swords: Swords,
  gamepad: Gamepad2,
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
