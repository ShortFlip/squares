import { textKey } from '@/lib/library/card-draft';
import type { LibraryItem, Tag } from '@/types/library';

/*
 * The rules behind the items pane's "Add an Item" row, kept pure so they can
 * be tested without the page.
 *
 * `filter` everywhere here is the store's LibraryFilter: 'all', 'none'
 * (No Game), or a tag id (a game or an extra tag). It is typed as a plain
 * string so this file does not import the store.
 */

/** Whether the items pane shows `item` under `filter`. */
export function matchesFilter(item: LibraryItem, filter: string, gameIds: ReadonlySet<string>): boolean {
  if (filter === 'all') return true;
  if (filter === 'none') return item.gameTagId === null;
  if (gameIds.has(filter)) return item.gameTagId === filter;
  return item.tagIds.includes(filter);
}

export interface AddItemDefaults {
  /** The game the row's select starts on (null = No Game). */
  gameTagId: string | null;
  /** Extra tags every item added from the row carries. */
  tagIds: string[];
}

/**
 * What the Add an Item row starts on, so a new item lands in the view he is
 * looking at:
 * - a game filter → that game;
 * - No Game → No Game;
 * - an extra tag → No Game, and the new item carries that tag (without it the
 *   item would vanish from the tag view the moment it was added);
 * - All → the game he last picked in the row this session (No Game at first).
 *   A last pick that is no longer one of his games falls back to No Game.
 * A filter id that matches no tag (stale) starts on No Game with no tag.
 */
export function addItemDefaults(filter: string, tags: Tag[], lastGame: string | null): AddItemDefaults {
  if (filter === 'all') {
    const known = lastGame !== null && tags.some((t) => t.kind === 'game' && t.id === lastGame);
    return { gameTagId: known ? lastGame : null, tagIds: [] };
  }
  if (filter === 'none') return { gameTagId: null, tagIds: [] };
  const tag = tags.find((t) => t.id === filter);
  if (!tag) return { gameTagId: null, tagIds: [] };
  return tag.kind === 'game' ? { gameTagId: tag.id, tagIds: [] } : { gameTagId: null, tagIds: [tag.id] };
}

/**
 * What has to change for `item` to show in the list: the search is cleared
 * when its text does not contain the search (the same trimmed, case-insensitive
 * match the pane uses), and the filter goes back to All when the filter hides
 * it (he picked a different game than the filter's before adding).
 */
export function revealFor(
  item: LibraryItem,
  filter: string,
  search: string,
  gameIds: ReadonlySet<string>,
): { clearSearch: boolean; showAll: boolean } {
  const needle = textKey(search);
  return {
    clearSearch: needle.length > 0 && !textKey(item.text).includes(needle),
    showAll: !matchesFilter(item, filter, gameIds),
  };
}
