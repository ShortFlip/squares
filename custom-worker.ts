/**
 * Worker entry point (wrangler.toml `main`).
 *
 * OpenNext generates `.open-next/worker.js` with a `fetch` handler only. This
 * wrapper re-uses that handler unchanged for every HTTP request and adds a
 * `scheduled` handler for the daily Cron Trigger that keeps Supabase awake.
 * Pattern: https://opennext.js.org/cloudflare/howtos/custom-worker
 *
 * The generated worker also exports DOQueueHandler, DOShardedTagCache and
 * BucketCachePurge. They are not re-exported: open-next.config.ts uses no
 * Durable Object queue or tag cache, so wrangler.toml binds none of them.
 * Re-export them here if that ever changes.
 */

// `.open-next/worker.js` only exists after `npm run cf:build`, but `tsc` and
// `next build`'s type check read this file before it does (CI type-checks
// first; a local tree may or may not hold a stale build). @ts-ignore is right
// for both states; @ts-expect-error would itself become an error whenever the
// file is present. Wrangler bundles it for real at deploy time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- generated at build time by @opennextjs/cloudflare
import nextWorker from './.open-next/worker.js';
import { pingSupabase } from './src/lib/keepalive';

/**
 * Plain-text vars set by `wrangler deploy --var` on the master deploy. They
 * are separate from the NEXT_PUBLIC_* values, which the Next build inlines
 * into its own bundle and this entry cannot read.
 */
interface KeepaliveEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

// Minimal local shapes of the Workers runtime types we touch, instead of
// adding @cloudflare/workers-types for three members.
interface ScheduledController {
  cron: string;
  scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Errors are deliberately not caught: a rejected waitUntil promise is what
 * marks the run failed in Cron Past Events, and the runtime already logs it as
 * an uncaught error (verified with `wrangler dev --test-scheduled`).
 */
async function keepSupabaseAwake(controller: ScheduledController, env: KeepaliveEnv) {
  const status = await pingSupabase({
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    // Wrapped rather than passed bare: the Workers runtime throws "Illegal
    // invocation" if its global fetch is ever called with a foreign `this`.
    fetchFn: (url, init) => fetch(url, init),
  });
  console.log(`Supabase keepalive OK (HTTP ${status}) for cron "${controller.cron}"`);
}

// Workers' module format requires the handlers as the default export, the one
// place outside Next pages/layouts where the named-exports rule can't apply.
const worker = {
  fetch: nextWorker.fetch,

  scheduled(controller: ScheduledController, env: KeepaliveEnv, ctx: ExecutionContext) {
    ctx.waitUntil(keepSupabaseAwake(controller, env));
  },
};

export default worker;
