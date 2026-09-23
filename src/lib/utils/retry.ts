/**
 * Short backoff for a single Supabase read or write that must not be given up
 * on after one blip. Total wait is ~15 s: long enough to ride out a Wi-Fi hiccup
 * or a reconnecting socket, short enough that "try refreshing" still arrives
 * while the player is looking at the screen.
 */
export const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

export type Attempt<T> = { ok: true; value: T } | { ok: false };

/**
 * Run `attempt` until it reports ok, sleeping through `delays` between tries.
 * Returns the last result, so the caller decides what "gave up" means — for a
 * rejoin that is "never write", for a win it is "tell the player".
 *
 * `onFirstFailure` fires once, so a caller can warn without a toast per retry.
 */
export async function withRetry<T>(
  attempt: () => Promise<Attempt<T>>,
  delays: readonly number[] = RETRY_DELAYS_MS,
  onFirstFailure?: () => void,
): Promise<Attempt<T>> {
  // supabase-js reports failures as `{ error }`, but a fetch can still throw
  // (offline, aborted); a throw is just another failed attempt here.
  const run = async (): Promise<Attempt<T>> => {
    try {
      return await attempt();
    } catch (err) {
      console.error('Retryable call threw:', err);
      return { ok: false };
    }
  };
  let result = await run();
  for (let i = 0; !result.ok && i < delays.length; i++) {
    if (i === 0) onFirstFailure?.();
    await new Promise((resolve) => setTimeout(resolve, delays[i]));
    result = await run();
  }
  return result;
}
