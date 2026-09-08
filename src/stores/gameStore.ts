import { create } from 'zustand';
import type { SquareItem, CardStyles } from '@/types/card';
import type { WinPattern, GameMode } from '@/types/game';

/**
 * Another player in this round, as far as this client knows.
 *
 * `synced: false` means we know they are here (presence) but have not yet read
 * their `game_players` row — their card and marks are unknown, which the UI
 * must show as "syncing" rather than as a real 0/25 score (DESIGN.md: "Them
 * showing 0/25 after a refresh is not [tolerable]").
 */
export interface OtherPlayer {
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
  card: SquareItem[];
  marks: number[];
  won: boolean;
  finishPosition: number | null;
  synced: boolean;
}

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
  gameMode: GameMode;
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

  // Every other player in the round, keyed by player ID. Fed by loadGamePlayers
  // (DB truth) and by mark_updated broadcasts (live deltas).
  others: Record<string, OtherPlayer>;

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
    gameMode?: GameMode; // legacy game_started payloads omit it → 'honor'
    cardStyles?: CardStyles;
  }) => void;
  setMyCard: (card: SquareItem[]) => void;
  setCalledCount: (count: number) => void;
  toggleMark: (gridIndex: number) => void;
  addWinner: (winner: GameWinner) => void;
  setMyMarks: (marks: number[]) => void;
  setHasClaimed: (claimed: boolean) => void;
  setOthers: (list: OtherPlayer[]) => void;
  setOtherMarks: (playerId: string, marks: number[]) => void;
  resetGame: () => void;
}

const initial: Omit<GameState, keyof { initGame: unknown; setMyCard: unknown; setCalledCount: unknown; toggleMark: unknown; addWinner: unknown; setMyMarks: unknown; setHasClaimed: unknown; setOthers: unknown; setOtherMarks: unknown; resetGame: unknown }> = {
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
  gameMode: 'honor' as GameMode,
  cardStyles: {},
  myCard: [],
  myMarks: [],
  hasClaimed: false,
  gameStartedAt: null,
  winners: [],
  others: {},
};

export const useGameStore = create<GameState>((set, get) => ({
  ...initial,

  initGame: (params) =>
    set({
      ...params,
      gameMode: params.gameMode ?? 'honor',
      cardStyles: params.cardStyles ?? {},
      calledCount: 0,
      myCard: [],
      myMarks: [],
      hasClaimed: false,
      gameStartedAt: new Date().toISOString(),
      winners: [],
      // A new round means everyone's old board is meaningless; loadGamePlayers
      // repopulates this once the fresh game_players rows exist.
      others: {},
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

  setMyMarks: (myMarks) => set({ myMarks }),

  setHasClaimed: (hasClaimed) => set({ hasClaimed }),

  /**
   * Replace the DB-backed view of other players.
   *
   * Unsynced entries (created by presence, or by a mark_updated broadcast that
   * beat the fetch) are preserved when the incoming list doesn't mention them —
   * otherwise a fetch that races a join would erase someone from the rail.
   */
  setOthers: (list) => {
    const { others } = get();
    const next: Record<string, OtherPlayer> = {};
    for (const [id, entry] of Object.entries(others)) {
      if (!entry.synced) next[id] = entry;
    }
    for (const entry of list) next[entry.playerId] = entry;
    set({ others: next });
  },

  /**
   * Apply a live mark_updated broadcast. Creates a placeholder entry if the
   * broadcast arrives before the fetch, so no mark is ever dropped; the card
   * fills in when loadGamePlayers lands.
   */
  setOtherMarks: (playerId, marks) => {
    const { others } = get();
    const existing = others[playerId];
    set({
      others: {
        ...others,
        [playerId]: existing
          ? { ...existing, marks }
          : {
              playerId,
              displayName: 'Player',
              avatarUrl: null,
              card: [],
              marks,
              won: false,
              finishPosition: null,
              synced: true,
            },
      },
    });
  },

  resetGame: () => set({ ...initial }),
}));
