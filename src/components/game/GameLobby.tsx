'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Play } from 'lucide-react';
import { RoomCodeDisplay } from '@/components/layout/RoomCodeDisplay';
import { PlayerList } from './PlayerList';
import { createClient } from '@/lib/supabase/client';
import { generateCallList } from '@/lib/game/call-list';
import { Button } from '@/components/ui/button';
import type { Room, WinPattern } from '@/types/game';
import type { PresencePlayer } from '@/hooks/useRealtimeRoom';
import type { CardStyles } from '@/types/card';

interface GameLobbyProps {
  room: Room;
  currentPlayerId: string;
  presentPlayers: PresencePlayer[];
  isConnected: boolean;
  onStartGame: (payload: {
    gameId: string;
    seed: string;
    roundNumber: number;
    callList: number[];
    templateItems: { text?: string; imageUrl?: string; clue?: string }[];
    boardSize: number;
    freeSpace: boolean;
    shuffleMode: 'full' | 'column';
    winPatterns: WinPattern[];
    cardStyles: CardStyles;
  }) => Promise<void>;
}

export function GameLobby({
  room,
  currentPlayerId,
  presentPlayers,
  isConnected,
  onStartGame,
}: GameLobbyProps) {
  const [isStarting, setIsStarting] = useState(false);
  const isHost = currentPlayerId === room.host_id;

  async function handleStartGame() {
    if (!room.template_id) {
      toast.error('This room has no card template set.');
      return;
    }
    setIsStarting(true);
    try {
      const supabase = createClient();

      // Fetch the card template to get items, board config
      const { data: template, error: templateError } = await supabase
        .from('card_templates')
        .select('*')
        .eq('id', room.template_id)
        .single();

      if (templateError || !template) throw templateError ?? new Error('Template not found');

      const seed = crypto.randomUUID();
      const items = template.items as { text?: string; imageUrl?: string; clue?: string }[];
      const callList = generateCallList(items.length, seed);

      const settings = (room.settings as { winPatterns?: WinPattern[] } | null) ?? {};
      const winPatterns: WinPattern[] = settings.winPatterns ?? ['row', 'column', 'diagonal'];

      // Create the game record in the DB
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          room_id: room.id,
          round_number: 1,
          call_list: callList,
          calls_made: 0,
          seed,
          status: 'active',
        })
        .select()
        .single();

      if (gameError || !game) throw gameError ?? new Error('Failed to create game');

      // Update room status to 'playing' — triggers router.refresh() on all clients via postgres_changes
      const { error: roomError } = await supabase.from('rooms').update({ status: 'playing' }).eq('id', room.id);
      if (roomError) throw roomError;

      // Broadcast game_started — all clients (including host via self:true) initialize state
      await onStartGame({
        gameId: game.id,
        seed,
        roundNumber: 1,
        callList,
        templateItems: items,
        boardSize: template.board_size,
        freeSpace: template.free_space,
        shuffleMode: template.shuffle_mode as 'full' | 'column',
        winPatterns,
        cardStyles: (template.styles as CardStyles) ?? {},
      });
    } catch (err) {
      console.error('Failed to start game:', err);
      toast.error('Could not start the game. Try again.');
      setIsStarting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">

        {/* Room code */}
        <div className="text-center space-y-1">
          {room.name && (
            <p className="text-muted-foreground text-sm uppercase tracking-widest">{room.name}</p>
          )}
          <RoomCodeDisplay code={room.join_code} />
        </div>

        {/* Connection dot */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            {isConnected ? 'Connected' : 'Connecting…'}
          </div>
        </div>

        {/* Players */}
        <div className="bg-card/50 rounded-xl border border-border p-5">
          {presentPlayers.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              Waiting for players to join…
            </p>
          ) : (
            <PlayerList players={presentPlayers} hostId={room.host_id} />
          )}
        </div>

        {/* Start / waiting */}
        <div className="flex flex-col items-center gap-3">
          {isHost ? (
            <>
              <Button
                size="lg"
                className="w-full max-w-xs gap-2"
                onClick={handleStartGame}
                disabled={isStarting || presentPlayers.length < 2}
              >
                {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isStarting ? 'Starting…' : 'Start Game'}
              </Button>
              {presentPlayers.length < 2 && (
                <p className="text-xs text-muted-foreground">Need at least one other player</p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Waiting for the host to start…</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
