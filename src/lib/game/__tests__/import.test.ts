import { describe, it, expect } from 'vitest';
import { parseImport } from '../import';

describe('parseImport', () => {
  it('splits on newlines', () => {
    expect(parseImport('Alpha\nBravo\nCharlie')).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('falls back to commas when the paste is a single line', () => {
    expect(parseImport('Alpha, Bravo, Charlie')).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('keeps commas inside lines when newlines are present', () => {
    // Newlines win: a comma inside a line is punctuation, not a separator.
    expect(parseImport('Well, actually\nHold my beer')).toEqual([
      'Well, actually',
      'Hold my beer',
    ]);
  });

  it('trims whitespace and drops empty lines', () => {
    expect(parseImport('  Alpha  \n\n\t\n  Bravo\n')).toEqual(['Alpha', 'Bravo']);
  });

  it('dedupes case-insensitively and keeps the first spelling', () => {
    expect(parseImport('Alpha\nALPHA\nalpha\nBravo')).toEqual(['Alpha', 'Bravo']);
  });

  it('dedupes within a comma-separated single line too', () => {
    expect(parseImport('Alpha, alpha, Bravo')).toEqual(['Alpha', 'Bravo']);
  });

  it('returns an empty array for empty input', () => {
    expect(parseImport('')).toEqual([]);
    expect(parseImport('   \n  \n')).toEqual([]);
  });
});
