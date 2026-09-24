import { describe, expect, it } from 'vitest';

// Deliberately failing: proves the CI test gate goes red. Reverted before merge.
describe('ci gate canary', () => {
  it('fails on purpose', () => {
    expect(1).toBe(2);
  });
});
