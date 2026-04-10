import { create } from 'zustand';
import type { SquareItem, CardStyles } from '@/types/card';
import type { WinPattern } from '@/types/game';

export interface GameWinner {
  playerId: string;
  displayName: string;
  pattern: WinPattern;
}

interface GameState {
  // Set on game_started
  gameId: string | null;
  seed: string | null;
  roundNumber: number;
  callList: number[];      // ordered item indices — the full call sequence
  calledCount: number;     // how many items have been called so far
  templateItems: SquareItem[];
  boardSize: number;
  freeSpace: boolean;
  shuffleMode: 'full' | 'column';
  winPatterns: WinPattern[];
  cardStyles: CardStyles;

  // Player's card (generated from seed + playerId on game_started)
  myCard: SquareItem[];
  // Grid indices the current player has marked
  myMarks: number[];
  // Has the current player already claimed bingo this round?
  hasClaimed: boolean;
  // ISO timestamp of when the game started — used to compute bingo_time_ms
  gameStartedAt: string | null;

  winners: GameWinner[];

  // Actions
  initGame: (params: {
    gameId: string;
    seed: string;
    roundNumber: number;
    callList: number[];
    templateItems: SquareItem[];
    boardSize: number;
    freeSpace: boolean;
    shuffleMode: 'full' | 'column';
    winPatterns: WinPattern[];
    cardStyles?: CardStyles;
  }) => void;
  setMyCard: (card: SquareItem[]) => void;
  setCalledCount: (count: number) => void;
  toggleMark: (gridIndex: number) => void;
  addWinner: (winner: GameWinner) => void;
  setHasClaimed: (claimed: boolean) => void;
  resetGame: () => void;
}

const initial: Omit<GameState, keyof { initGame: unknown; setMyCard: unknown; setCalledCount: unknown; toggleMark: unknown; addWinner: unknown; setHasClaimed: unknown; resetGame: unknown }> = {
  gameId: null,
  seed: null,
  roundNumber: 0,
  callList: [],
  calledCount: 0,
  templateItems: [],
  boardSize: 5,
  freeSpace: true,
  shuffleMode: 'full',
  winPatterns: ['row', 'column', 'diagonal'],
  cardStyles: {},
  myCard: [],
  myMarks: [],
  hasClaimed: false,
  gameStartedAt: null,
  winners: [],
};

export const useGameStore = create<GameState>((set, get) => ({
  ...initial,

  initGame: (params) =>
    set({
      ...params,
      cardStyles: params.cardStyles ?? {},
      calledCount: 0,
      myCard: [],
      myMarks: [],
      hasClaimed: false,
      gameStartedAt: new Date().toISOString(),
      winners: [],
    }),

  setMyCard: (myCard) => set({ myCard }),

  setCalledCount: (calledCount) => set({ calledCount }),

  toggleMark: (gridIndex) => {
    const { myMarks } = get();
    const already = myMarks.includes(gridIndex);
    set({ myMarks: already ? myMarks.filter((i) => i !== gridIndex) : [...myMarks, gridIndex] });
  },

  addWinner: (winner) => {
    const { winners } = get();
    if (!winners.some((w) => w.playerId === winner.playerId)) {
      set({ winners: [...winners, winner] });
    }
  },

  setHasClaimed: (hasClaimed) => set({ hasClaimed }),

  resetGame: () => set({ ...initial }),
}));
