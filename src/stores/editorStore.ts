import { create } from 'zustand';
import type { SquareItem, CardStyles } from '@/types/card';

interface EditorState {
  // Persisted to DB (card_templates columns)
  templateId: string | null; // null = new template
  name: string;
  boardSize: number;
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
  setItem: (index: number, item: SquareItem) => void;
  setShuffleMode: (mode: 'full' | 'column') => void;
  setFreeSpace: (enabled: boolean) => void;
  setIsPublic: (isPublic: boolean) => void;
  setStyles: (styles: CardStyles) => void;
  setEditingIndex: (index: number | null) => void;
  setPreviewMode: (preview: boolean) => void;
  setSaving: (saving: boolean) => void;
  // Parse newline-separated text and fill the grid from the top
  bulkFill: (text: string) => void;
  resetEditor: () => void;
}

const DEFAULT_SIZE = 5;

function emptyItems(count: number): SquareItem[] {
  return Array.from({ length: count }, () => ({ text: '' }));
}

const initial = {
  templateId: null,
  name: '',
  boardSize: DEFAULT_SIZE,
  items: emptyItems(DEFAULT_SIZE * DEFAULT_SIZE),
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

  setBoardSize: (boardSize) => {
    const newTotal = boardSize * boardSize;
    const current = get().items;
    // Preserve existing content when resizing — trim or pad with empties
    const items =
      current.length >= newTotal
        ? current.slice(0, newTotal)
        : [...current, ...emptyItems(newTotal - current.length)];
    set({ boardSize, items });
  },

  setItem: (index, item) => {
    const items = [...get().items];
    items[index] = item;
    set({ items });
  },

  setShuffleMode: (shuffleMode) => set({ shuffleMode }),
  setFreeSpace: (freeSpace) => set({ freeSpace }),
  setIsPublic: (isPublic) => set({ isPublic }),
  setStyles: (styles) => set({ styles }),
  setEditingIndex: (editingIndex) => set({ editingIndex }),
  setPreviewMode: (isPreviewMode) => set({ isPreviewMode }),
  setSaving: (isSaving) => set({ isSaving }),

  bulkFill: (text) => {
    const { freeSpace, boardSize } = get();
    const total = boardSize * boardSize;
    const centerIndex = Math.floor(total / 2);

    const parsed = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((t) => ({ text: t }));

    const current = [...get().items];
    // When freeSpace is on, skip the center slot — it's always FREE and not
    // user-editable. This matches the dialog description ("skipping the FREE
    // space") and ensures N pasted items map 1:1 to the N visible non-FREE slots.
    let parsedIdx = 0;
    for (let i = 0; i < total && parsedIdx < parsed.length; i++) {
      if (freeSpace && i === centerIndex) continue;
      current[i] = parsed[parsedIdx++];
    }
    set({ items: current });
  },

  resetEditor: () =>
    set({ ...initial, items: emptyItems(DEFAULT_SIZE * DEFAULT_SIZE) }),
}));
