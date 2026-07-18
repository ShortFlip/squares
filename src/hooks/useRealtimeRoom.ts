'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
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
  player: Player | null,
  // Fired when the host closes the room (room_closed broadcast). Kept in a ref
  // so a new callback identity doesn't tear down and resubscribe the channel.
  onRoomClosed?: () => void,
) {
  const [presentPlayers, setPresentPlayers] = useState<PresencePlayer[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  // Live mark state for all players — updated via mark_updated broadcasts
  const [playerMarks, setPlayerMarks] = useState<Record<string, number[]>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onRoomClosedRef = useRef(onRoomClosed);
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
          if (error) console.error('Failed to create game_players record:', error);
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
  }, [roomCode, player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Send a broadcast event to the room channel */
  async function broadcast(event: string, payload: Record<string, unknown>) {
    await channelRef.current?.send({ type: 'broadcast', event, payload });
  }

  return { presentPlayers, isConnected, playerMarks, broadcast };
}
