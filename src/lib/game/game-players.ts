import { toast } from 'sonner';
import { useGameStore, type OtherPlayer } from '@/stores/gameStore';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Read every other player's row for a round out of the database and push it
 * into the store.
 *
 * Other players' marks arrive live over `mark_updated` broadcasts, but a
 * broadcast is fire-and-forget: a client that joined late, refreshed, or lost
 * the socket never saw the earlier ones. DESIGN.md treats "their miniature
 * shows 0/25 after a refresh" as an unacceptable failure, so the DB — which
 * every client writes its own marks to on a 500 ms debounce — is the recovery
 * source. Called on mount, after the local upsert that follows `game_started`,
 * and every time the channel regains SUBSCRIBED.
 */
export async function loadGamePlayers(
  supabase: SupabaseClient<Database>,
  gameId: string,
  selfPlayerId: string,
): Promise<void> {
  // The FK hint disambiguates the join: game_players references players twice
  // is not the case today, but naming the constraint keeps this stable if it
  // ever gains a second player reference.
  const { data, error } = await supabase
    .from('game_players')
    .select('player_id, card_data, marks, won, finish_position, players!game_players_player_id_fkey(display_name, avatar_url)')
    .eq('game_id', gameId);

  if (error) {
    console.error('Failed to load other players:', error);
    // Generic copy — never surface raw DB error text. The store is left as it
    // was so a transient failure doesn't wipe boards we already have.
    toast.error("Couldn't load other boards");
    return;
  }

  const others: OtherPlayer[] = (data ?? [])
    .filter((row) => row.player_id !== selfPlayerId)
    .map((row) => {
      const profile = row.players as { display_name: string; avatar_url: string | null } | null;
      return {
        playerId: row.player_id,
        displayName: profile?.display_name ?? 'Player',
        avatarUrl: profile?.avatar_url ?? null,
        card: (row.card_data ?? []) as OtherPlayer['card'],
        marks: (row.marks ?? []) as number[],
        won: row.won,
        finishPosition: row.finish_position,
        synced: true,
      };
    });

  useGameStore.getState().setOthers(others);
}
