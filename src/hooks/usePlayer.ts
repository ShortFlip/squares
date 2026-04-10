'use client';

import { usePlayerStore } from '@/stores/playerStore';

/**
 * Returns the current player identity and loading state.
 * Initialization (DB lookup, anonymous auth, first-visit prompt) is handled
 * by PlayerProvider — this hook just reads the result from the Zustand store.
 *
 * Usage:
 *   const { player, isLoading } = usePlayer();
 *   if (isLoading) return <Spinner />;
 *   if (!player) return null; // shouldn't happen inside PlayerProvider
 */
export function usePlayer() {
  const { player, isLoading } = usePlayerStore();
  return { player, isLoading };
}
