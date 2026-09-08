import { describe, it, expect } from 'vitest';
import { checkWin, bestLine, bestLineLabel } from '../win-detection';
import type { WinPattern } from '@/types/game';

const ALL: WinPattern[] = ['row', 'column', 'diagonal', 'four_corners', 'blackout'];
const row = (r: number, size = 5) => Array.from({ length: size }, (_, c) => r * size + c);
const col = (c: number, size = 5) => Array.from({ length: size }, (_, r) => r * size + c);

describe('checkWin', () => {
  it('detects a full row', () => {
    expect(checkWin(new Set(row(1)), 5, ALL, false)).toBe('row');
  });

  it('detects a full column', () => {
    expect(checkWin(new Set(col(3)), 5, ALL, false)).toBe('column');
  });

  it('detects the top-left to bottom-right diagonal', () => {
    const d = [0, 6, 12, 18, 24];
    expect(checkWin(new Set(d), 5, ['diagonal'], false)).toBe('diagonal');
  });

  it('detects the top-right to bottom-left diagonal', () => {
    const d = [4, 8, 12, 16, 20];
    expect(checkWin(new Set(d), 5, ['diagonal'], false)).toBe('diagonal');
  });

  it('detects four corners', () => {
    expect(checkWin(new Set([0, 4, 20, 24]), 5, ['four_corners'], false)).toBe('four_corners');
  });

  it('detects a blackout', () => {
    const all = Array.from({ length: 25 }, (_, i) => i);
    expect(checkWin(new Set(all), 5, ['blackout'], false)).toBe('blackout');
  });

  it('counts the free space as marked', () => {
    // Middle row minus the center square: only a win when free space is on.
    const partial = row(2).filter((i) => i !== 12);
    expect(checkWin(new Set(partial), 5, ['row'], false)).toBeNull();
    expect(checkWin(new Set(partial), 5, ['row'], true)).toBe('row');
  });

  it('returns null when nothing matches', () => {
    expect(checkWin(new Set([0, 1, 7, 19]), 5, ALL, false)).toBeNull();
  });

  it('only reports patterns that are enabled for the room', () => {
    expect(checkWin(new Set(col(0)), 5, ['row'], false)).toBeNull();
  });
});

describe('bestLine', () => {
  it('returns null for an invalid board size', () => {
    expect(bestLine(new Set(), 0, false)).toBeNull();
    expect(bestLine(new Set(), 1, false)).toBeNull();
    expect(bestLine(new Set(), 5.5, false)).toBeNull();
  });

  it('finds the line with the fewest unmarked cells', () => {
    // Row 2 has four of five marks; nothing else has more than one.
    const line = bestLine(new Set([10, 11, 13, 14]), 5, false);
    expect(line).toMatchObject({ kind: 'row', index: 2, remaining: 1 });
    expect(line?.cells).toEqual([10, 11, 12, 13, 14]);
  });

  it('counts the free space as marked', () => {
    // Same four marks, but the free space fills the gap in row 2.
    const line = bestLine(new Set([10, 11, 13, 14]), 5, true);
    expect(line?.remaining).toBe(0);
  });

  it('breaks ties row before column before diagonal, lowest index first', () => {
    // Cell 0 sits on row 0, column 0 and the top-left diagonal — all one mark.
    const line = bestLine(new Set([0]), 5, false);
    expect(line).toMatchObject({ kind: 'row', index: 0 });

    // Columns 1 and 3 are both three marks deep; the lower index wins.
    const cols = bestLine(new Set([1, 6, 11, 3, 8, 13]), 5, false);
    expect(cols).toMatchObject({ kind: 'column', index: 1 });
  });

  it('reports the diagonals with index 0 (TL-BR) and 1 (TR-BL)', () => {
    const trbl = bestLine(new Set([4, 8, 16, 20]), 5, false);
    expect(trbl).toMatchObject({ kind: 'diagonal', index: 1, remaining: 1 });
  });
});

describe('bestLineLabel', () => {
  it('spells out how far away a line is', () => {
    expect(bestLineLabel(bestLine(new Set([10, 11, 13, 14]), 5, false)))
      .toBe('Row 3 — one away');
    expect(bestLineLabel(bestLine(new Set([1, 6, 11]), 5, false)))
      .toBe('Column 2 — two away');
    expect(bestLineLabel(bestLine(new Set([0, 6]), 5, false)))
      .toBe('Diagonal — three away');
  });

  it('stays quiet until a line is actually close', () => {
    expect(bestLineLabel(null)).toBe('No line yet');
    // Nothing but the free space: every line is four away on a 5x5.
    expect(bestLineLabel(bestLine(new Set(), 5, true))).toBe('No line yet');
    expect(bestLineLabel(bestLine(new Set([0]), 5, false))).toBe('No line yet');
  });

  it('uses digits past five', () => {
    // 8x8 board, two marks on row 0: six away, past the word list.
    expect(bestLineLabel(bestLine(new Set([0, 1]), 8, false))).toBe('Row 1 — 6 away');
    // One mark is seven away on an 8x8 — boardSize - 1, so still not news.
    expect(bestLineLabel(bestLine(new Set([0]), 8, false))).toBe('No line yet');
  });

  it('announces a win with the completed line', () => {
    const line = bestLine(new Set([1, 6, 11, 16, 21]), 5, false);
    expect(bestLineLabel(line, { pattern: 'column' })).toBe('Bingo — column 2');
    expect(bestLineLabel(line)).toBe('Bingo — column 2');
  });

  it('falls back to the broadcast pattern when the marks have not arrived', () => {
    expect(bestLineLabel(null, { pattern: 'four_corners' })).toBe('Bingo — four corners');
  });
});
