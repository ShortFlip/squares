import { create } from 'zustand';
import type { Player } from '@/types/player';

interface PlayerState {
  player: Player | null;
  // True during the async identity resolution on first load
  isLoading: boolean;
  setPlayer: (player: Player) => void;
  setLoading: (loading: boolean) => void;
  // Merge partial updates into the current player (e.g. after profile save)
  updatePlayer: (updates: Partial<Player>) => void;
  clearPlayer: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  player: null,
  isLoading: true,

  setPlayer: (player) => set({ player, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),

  updatePlayer: (updates) => {
    const { player } = get();
    if (player) set({ player: { ...player, ...updates } });
  },

  // Used on sign-out — resets to unauthenticated state
  clearPlayer: () => set({ player: null, isLoading: false }),
}));
