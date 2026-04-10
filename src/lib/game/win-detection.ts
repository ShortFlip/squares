import type { WinPattern } from '@/types/game';

/**
 * Check all enabled win patterns against the player's marks.
 * Returns the first matching pattern, or null if no win yet.
 *
 * @param marks       - set of marked grid indices (0 to boardSize²-1)
 * @param boardSize   - 3 through 6
 * @param patterns    - which win conditions are enabled for this room
 * @param freeSpace   - if true, the center square is always treated as marked
 */
export function checkWin(
  marks: Set<number>,
  boardSize: number,
  patterns: WinPattern[],
  freeSpace: boolean,
): WinPattern | null {
  // Build the effective mark set — include center auto-mark if freeSpace is on
  const effective = new Set(marks);
  if (freeSpace) {
    effective.add(Math.floor((boardSize * boardSize) / 2));
  }

  for (const pattern of patterns) {
    if (matchesPattern(effective, boardSize, pattern)) return pattern;
  }
  return null;
}

function matchesPattern(marks: Set<number>, size: number, pattern: WinPattern): boolean {
  switch (pattern) {
    case 'row':         return checkRows(marks, size);
    case 'column':      return checkColumns(marks, size);
    case 'diagonal':    return checkDiagonals(marks, size);
    case 'four_corners': return checkFourCorners(marks, size);
    case 'blackout':    return marks.size === size * size;
    default:            return false;
  }
}

function checkRows(marks: Set<number>, size: number): boolean {
  for (let row = 0; row < size; row++) {
    if (Array.from({ length: size }, (_, col) => row * size + col).every(i => marks.has(i))) {
      return true;
    }
  }
  return false;
}

function checkColumns(marks: Set<number>, size: number): boolean {
  for (let col = 0; col < size; col++) {
    if (Array.from({ length: size }, (_, row) => row * size + col).every(i => marks.has(i))) {
      return true;
    }
  }
  return false;
}

function checkDiagonals(marks: Set<number>, size: number): boolean {
  // Top-left → bottom-right
  const tlbr = Array.from({ length: size }, (_, i) => i * size + i).every(i => marks.has(i));
  if (tlbr) return true;
  // Top-right → bottom-left
  return Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)).every(i => marks.has(i));
}

function checkFourCorners(marks: Set<number>, size: number): boolean {
  const total = size * size;
  return marks.has(0) && marks.has(size - 1) && marks.has(total - size) && marks.has(total - 1);
}
