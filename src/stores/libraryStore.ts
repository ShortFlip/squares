import { create } from 'zustand';
import { notify } from '@/lib/library/notify';
import { countByLane, slotsFor, swapItem, type LaneKey } from '@/lib/game/card-builder';
import { seededRng } from '@/lib/game/seed-rng';
import { CARD_PRESETS } from '@/lib/card-styles';
import * as api from '@/lib/library/api';
import {
  cardStyles,
  itemsForSave,
  laneKeysFor,
  matchCardItems,
  mixForBuild,
  mixFromSet,
  reconcileCardSet,
  sameSet,
} from '@/lib/library/card-draft';
import type { CardStyles, CardTemplate, SquareItem } from '@/types/card';
import type { CardMix, GameColorKey, GameIconKey, LibraryItem, MixLane, Tag, TagKind } from '@/types/library';

/*
 * State for /library: the owner's items and tags, the items pane's filter,
 * search and selection, and the card being built in the card pane.
 *
 * The card maths lives in card-builder.ts and card-draft.ts; this store only
 * decides when to run it. Every card change that can move the lane counts
 * (size, free space, mix, pins, a library edit) goes through rebuild(), which
 * keeps every square it can, so one notch of the slider changes one square.
 *
 * The card draft (not the library) is saved to localStorage under
 * squares:card-draft, so a refresh or a trip to the landing page does not lose
 * a half-built card. Storage can be blocked (private mode, site data off):
 * every read and write is wrapped so the page works without it.
 */

/** 'all', 'none' (No Game), or a tag id (a game or an extra tag). */
export type LibraryFilter = 'all' | 'none' | string;

export interface CardDraft {
  /** Who this draft belongs to; a draft from another player on this browser is ignored. */
  ownerId: string | null;
  /** The saved card this draft was loaded from (or last saved as), if any. */
  templateId: string | null;
  name: string;
  boardSize: number;
  freeSpace: boolean;
  stylePreset: string;
  /** The requested split. Empty lanes = untouched: an even split across the games. */
  mix: CardMix;
  /** The split the last build settled on (pins win, caps apply). What Save stores. */
  builtMix: CardMix;
  set: SquareItem[];
  pinnedIds: string[];
  /**
   * A loaded card that holds more items than its slots draws from its own
   * items only (null = the whole library). Pinned items join the pool too.
   */
  poolIds: string[] | null;
  /** Changed since it was loaded or saved. Host This Card hosts an unchanged saved card by its id (hostCardFor). */
  dirty: boolean;
}

const DRAFT_KEY = 'squares:card-draft';

function blankDraft(ownerId: string | null): CardDraft {
  return {
    ownerId,
    templateId: null,
    name: '',
    boardSize: 5,
    freeSpace: true,
    stylePreset: 'default',
    mix: { lanes: [] },
    builtMix: { lanes: [] },
    set: [],
    pinnedIds: [],
    poolIds: null,
    dirty: false,
  };
}

function readStoredDraft(ownerId: string): CardDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CardDraft>;
    if (parsed.ownerId !== ownerId || !Array.isArray(parsed.set)) return null;
    // Spread over a blank so a draft written by an older build still has every field.
    return { ...blankDraft(ownerId), ...parsed, ownerId };
  } catch {
    return null;
  }
}

function writeStoredDraft(draft: CardDraft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Blocked or full storage only costs the draft surviving a refresh.
  }
}

/** A fresh seed per action: Reshuffle and Swap should never repeat themselves. */
function freshRng(): () => number {
  return seededRng(crypto.randomUUID());
}

/** Toast a LibraryError's human message; anything else gets a generic one. */
function toastError(error: unknown, fallback: string): void {
  notify.error(error instanceof api.LibraryError ? error.message : fallback);
  if (!(error instanceof api.LibraryError) && process.env.NODE_ENV !== 'production') {
    console.error('[library]', error);
  }
}

