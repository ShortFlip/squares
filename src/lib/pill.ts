/**
 * The pill scale: every mono uppercase chip in the app — `LIVE`, `YOUR BOARD`,
 * `1ST` / `2ND`, `1ST — NAME`, `2ND — OPEN`, `SYNCING`, the History placing —
 * built from one place so the whole scale moves together, never one pill at a
 * time (DESIGN.md Part 2, type scale; the 13px floor ruled 2026-09-23).
 *
 * 13px, mono 700, uppercase. Two things are tuned against the jump from 10–11px:
 * - Tracking drops from 0.10em to 0.04em. JetBrains Mono already spaces its
 *   capitals with wide sidebearings; at 13px the old tracking read as shouting
 *   and cost `YOUR BOARD` another ~8px in a name row that has none to spare.
 * - `leading-none` with 3px of vertical padding keeps a pill 19px tall (21px
 *   with a border) — the height the 10px pills already had — so raising the
 *   type does not raise the row it sits in.
 */
export const PILL_TYPE = 'font-mono text-[13px] font-bold uppercase leading-none tracking-[0.04em]';

/** A pill's box: the type above plus the shape. Colour and border stay with each caller. */
export const PILL = `${PILL_TYPE} inline-flex items-center whitespace-nowrap rounded-full px-2 py-[3px]`;
