import { describe, it, expect } from 'vitest';
import { checkWin } from '../win-detection';
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