interface LibraryState {
  ownerId: string | null;
  items: LibraryItem[];
  tags: Tag[];
  loaded: boolean;
  savedCards: CardTemplate[];

  filter: LibraryFilter;
  search: string;
  selectedIds: string[];
  /**
   * The game picked in the Add an Item row's select for the current filter
   * (null = none picked, so the row follows addItemDefaults). Every filter
   * change clears it, so a new view starts on its own default again.
   */
  addPick: { gameTagId: string | null } | null;
  /** The game last picked in the Add an Item row: its default under All. Memory only, for this session. */
  addLastGame: string | null;

  draft: CardDraft;
  /** Lanes that asked for more squares than they have items, from the last build. */
  capped: LaneKey[];

  // ── Library ──
  load: (ownerId: string) => Promise<boolean>;
  refreshSavedCards: () => Promise<void>;
  setFilter: (filter: LibraryFilter) => void;
  setSearch: (search: string) => void;
  toggleSelected: (id: string) => void;
  setSelected: (ids: string[]) => void;
  clearSelection: () => void;
  /** Pick the Add an Item row's game (null = No Game); remembered as the row's default under All. */
  pickAddGame: (gameTagId: string | null) => void;
  /** Add texts through importItems. `failMessage` replaces the list wording in the error toast. */
  importList: (
    texts: string[],
    gameTagId: string | null,
    tagIds: string[],
    failMessage?: string,
  ) => Promise<{ added: number; skipped: number } | null>;
  renameItem: (id: string, text: string) => Promise<boolean>;
  setGameFor: (ids: string[], gameTagId: string | null) => Promise<boolean>;
  addTagTo: (ids: string[], tagId: string) => Promise<boolean>;
  removeTagFrom: (ids: string[], tagId: string) => Promise<boolean>;
  deleteItems: (ids: string[]) => Promise<boolean>;
  createTag: (input: { name: string; kind: TagKind; color?: GameColorKey | null; icon?: GameIconKey | null }) => Promise<Tag | null>;

  // ── Card ──
  /** The draft saved in this browser, or a fresh 5×5 from an even mix of the owner's games. */
  restoreDraft: () => void;
  newCard: () => void;
  loadCard: (card: CardTemplate) => void;
  setName: (name: string) => void;
  setBoardSize: (size: number) => void;
  setFreeSpace: (on: boolean) => void;
  setStylePreset: (preset: string) => void;
  setMix: (lanes: MixLane[]) => void;
  togglePin: (itemId: string) => void;
  reshuffle: () => void;
  /** Swap one square; returns the lane that ran dry when nothing was left to swap in. */
  swap: (index: number) => { swapped: boolean; lane: LaneKey };
  removeSquare: (index: number) => void;
  useWholeLibrary: () => void;
  saveCard: (targetId: string | null) => Promise<boolean>;
}

/** The items a card may draw from: the whole library, or a loaded pool card's own items plus pins. */
export function poolFor(items: LibraryItem[], draft: CardDraft): LibraryItem[] {
  if (!draft.poolIds) return items;
  const allowed = new Set([...draft.poolIds, ...draft.pinnedIds]);
  return items.filter((item) => allowed.has(item.id));
}

/** Slots the mix sliders share out: text-only squares take theirs first. */
export function mixSlots(draft: CardDraft): number {
  const extras = draft.set.filter((square) => !square.libraryItemId).length;
  return Math.max(0, slotsFor(draft.boardSize, draft.freeSpace) - extras);
}

