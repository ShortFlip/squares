'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { generateCard } from '@/lib/game/shuffle';
import { useGameStore } from '@/stores/gameStore';
import type { Player } from '@/types/player';
import type { SquareItem, CardStyles } from '@/types/card';
import type { WinPattern, GameMode } from '@/types/game';

export interface PresencePlayer {
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
}

interface GameStartedPayload {
  gameId: string;
  seed: string;
  roundNumber: number;
  callList: number[];
  templateItems: SquareItem[];
  boardSize: number;
  freeSpace: boolean;
  shuffleMode: 'full' | 'column';
  winPatterns: WinPattern[];
  gameMode?: GameMode;
  cardStyles?: CardStyles;
}

interface ItemCalledPayload {
  callsMade: number;
}

interface BingoConfirmedPayload {
  playerId: string;
  displayName: string;
  pattern: WinPattern;
}

interface MarkUpdatedPayload {
  playerId: string;
  marks: number[];
}

/**
 * Unified Realtime hook — handles both lobby presence and in-game events.
 * Replaces the simpler useRoomPresence for all room states.
 *
 * Uses `self: true` in broadcast config so the host also receives the
 * game_started event they broadcast, allowing uniform state initialization.
 */
export function useRealtimeRoom(
  roomCode: string,
  // Room UUID — needed to filter the postgres_changes subscriptions below.
  roomId: string,
  player: Player | null,
  // Fired when the room's lifecycle changes: the room_closed broadcast, or the
  // postgres_changes fallback seeing rooms.status change. Kept in a ref so a new
  // callback identity doesn't tear down and resubscribe the channel.
  onRoomClosed?: () => void,
) {
  const [presentPlayers, setPresentPlayers] = useState<PresencePlayer[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  // Live mark state for all players — updated via mark_updated broadcasts
  const [playerMarks, setPlayerMarks] = useState<Record<string, number[]>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onRoomClosedRef = useRef(onRoomClosed);
  // Last rooms.status we acted on, so a duplicate UPDATE (or one that merely
  // touched another column) doesn't trigger a redundant refresh.
  const lastRoomStatusRef = useRef<string | null>(null);
  useEffect(() => {
    onRoomClosedRef.current = onRoomClosed;
  }, [onRoomClosed]);

  const { initGame, setMyCard, setCalledCount, addWinner } = useGameStore();

  useEffect(() => {
    if (!player) return;

    const supabase = createClient();
    const channel = supabase.channel(`room:${roomCode}`, {
      config: {
        // self: true so the broadcaster also receives their own game events
        broadcast: { self: true },
        presence: { key: player.id },
      },
    });

    channel
      // ── Presence (lobby player list) ──────────────────────────────────────
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePlayer>();
        setPresentPlayers(Object.values(state).flat());
      })

      // ── Game events ───────────────────────────────────────────────────────
      .on('broadcast', { event: 'game_started' }, async ({ payload }: { payload: GameStartedPayload }) => {
        initGame(payload);
        // Clear other players' marks so the sidebar doesn't show stale data
        setPlayerMarks({});
        // Generate this player's card from the shared seed + their unique ID
        const card = generateCard(
          payload.templateItems,
          payload.seed,
          player.id,
          payload.boardSize,
          payload.shuffleMode,
          payload.freeSpace,
        );
        setMyCard(card);

        // Persist this player's game_players record so the Edge Function
        // can verify wins and the DB has a record of who played.
        // Fire-and-forget — don't block the game start on this write.
        supabase.from('game_players').upsert(
          {
            game_id: payload.gameId,
            player_id: player.id,
            card_data: card as unknown as import('@/lib/supabase/types').Json,
            marks: [],
            won: false,
          },
          { onConflict: 'game_id,player_id' },
        ).then(({ error }) => {
          if (error) {
            console.error('Failed to create game_players record:', error);
            // Generic copy — never surface raw DB error text to players.
            toast.error('Your card could not be saved. Stats may be missing.');
          }
        });
      })

      .on('broadcast', { event: 'item_called' }, ({ payload }: { payload: ItemCalledPayload }) => {
        setCalledCount(payload.callsMade);
      })

      .on('broadcast', { event: 'bingo_confirmed' }, ({ payload }: { payload: BingoConfirmedPayload }) => {
        addWinner(payload);
      })

      .on('broadcast', { event: 'mark_updated' }, ({ payload }: { payload: MarkUpdatedPayload }) => {
        setPlayerMarks((prev) => ({ ...prev, [payload.playerId]: payload.marks }));
      })

      // Host ended the game night — rooms.status is now 'finished' in the DB,
      // so clients re-render the server component to reach the GameOver screen.
      .on('broadcast', { event: 'room_closed' }, () => {
        onRoomClosedRef.current?.();
      })

      // ── postgres_changes fallback ─────────────────────────────────────────
      // Broadcasts are fire-and-forget: a tab that was asleep or briefly
      // disconnected never sees them. These DB subscriptions replay the two
      // pieces of state that actually matter (room lifecycle, call progress)
      // so such a client self-heals instead of sitting on a stale screen.
      // Both handlers are idempotent and dedupe against current state, so a
      // client that DID get the broadcast does nothing extra here.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        ({ new: row }: { new: { status?: string } }) => {
          const status = row?.status;
          if (!status || status === lastRoomStatusRef.current) return;
          lastRoomStatusRef.current = status;
          // Same handler as room_closed: re-render the server component so the
          // right screen (lobby / board / game over) is chosen from the new status.
          onRoomClosedRef.current?.();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `room_id=eq.${roomId}` },
        ({ new: row }: { new: { id?: string; calls_made?: number } }) => {
          const store = useGameStore.getState();
          // Ignore rows for a different round than the one we're rendering.
          if (!row?.id || row.id !== store.gameId) return;
          if (typeof row.calls_made !== 'number') return;
          // Never rewind: the broadcast may already have moved us further along.
          if (row.calls_made <= store.calledCount) return;
          store.setCalledCount(row.calls_made);
        },
      )

      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          await channel.track({
            playerId: player.id,
            displayName: player.display_name,
            avatarUrl: player.avatar_url ?? null,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
    // Only re-subscribe on identity changes; the store setters and the
    // onRoomClosed callback are read through refs/getState on purpose.
  }, [roomCode, roomId, player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Send a broadcast event to the room channel */
  async function broadcast(event: string, payload: Record<string, unknown>) {
    await channelRef.current?.send({ type: 'broadcast', event, payload });
  }

  return { presentPlayers, isConnected, playerMarks, broadcast };
}
