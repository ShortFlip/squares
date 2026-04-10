'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Player } from '@/types/player';

export interface PresencePlayer {
  playerId: string;
  displayName: string;
  joinedAt: string;
}

interface UseRoomPresenceResult {
  presentPlayers: PresencePlayer[];
  isConnected: boolean;
}

/**
 * Tracks who is currently in the lobby for a given room code.
 * Uses Supabase Realtime presence — lightweight, no DB writes needed just to "be in the lobby".
 * Players are removed automatically when they navigate away or disconnect.
 */
export function useRoomPresence(
  roomCode: string,
  player: Player | null,
): UseRoomPresenceResult {
  const [presentPlayers, setPresentPlayers] = useState<PresencePlayer[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!player || !roomCode) return;

    const supabase = createClient();

    // Channel name matches the Realtime broadcast pattern used throughout the game engine
    const channel = supabase.channel(`room:${roomCode}`, {
      config: { presence: { key: player.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePlayer>();
        // presenceState returns { [key: string]: PresencePlayer[] } — flatten to a list
        const players = Object.values(state).flat();
        setPresentPlayers(players);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          await channel.track({
            playerId: player.id,
            displayName: player.display_name,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, player]);

  return { presentPlayers, isConnected };
}
