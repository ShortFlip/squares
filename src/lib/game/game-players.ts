import { toast } from 'sonner';
import { useGameStore, type OtherPlayer } from '@/stores/gameStore';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { WinPattern } from '@/types/game';

/**
 * Read every player's row for a round out of the database and push it into
 * the store: other players' boards into `others`, and every winner (ourselves
 * included) into `winners`.
 *
 * Other players' marks arrive live over `mark_updated` broadcasts, but a
 * broadcast is fire-and-forget: a client that joined late, refreshed, or lost
 * the socket never saw the earlier ones. DESIGN.md treats "their miniature
 * shows 0/25 after a refresh" as an unacceptable failure, so the DB — which
 * every client writes its own marks to on a 500 ms debounce — is the recovery
 * source. The same goes for `bingo_confirmed`: a missed bingo announcement is
 * not tolerated either, so the won rows are replayed as winners here.
 * Called on mount, after the local upsert that follows `game_started`, and
 * every time the channel regains SUBSCRIBED.
 *
 * Returns false when the read failed, so a caller that must not act on a
 * partial picture (the rejoin path, before it restores marks) can retry.
 */
export async function loadGamePlayers(
  supabase: SupabaseClient<Database>,
  gameId: string,
  selfPlayerId: string,
  { quiet = false }: { quiet?: boolean } = {},
): Promise<boolean> {
  // The FK hint disambiguates the join: game_players references players twice
  // is not the case today, but naming the constraint keeps this stable if it
  // ever gains a second player reference. `games(win_pattern)` rides along so
  // replayed winners get the round's pattern without a second query.
  const { data, error } = await supabase
    .from('game_players')
    .select('player_id, card_data, marks, won, finish_position, players!game_players_player_id_fkey(display_name, avatar_url), games!game_players_game_id_fkey(win_pattern)')
    .eq('game_id', gameId);

  if (error) {
    console.error('Failed to load other players:', error);
    // Generic copy — never surface raw DB error text. The store is left as it
    // was so a transient failure doesn't wipe boards we already have. A caller
    // that retries passes `quiet` and does its own single warning.
    if (!quiet) toast.error("Couldn't load other boards");
    return false;
  }

  const store = useGameStore.getState();
  // A slow read can land after the host has already started the next round;
  // its boards and winners belong to the old round and must not leak in.
  if (store.gameId !== gameId) return true;

  const rows = data ?? [];

  // Winners first, in finishing order, so the rail's gold cards and the banner
  // agree with the DB even for a tab that missed every bingo_confirmed.
  // addWinner is idempotent, so a winner we already heard about is a no-op.
  const wonRows = rows
    .filter((row) => row.won)
    .sort((a, b) => (a.finish_position ?? Infinity) - (b.finish_position ?? Infinity));
  for (const row of wonRows) {
    const profile = row.players as { display_name: string } | null;
    const game = row.games as { win_pattern: string | null } | null;
    store.addWinner({
      playerId: row.player_id,
      displayName: profile?.display_name ?? 'Player',
      // Only the first winner's pattern is stored on the game — close enough
      // for the banner label after a replay.
      pattern: (game?.win_pattern as WinPattern | null) ?? 'row',
      finishPosition: row.finish_position ?? undefined,
    });
    // Our own win in the DB means the auto-claim must not fire again and
    // rewrite finish_position when our marks are restored.
    if (row.player_id === selfPlayerId) store.setHasClaimed(true);
  }

  const others: OtherPlayer[] = rows
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

  store.setOthers(others);
  return true;
}
