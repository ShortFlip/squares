import { slotsFor } from '@/lib/game/card-builder';
import { cardStyles, itemsForSave, textKey } from '@/lib/library/card-draft';
import type { CardStyles, SquareItem } from '@/types/card';
import type { CardMix, LegendEntry, Tag } from '@/types/library';

/*
 * Pure helpers behind hosting a card: Host This Card on /library, the Create
 * Room dialog and the landing's Saved Cards. No Supabase and no React, so all
 * of it is unit-tested in src/lib/library/__tests__/hosting.test.ts.
 *
 * Every room keeps a card_templates row behind rooms.template_id, because the
 * first round, New Round and reconnect all read the card from there (build
 * plan, pre-flight finding 1). A saved card is hosted by its own id; anything
 * else becomes a new row with saved = false first: a one-night copy that
 * History can still name and draw.
 */

/** What an unsaved card needs to become its night's card_templates row. */
export interface HostDraft {
  name: string;
  boardSize: number;
  freeSpace: boolean;
  /** Preset colours + preset id + legend, exactly as Save Card writes them. */
  styles: CardStyles;
  mix: CardMix | null;
  items: SquareItem[];
}

/** What Create Room hosts: a saved card by its id, or a draft inserted first as saved = false. */
export type HostCard = { kind: 'saved'; templateId: string } | { kind: 'draft'; draft: HostDraft };

/** The name a card without one is hosted and listed under. */
export const CUSTOM_CARD_NAME = 'Custom Card';

export function hostCardName(name: string): string {
  return name.trim() || CUSTOM_CARD_NAME;
}

/** The parts of the library's card draft that hosting reads (CardDraft satisfies it). */
export interface HostableDraft {
  templateId: string | null;
  name: string;
  boardSize: number;
  freeSpace: boolean;
  stylePreset: string;
  builtMix: CardMix;
  set: SquareItem[];
  poolIds: string[] | null;
  dirty: boolean;
}

/** The parts of a card_templates row the helpers below read. */
export interface CardRowLike {
  id: string;
  items: unknown;
  board_size: number;
  free_space: boolean;
  styles: unknown;
  mix?: unknown;
}

/** The squares a card really holds: no FREE marker, no blank slot (the same filter the game uses). */
function realItems(items: unknown): SquareItem[] {
  if (!Array.isArray(items)) return [];
  return (items as SquareItem[]).filter(
    (item) => item && !item.isFreeSpace && (item.text?.trim() || item.imageUrl),
  );
}

/** Same texts, ignoring order, case and outer spaces. */
function sameTexts(a: SquareItem[], b: SquareItem[]): boolean {
  if (a.length !== b.length) return false;
  const keys = (list: SquareItem[]) => list.map((item) => textKey(item.text ?? item.imageUrl)).sort();
  const x = keys(a);
  const y = keys(b);
  return x.every((key, i) => key === y[i]);
}

/** The draft as the row Create Room inserts. Styles are built the way Save Card builds them. */
export function hostDraftFrom(draft: HostableDraft, tags: Tag[]): HostDraft {
  return {
    name: draft.name,
    boardSize: draft.boardSize,
    freeSpace: draft.freeSpace,
    styles: cardStyles(draft.stylePreset, draft.set, tags),
    mix: draft.builtMix,
    items: itemsForSave(draft.set),
  };
}

/**
 * Host by id only when the card pane shows exactly the saved card: loaded (or
 * just saved), untouched, still saved, and holding the same squares as its
 * row. Two cases look untouched but are not the row:
 *
 * - A legacy card with more items than squares loads as a pool (poolIds) and
 *   shows one draw of 24. Hosting its id would deal every player a different
 *   24 from the pool, not the 24 on screen.
 * - A short legacy card is topped up from the library when it loads. Its row
 *   is still short, and a short card breaks the board (pre-flight finding 2).
 *
 * Anything else goes in as a draft, so what the host sees is what gets played.
 */
export function hostCardFor(
  draft: HostableDraft,
  tags: Tag[],
  savedCard: CardRowLike | undefined,
): HostCard {
  const unchangedSaved =
    !!draft.templateId &&
    !!savedCard &&
    savedCard.id === draft.templateId &&
    !draft.dirty &&
    !draft.poolIds &&
    savedCard.board_size === draft.boardSize &&
    savedCard.free_space === draft.freeSpace &&
    sameTexts(realItems(savedCard.items), draft.set);

  return unchangedSaved
    ? { kind: 'saved', templateId: savedCard.id }
    : { kind: 'draft', draft: hostDraftFrom(draft, tags) };
}

