import { describe, it, expect, vi, type Mock } from 'vitest';
import { pingSupabase, type KeepaliveFetch, type KeepaliveOptions } from '../keepalive';

const PROJECT_URL = 'https://example.supabase.co';
const ANON_KEY = 'anon-key-123';
const EXPECTED_PING_URL = `${PROJECT_URL}/rest/v1/players?select=id&limit=1`;

/** A fake fetch that answers every request with the given status and body. */
function fakeFetch(status: number, body = ''): Mock<KeepaliveFetch> {
  return vi.fn<KeepaliveFetch>(async () => new Response(body || null, { status }));
}

/** Ping with valid config unless a test overrides part of it. */
function ping(fetchFn: KeepaliveFetch, overrides: Partial<KeepaliveOptions> = {}) {
  return pingSupabase({ supabaseUrl: PROJECT_URL, anonKey: ANON_KEY, fetchFn, ...overrides });
}

describe('pingSupabase', () => {
  it('queries players with the anon key in both headers and returns the status', async () => {
    const fetchFn = fakeFetch(200, '[]');
    await expect(ping(fetchFn)).resolves.toBe(200);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(EXPECTED_PING_URL);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not double the slash when the stored URL ends with one', async () => {
    // Guards a dashboard-pasted URL like https://x.supabase.co/ turning into //rest.
    const fetchFn = fakeFetch(200);
    await ping(fetchFn, { supabaseUrl: `${PROJECT_URL}/` });
    expect(fetchFn.mock.calls[0][0]).toBe(EXPECTED_PING_URL);
  });

  it('throws with the status and body on a non-2xx so the Cron run shows as failed', async () => {
    // Guards the silent failure mode: a paused project answering 5xx while the
    // Cron invocation still reports success.
    await expect(ping(fakeFetch(540, 'Project paused'))).rejects.toThrow(
      /HTTP 540 — Project paused/,
    );
  });

  it('throws naming the missing vars without calling fetch', async () => {
    // Guards a deploy that forgot the --var flags: fail loudly, never ping `undefined/rest`.
    const fetchFn = fakeFetch(200);
    await expect(ping(fetchFn, { supabaseUrl: undefined, anonKey: undefined })).rejects.toThrow(
      /SUPABASE_URL and SUPABASE_ANON_KEY missing/,
    );
    await expect(ping(fetchFn, { anonKey: '' })).rejects.toThrow(/: SUPABASE_ANON_KEY missing/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('never puts the anon key in an error message', async () => {
    // The Cron log is visible in the dashboard; the key has no business there.
    const error = await ping(fakeFetch(401, 'Invalid API key')).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain(ANON_KEY);
  });

  it('aborts a request that hangs past the timeout', async () => {
    // Guards a wedged project holding the Cron invocation open instead of failing.
    const hangingFetch = vi.fn<KeepaliveFetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    await expect(ping(hangingFetch, { timeoutMs: 20 })).rejects.toThrow(/timed out|aborted/i);
  });
});
