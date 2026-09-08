import { describe, it, expect } from 'vitest';
import { generateCallList } from '../call-list';

describe('generateCallList', () => {
  it('is a permutation of every pool index', () => {
    const list = generateCallList(25, 'seed-1');
    expect(list).toHaveLength(25);
    expect([...list].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i));
  });

  it('is deterministic for the same seed', () => {
    expect(generateCallList(25, 'seed-1')).toEqual(generateCallList(25, 'seed-1'));
  });

  it('differs between seeds', () => {
    expect(generateCallList(25, 'seed-1')).not.toEqual(generateCallList(25, 'seed-2'));
  });

  it('skips excluded indices', () => {
    const list = generateCallList(25, 'seed-1', new Set([12]));
    expect(list).toHaveLength(24);
    expect(list).not.toContain(12);
  });
});
