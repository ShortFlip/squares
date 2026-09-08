import { create } from 'zustand';
import { parseImport } from '@/lib/game/import';
import type { SquareItem, CardStyles } from '@/types/card';

interface EditorState {
  // Persisted to DB (card_templates columns)
  templateId: string | null; // null = new template
  name: string;
  boardSize: number;
  /**
   * The item pool — every item this card can draw from. NOT pinned to
   * boardSize²: a pool larger than the board is the point (each round deals a
   * different subset to every player). Never contains blank placeholders.
   */
  items: SquareItem[];
  shuffleMode: 'full' | 'column';
  freeSpace: boolean;
  isPublic: boolean;
  styles: CardStyles;

  // Editor UI state (not persisted)
  editingIndex: number | null;
  isPreviewMode: boolean;
  isSaving: boolean;

  // Actions
  setName: (name: string) => void;
  setBoardSize: (size: number) => void;
  /** Edit pool entry `index`; an index at the end of the pool appends. */
  setItem: (index: number, item: SquareItem) => void;
  addItem: (text: string) => void;
  removeItem: (index: number) => void;
  clearItems: () => void;
  /** Drop pool entries that carry neither text nor an image. */
  pruneEmpty: () => void;
  setShuffleMode: (mode: 'full' | 'column') => void;
  setFreeSpace: (enabled: boolean) => void;
  setIsPublic: (isPublic: boolean) => void;
  setStyles: (styles: CardStyles) => void;
  setEditingIndex: (index: number | null) => void;
  setPreviewMode: (preview: boolean) => void;
  setSaving: (saving: boolean) => void;
  /** Append parsed items to the pool, skipping case-insensitive duplicates. */
  bulkFill: (text: string) => { added: number; skipped: number };
  /** Replace the pool wholesale (used when loading an existing template). */
  loadItems: (items: SquareItem[]) => void;
  resetEditor: () => void;
}

const DEFAULT_SIZE = 5;

/** How many squares one card needs — the free space is not drawn from the pool. */
export function neededFor(boardSize: number, freeSpace: boolean): number {
  return boardSize * boardSize - (freeSpace ? 1 : 0);
}

/** Items beyond what a single card needs — these rotate in on later rounds. */
export function surplusFor(itemCount: number, needed: number): number {
  return Math.max(0, itemCount - needed);
}

/** Items still missing before this card can be saved. */
export function shortByFor(itemCount: number, needed: number): number {
  return Math.max(0, needed - itemCount);
}

/** An item counts toward the pool only if it would render something. */
function isRealItem(item: SquareItem): boolean {
  return Boolean(item.text?.trim() || item.imageUrl);
}

const initial = {
  templateId: null,
  name: '',
  boardSize: DEFAULT_SIZE,
  items: [] as SquareItem[],
  shuffleMode: 'full' as const,
  freeSpace: true,
  isPublic: false,
  styles: {} as CardStyles,
  editingIndex: null,
  isPreviewMode: false,
  isSaving: false,
};

export const useEditorStore = create<EditorState>((set, get) => ({
  ...initial,

  setName: (name) => set({ name }),

  // Board size and free space no longer resize the pool — they only change how
  // many of it a single card uses.
  setBoardSize: (boardSize) => set({ boardSize }),
  setFreeSpace: (freeSpace) => set({ freeSpace }),

  setItem: (index, item) => {
    const items = [...get().items];
    if (index < 0 || index > items.length) return; // gap writes would leave holes
    items[index] = item;
    set({ items });
  },

  addItem: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    set({ items: [...get().items, { text: trimmed }] });
  },

  removeItem: (index) =>
    set({ items: get().items.filter((_, i) => i !== index) }),

  clearItems: () => set({ items: [] }),

  pruneEmpty: () => {
    const items = get().items;
    const kept = items.filter(isRealItem);
    if (kept.length !== items.length) set({ items: kept });
  },

  setShuffleMode: (shuffleMode) => set({ shuffleMode }),
  setIsPublic: (isPublic) => set({ isPublic }),
  setStyles: (styles) => set({ styles }),
  setEditingIndex: (editingIndex) => set({ editingIndex }),
  setPreviewMode: (isPreviewMode) => set({ isPreviewMode }),
  setSaving: (isSaving) => set({ isSaving }),

  bulkFill: (text) => {
    const parsed = parseImport(text);
    const current = get().items;
    const seen = new Set(
      current.map((i) => (i.text ?? '').trim().toLowerCase()).filter(Boolean),
    );

    const additions: SquareItem[] = [];
    let skipped = 0;
    for (const t of parsed) {
      const key = t.toLowerCase();
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      additions.push({ text: t });
    }

    set({ items: [...current, ...additions] });
    return { added: additions.length, skipped };
  },

  loadItems: (items) => set({ items: items.filter(isRealItem) }),

  resetEditor: () => set({ ...initial, items: [] }),
}));
