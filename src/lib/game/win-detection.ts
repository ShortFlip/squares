import type { WinPattern } from '@/types/game';
import type { SquareItem } from '@/types/card';

/**
 * Where the FREE square sits on a card, or null when it has none.
 *
 * The card itself is the source of truth: 5×5 and larger keep FREE at the
 * centre, but smaller boards place it at a seeded random square (see
 * `generateCard`), so nothing downstream may assume `floor(N²/2)`. Old stored
 * cards carry the flag at the centre and resolve exactly as before.
 */
export function freeIndexOf(
  card: readonly (SquareItem | null | undefined)[] | null | undefined,
): number | null {
  if (!card) return null;
  const index = card.findIndex((item) => item?.isFreeSpace === true);
  return index === -1 ? null : index;
}

/**
 * Check all enabled win patterns against the player's marks.
 * Returns the first matching pattern, or null if no win yet.
 *
 * @param marks       - set of marked grid indices (0 to boardSize²-1)
 * @param boardSize   - 3 through 6
 * @param patterns    - which win conditions are enabled for this room
 * @param freeIndex   - grid index of the FREE square (always treated as marked),
 *                      or null for no free space. Read it off the card with
 *                      `freeIndexOf` — it is not always the centre.
 */
export function checkWin(
  marks: Set<number>,
  boardSize: number,
  patterns: WinPattern[],
  freeIndex: number | null,
): WinPattern | null {
  // Build the effective mark set — FREE counts as marked wherever it landed
  const effective = new Set(marks);
  if (freeIndex !== null) effective.add(freeIndex);

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

// ── Best line ──────────────────────────────────────────────────────────────

export interface BestLine {
  kind: 'row' | 'column' | 'diagonal';
  /** Row/column number, or 0/1 for the two diagonals (0 = top-left → bottom-right). */
  index: number;
  /** How many cells of this line are still unmarked. 0 means it is complete. */
  remaining: number;
  /** Every grid index on this line, in order — marked or not. */
  cells: number[];
}

/**
 * The line this player is closest to completing.
 *
 * "Closest" is fewest unmarked cells, not most marks — they are the same on a
 * square grid but the remaining count is what the UI actually says out loud
 * ("two away"), so that is what we compute and return.
 *
 * Free space counts as marked, exactly as `checkWin` treats it. Without that,
 * every line through FREE would read one further away than it plays. The index
 * comes from the card (`freeIndexOf`) because small boards place FREE at random.
 *
 * Ties break row → column → diagonal, lowest index first, so the label does
 * not flicker between two equally close lines as marks land.
 */
export function bestLine(
  marks: Set<number>,
  boardSize: number,
  freeIndex: number | null,
): BestLine | null {
  if (!Number.isInteger(boardSize) || boardSize < 2) return null;

  const effective = new Set(marks);
  if (freeIndex !== null) effective.add(freeIndex);

  const candidates: BestLine[] = [];

  for (let row = 0; row < boardSize; row++) {
    const cells = Array.from({ length: boardSize }, (_, col) => row * boardSize + col);
    candidates.push({ kind: 'row', index: row, remaining: countRemaining(cells, effective), cells });
  }
  for (let col = 0; col < boardSize; col++) {
    const cells = Array.from({ length: boardSize }, (_, row) => row * boardSize + col);
    candidates.push({ kind: 'column', index: col, remaining: countRemaining(cells, effective), cells });
  }
  const tlbr = Array.from({ length: boardSize }, (_, i) => i * boardSize + i);
  const trbl = Array.from({ length: boardSize }, (_, i) => i * boardSize + (boardSize - 1 - i));
  candidates.push({ kind: 'diagonal', index: 0, remaining: countRemaining(tlbr, effective), cells: tlbr });
  candidates.push({ kind: 'diagonal', index: 1, remaining: countRemaining(trbl, effective), cells: trbl });

  // Candidates are already in tie-break order, so a strict `<` keeps the first.
  let best = candidates[0];
  for (const line of candidates) {
    if (line.remaining < best.remaining) best = line;
  }
  return best;
}

function countRemaining(cells: number[], marks: Set<number>): number {
  return cells.reduce((n, cell) => (marks.has(cell) ? n : n + 1), 0);
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];

/** "three" for 3, "12" for 12 — spelled out only where a player would say it. */
function distanceWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "Row 3", "Column 2", "Diagonal" — the diagonals are never numbered aloud. */
function lineName(kind: BestLine['kind'], index: number): string {
  if (kind === 'diagonal') return 'Diagonal';
  const label = kind === 'row' ? 'Row' : 'Column';
  return `${label} ${index + 1}`;
}

/**
 * The one-line status under a player's name.
 *
 * A line that is `boardSize - 1` away has nothing on it but the free space (or
 * a single stray mark), which is not news — that reads as `No line yet` rather
 * than "four away", so the label only starts talking once someone is actually
 * closing in.
 */
export function bestLineLabel(
  line: BestLine | null,
  won?: { pattern: string },
): string {
  if (won) {
    // A confirmed win: prefer the completed line we found, fall back to the
    // pattern the server broadcast when the marks have not arrived yet.
    const useLine = line && line.remaining === 0;
    const name = useLine
      ? lineName(line.kind, line.index).toLowerCase()
      : String(won.pattern).replace(/_/g, ' ');
    return `Bingo — ${name}`;
  }

  if (!line) return 'No line yet';

  const boardSize = line.cells.length;
  if (line.remaining >= boardSize - 1) return 'No line yet';
  if (line.remaining === 0) return `Bingo — ${lineName(line.kind, line.index).toLowerCase()}`;

  return `${lineName(line.kind, line.index)} — ${distanceWord(line.remaining)} away`;
}