export const useLibraryStore = create<LibraryState>((set, get) => {
  /**
   * Re-run the card after anything that can move the lane counts. `current`
   * defaults to the card as it is (keep what fits); Reshuffle passes the pins
   * alone. Marks the draft dirty only when the squares really changed.
   */
  function rebuild(patch: Partial<CardDraft> = {}, current?: SquareItem[]): void {
    const { items, tags } = get();
    const draft = { ...get().draft, ...patch };
    const pool = poolFor(items, draft);
    // Drop pins whose item is gone, so a deleted item cannot haunt the pin list.
    const inPool = new Set(pool.map((item) => item.id));
    const pinnedIds = draft.pinnedIds.filter((id) => inPool.has(id));

    const result = reconcileCardSet({
      current: current ?? draft.set,
      pool,
      slots: slotsFor(draft.boardSize, draft.freeSpace),
      mix: mixForBuild(draft.mix, laneKeysFor(pool, tags)),
      pinnedIds,
      rng: freshRng(),
    });

    const changed = !sameSet(draft.set, result.set) || Object.keys(patch).length > 0;
    set({
      draft: {
        ...draft,
        pinnedIds,
        set: result.set,
        builtMix: result.mix,
        dirty: draft.dirty || changed,
      },
      capped: result.capped,
    });
  }

  /** Apply a library change locally, then let the card catch up. */
  function afterLibraryChange(items: LibraryItem[]): void {
    const before = get().draft;
    set({ items });
    rebuild();
    // A library edit refreshes the draft but is not an edit to the card itself.
    if (!before.dirty && sameSet(before.set, get().draft.set)) {
      set({ draft: { ...get().draft, dirty: false } });
    }
  }

  return {
    ownerId: null,
    items: [],
    tags: [],
    loaded: false,
    savedCards: [],
    filter: 'all',
    search: '',
    selectedIds: [],
    addPick: null,
    addLastGame: null,
    draft: blankDraft(null),
    capped: [],

    async load(ownerId) {
      try {
        const [{ items, tags }, savedCards] = await Promise.all([
          api.loadLibrary(ownerId),
          api.loadSavedCards(ownerId),
        ]);
        set({ ownerId, items, tags, savedCards, loaded: true, selectedIds: [] });
        return true;
      } catch (error) {
        toastError(error, 'Could not load your library.');
        return false;
      }
    },

    async refreshSavedCards() {
      const { ownerId } = get();
      if (!ownerId) return;
      try {
        set({ savedCards: await api.loadSavedCards(ownerId) });
      } catch (error) {
        toastError(error, 'Could not load your saved cards.');
      }
    },

    // A new filter hides rows, so a selection made under the old one is cleared
    // rather than left to be bulk-edited unseen. The Add an Item row's pick is
    // cleared too, so the row starts on the new view's default.
    setFilter: (filter) => set({ filter, selectedIds: [], addPick: null }),
    pickAddGame: (gameTagId) => set({ addPick: { gameTagId }, addLastGame: gameTagId }),
    setSearch: (search) => set({ search }),
    toggleSelected: (id) =>
      set((s) => ({
        selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
      })),
    setSelected: (ids) => set({ selectedIds: ids }),
    clearSelection: () => set({ selectedIds: [] }),

    async importList(texts, gameTagId, tagIds, failMessage) {
      const { ownerId } = get();
      if (!ownerId) return null;
      try {
        const result = await api.importItems(ownerId, texts, gameTagId, tagIds, failMessage);
        afterLibraryChange([...result.items, ...get().items]);
        return { added: result.added, skipped: result.skipped };
      } catch (error) {
        toastError(error, failMessage ?? 'Could not import that list.');
        // An import can fail halfway (items in, tags not), so re-read rather
        // than guess what landed. Quietly: the toast above already spoke.
        try {
          afterLibraryChange((await api.loadLibrary(ownerId)).items);
        } catch {
          // Still out of sync; the next page load fixes it.
        }
        return null;
      }
    },

    async renameItem(id, text) {
      try {
        const next = await api.updateItemText(id, text);
        afterLibraryChange(get().items.map((item) => (item.id === id ? { ...item, text: next } : item)));
        // A square on the card follows the library's spelling while it is a draft.
        const { draft } = get();
        if (draft.set.some((square) => square.libraryItemId === id)) {
          set({
            draft: {
              ...draft,
              set: draft.set.map((square) => (square.libraryItemId === id ? { ...square, text: next } : square)),
              dirty: true,
            },
          });
        }
        return true;
      } catch (error) {
        toastError(error, 'Could not rename that item.');
        return false;
      }
    },

    async setGameFor(ids, gameTagId) {
      if (ids.length === 0) return true;
      try {
        await api.setGame(ids, gameTagId);
        const touched = new Set(ids);
        afterLibraryChange(get().items.map((item) => (touched.has(item.id) ? { ...item, gameTagId } : item)));
        return true;
      } catch (error) {
        toastError(error, 'Could not change the game.');
        return false;
      }
    },

    async addTagTo(ids, tagId) {
      const targets = get().items.filter((item) => ids.includes(item.id) && !item.tagIds.includes(tagId)).map((item) => item.id);
      if (targets.length === 0) return true;
      try {
        await api.addTag(targets, tagId);
        const touched = new Set(targets);
        set({ items: get().items.map((item) => (touched.has(item.id) ? { ...item, tagIds: [...item.tagIds, tagId] } : item)) });
        return true;
      } catch (error) {
        toastError(error, 'Could not add that tag.');
        return false;
      }
    },

    async removeTagFrom(ids, tagId) {
      // Only items that carry the tag: removeTag expects every one back.
      const targets = get().items.filter((item) => ids.includes(item.id) && item.tagIds.includes(tagId)).map((item) => item.id);
      if (targets.length === 0) return true;
      try {
        await api.removeTag(targets, tagId);
        const touched = new Set(targets);
        set({ items: get().items.map((item) => (touched.has(item.id) ? { ...item, tagIds: item.tagIds.filter((t) => t !== tagId) } : item)) });
        return true;
      } catch (error) {
        toastError(error, 'Could not remove that tag.');
        return false;
      }
    },

    async deleteItems(ids) {
      try {
        await api.deleteItems(ids);
        const gone = new Set(ids);
        set({ selectedIds: get().selectedIds.filter((id) => !gone.has(id)) });
        afterLibraryChange(get().items.filter((item) => !gone.has(item.id)));
        return true;
      } catch (error) {
        toastError(error, 'Could not delete those items.');
        return false;
      }
    },

    async createTag(input) {
      const { ownerId } = get();
      if (!ownerId) return null;
      try {
        const tag = await api.createTag(ownerId, input);
        set({ tags: [...get().tags, tag] });
        return tag;
      } catch (error) {
        toastError(error, 'Could not create that tag.');
        return null;
      }
    },

    restoreDraft() {
      const { ownerId } = get();
      if (!ownerId) return;
      const stored = readStoredDraft(ownerId);
      if (stored) {
        const wasDirty = stored.dirty;
        set({ draft: stored });
        rebuild();
        // Restoring is not editing: only a real change from the library marks it.
        if (!wasDirty && sameSet(stored.set, get().draft.set)) set({ draft: { ...get().draft, dirty: false } });
      } else {
        set({ draft: blankDraft(ownerId) });
        rebuild();
        set({ draft: { ...get().draft, dirty: false } });
      }
    },

    newCard() {
      set({ draft: blankDraft(get().ownerId) });
      rebuild();
      set({ draft: { ...get().draft, dirty: false } });
    },

    loadCard(card) {
      const styles = (card.styles ?? {}) as CardStyles;
      const preset = CARD_PRESETS.some((p) => p.id === styles.preset) ? styles.preset! : 'default';
      const { squares } = matchCardItems((card.items ?? []) as SquareItem[], get().items);
      const slots = slotsFor(card.board_size, card.free_space);

      const base: CardDraft = {
        ...blankDraft(get().ownerId),
        templateId: card.id,
        name: card.name,
        boardSize: card.board_size,
        freeSpace: card.free_space,
        stylePreset: preset,
      };

      if (squares.length > slots) {
        // A pool card (a legacy card with more items than squares): draw the
        // slots from its own items, pinning nothing. Text-only items cannot be
        // drawn, so they sit this round out; Reshuffle draws again.
        const poolIds = squares.map((s) => s.libraryItemId).filter((id): id is string => !!id);
        // Weight each lane by its share of the card's items: an even draw
        // across the pool, the way the room used to deal it. (The page's
        // default would leave No Game at 0%, and a legacy card is mostly No Game.)
        set({ draft: { ...base, poolIds, set: [], mix: mixFromSet(squares) } });
        rebuild({}, []);
      } else {
        // Load exactly: the requested mix is the card's own split, so the
        // rebuild keeps every square (and only fills a short legacy card).
        const own = mixFromSet(squares);
        set({ draft: { ...base, set: squares, mix: own, builtMix: own } });
        rebuild();
      }
      set({ draft: { ...get().draft, dirty: false } });
    },

    setName: (name) => set((s) => ({ draft: { ...s.draft, name, dirty: true } })),
    setBoardSize: (boardSize) => rebuild({ boardSize }),
    setFreeSpace: (freeSpace) => rebuild({ freeSpace }),
    setStylePreset: (stylePreset) => set((s) => ({ draft: { ...s.draft, stylePreset, dirty: true } })),
    setMix: (lanes) => rebuild({ mix: { lanes } }),

    togglePin(itemId) {
      const { draft } = get();
      const pinnedIds = draft.pinnedIds.includes(itemId)
        ? draft.pinnedIds.filter((id) => id !== itemId)
        : [...draft.pinnedIds, itemId];
      rebuild({ pinnedIds });
    },

    reshuffle() {
      const { draft } = get();
      // Keep only what Reshuffle must not touch: pins and text-only squares.
      const keep = draft.set.filter(
        (square) => !square.libraryItemId || draft.pinnedIds.includes(square.libraryItemId),
      );
      rebuild({}, keep);
      set({ draft: { ...get().draft, dirty: true } });
    },

    swap(index) {
      const { draft, items } = get();
      const lane = draft.set[index]?.gameTagId ?? null;
      const result = swapItem(draft.set, index, poolFor(items, draft), freshRng());
      if (result.swapped) set({ draft: { ...draft, set: result.set, dirty: true } });
      return { swapped: result.swapped, lane };
    },

    removeSquare(index) {
      const { draft } = get();
      const next = draft.set.filter((_, i) => i !== index);
      rebuild({}, next);
      set({ draft: { ...get().draft, dirty: true } });
    },

    useWholeLibrary: () => rebuild({ poolIds: null }),

    async saveCard(targetId) {
      const { draft, tags, ownerId } = get();
      if (!ownerId) return false;
      const styles = cardStyles(draft.stylePreset, draft.set, tags);
      try {
        const id = await api.saveCard({
          id: targetId,
          ownerId,
          name: draft.name,
          boardSize: draft.boardSize,
          freeSpace: draft.freeSpace,
          styles,
          items: itemsForSave(draft.set),
          mix: draft.builtMix,
        });
        set({ draft: { ...get().draft, templateId: id, name: draft.name.trim(), dirty: false } });
        await get().refreshSavedCards();
        return true;
      } catch (error) {
        toastError(error, 'Could not save that card.');
        return false;
      }
    },
  };
});

// Persist the card draft (never the library) whenever it changes.
if (typeof window !== 'undefined') {
  useLibraryStore.subscribe((state, prev) => {
    if (state.draft !== prev.draft && state.draft.ownerId) writeStoredDraft(state.draft);
  });
}

/** Items per lane in the pool the card draws from. */
export function laneCounts(items: LibraryItem[], draft: CardDraft): Map<LaneKey, number> {
  return countByLane(poolFor(items, draft));
}
