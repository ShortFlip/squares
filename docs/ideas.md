# Ideas

Parked features — not planned, not promised. Pick one up by turning it into a plan in `docs/plans/`.

## Announce wins in Discord

*Added 2026-09-25.* When someone gets bingo, post it to a chosen Discord channel.

- **Discord side:** channel → Settings → Integrations → Webhooks → New Webhook. No bot, no OAuth.
- **Secret:** store the URL as GitHub repo secret `DISCORD_WEBHOOK_URL`, passed to the Worker with `--var` on the master deploy (same path as the keepalive vars). Never `NEXT_PUBLIC_` — that ships the URL to every tab and anyone could post with it.
- **Route:** a Worker route `/api/announce-win` holds the secret and posts to Discord.
- **Trigger:** the winner's own tab calls the route where it already broadcasts `bingo_confirmed`, so each win (1st and 2nd) posts exactly once.
- **Message:** e.g. `🏆 **Name** got BINGO — Row 3 · Round 2 · Room ABC123`; optionally the winning squares or a history link.
- **Rejected:** a Supabase database webhook on the win row — no app code, but harder to debug and depends on the project being awake.
- **Known gaps:** a tab dropping at the instant of the win misses the post; the route is unauthenticated, so anyone with the site URL could fake a win (same honor system as decision 0002).
- **Size:** about an hour, most of it the deploy secret.
