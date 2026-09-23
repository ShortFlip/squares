import { describe, it, expect, vi } from 'vitest';
import { withRetry, type Attempt } from '../retry';

const NO_WAIT = [0, 0, 0];

describe('withRetry', () => {
  it('returns the first success without retrying', async () => {
    const attempt = vi.fn(async (): Promise<Attempt<number>> => ({ ok: true, value: 7 }));
    const onFirstFailure = vi.fn();
    expect(await withRetry(attempt, NO_WAIT, onFirstFailure)).toEqual({ ok: true, value: 7 });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(onFirstFailure).not.toHaveBeenCalled();
  });

  it('retries until success and warns exactly once', async () => {
    let calls = 0;
    const onFirstFailure = vi.fn();
    const result = await withRetry(async (): Promise<Attempt<string>> => {
      calls++;
      return calls < 3 ? { ok: false } : { ok: true, value: 'row' };
    }, NO_WAIT, onFirstFailure);
    expect(result).toEqual({ ok: true, value: 'row' });
    expect(calls).toBe(3);
    expect(onFirstFailure).toHaveBeenCalledTimes(1);
  });

  it('gives up after the last delay and treats a throw as a failure', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const attempt = vi.fn(async (): Promise<Attempt<null>> => {
      throw new Error('offline');
    });
    expect(await withRetry(attempt, NO_WAIT)).toEqual({ ok: false });
    // One initial try plus one per delay.
    expect(attempt).toHaveBeenCalledTimes(NO_WAIT.length + 1);
    errors.mockRestore();
  });
});