/** How a card's squares split, for the one-line summary under its name. */
export interface CardSplit {
  /** Squares per game in lane order, then No Game; a card without a legend is one "N Items" part. */
  parts: { count: number; label: string }[];
  /** A legacy card holding more items than squares: every board draws this many from parts[0].count. */
  draws: number | null;
}

function legendOf(styles: unknown): LegendEntry[] {
  const legend = (styles as CardStyles | null)?.legend;
  if (!Array.isArray(legend)) return [];
  return legend.filter((entry) => entry && typeof entry.gameTagId === 'string' && typeof entry.name === 'string');
}

function laneOrder(mix: unknown): string[] {
  const lanes = (mix as CardMix | null)?.lanes;
  if (!Array.isArray(lanes)) return [];
  return lanes.map((lane) => lane?.gameTagId).filter((id): id is string => typeof id === 'string');
}

/**
 * The game split of a card, counted from each item's gameTagId against the
 * card's own legend ("5 Rocket League · 19 Call of Duty"). Games follow the
 * card's mix order (the library's lane order: first game created on the left),
 * then any legend game the mix does not name; items with no game, or a game
 * the legend does not know, count as No Game, last.
 *
 * A card with no legend (a legacy card, or a library card with no games) is
 * "24 Items", or "Draws 24 From 30 Items" when it holds more than its squares.
 */
export function cardSplit(card: Omit<CardRowLike, 'id'>): CardSplit {
  const items = realItems(card.items);
  const legend = legendOf(card.styles);

  if (legend.length === 0) {
    const slots = slotsFor(card.board_size, card.free_space);
    return {
      parts: [{ count: items.length, label: items.length === 1 ? 'Item' : 'Items' }],
      draws: items.length > slots ? slots : null,
    };
  }

  const names = new Map(legend.map((entry) => [entry.gameTagId, entry.name]));
  const counts = new Map<string, number>();
  let noGame = 0;
  for (const item of items) {
    if (item.gameTagId && names.has(item.gameTagId)) {
      counts.set(item.gameTagId, (counts.get(item.gameTagId) ?? 0) + 1);
    } else {
      noGame++;
    }
  }

  const mixed = laneOrder(card.mix).filter((id) => names.has(id));
  const order = [...new Set([...mixed, ...legend.map((entry) => entry.gameTagId)])];
  const parts = order
    .filter((id) => (counts.get(id) ?? 0) > 0)
    .map((id) => ({ count: counts.get(id)!, label: names.get(id)! }));
  if (noGame > 0) parts.push({ count: noGame, label: 'No Game' });
  return { parts, draws: null };
}

/** The split as plain words: "5 Rocket League · 19 Call of Duty", "24 Items", "Draws 24 From 30 Items". */
export function cardSplitText(split: CardSplit): string {
  if (split.draws !== null) return `Draws ${split.draws} From ${split.parts[0]?.count ?? 0} Items`;
  return split.parts.map((part) => `${part.count} ${part.label}`).join(' · ');
}

/** The split of an unsaved draft, read the same way as a saved row. */
export function draftSplit(draft: HostDraft): CardSplit {
  return cardSplit({
    items: draft.items,
    board_size: draft.boardSize,
    free_space: draft.freeSpace,
    styles: draft.styles,
    mix: draft.mix,
  });
}

export interface CardChoice<T> {
  /** My latest room's card when it is not one of my saved cards: listed first as "Last Card (Unsaved)". */
  lastUnsaved: T | null;
  /** The card Create Room opens on: the latest room's, else the newest saved card, else none. */
  selectedId: string | null;
}

/**
 * Which card the landing's Create Room preselects. `saved` is my saved cards,
 * newest first; `lastRoomCard` is the card_templates row behind my most
 * recently hosted room (null when that room has none, or the row is gone).
 *
 * - The latest card is one of my saved cards: preselect it.
 * - It is an unsaved copy (saved = false): list it first and preselect it,
 *   so hosting "the same as last time" stays one click.
 * - Otherwise (no room, no card, or a saved card that is not in my list):
 *   the newest saved card, or nothing when I have none.
 */
export function chooseDefaultCard<T extends { id: string; saved: boolean }>(
  saved: T[],
  lastRoomCard: T | null,
): CardChoice<T> {
  if (lastRoomCard) {
    if (saved.some((card) => card.id === lastRoomCard.id)) return { lastUnsaved: null, selectedId: lastRoomCard.id };
    if (!lastRoomCard.saved) return { lastUnsaved: lastRoomCard, selectedId: lastRoomCard.id };
  }
  return { lastUnsaved: null, selectedId: saved[0]?.id ?? null };
}
