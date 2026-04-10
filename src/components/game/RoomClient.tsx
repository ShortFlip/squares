'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { GameLobby } from './GameLobby';
import { GameView } from './GameView';
import { GameOver } from './GameOver';
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom';
import { usePlayer } from '@/hooks/usePlayer';
import { useGameStore } from '@/stores/gameStore';
import { createClient } from '@/lib/supabase/client';
import { generateCallList } from '@/lib/game/call-list';
import { checkWin } from '@/lib/game/win-detection';
import type { Room, WinPattern } from '@/types/game';
import type { SquareItem, CardStyles } from '@/types/card';

interface RoomClientProps {
  initialRoom: Room;
}

export function RoomClient({ initialRoom }: RoomClientProps) {
  const router = useRouter();
  const { player, isLoading } = usePlayer();
  const { presentPlayers, isConnected, playerMarks, broadcast } = useRealtimeRoom(
    initialRoom.join_code,
    player,
  );
  const { gameId, winners, resetGame } = useGameStore();

  // Transition lobby → game when game_started broadcast sets gameId
  useEffect(() => {
    if (gameId && initialRoom.status === 'waiting') {
      router.refresh();
    }
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Event handlers ────────────────────────────────────────────────────────

  async function handleStartGame(payload: {
    gameId: string;
    seed: string;
    roundNumber: number;
    callList: number[];
    templateItems: SquareItem[];
    boardSize: number;
    freeSpace: boolean;
    shuffleMode: 'full' | 'column';
    winPatterns: WinPattern[];
    cardStyles: CardStyles;
  }) {
    await broadcast('game_started', payload as unknown as Record<string, unknown>);
  }

  async function handleMarkSquare(marks: number[]) {
    if (!player) return;
    await broadcast('mark_updated', { playerId: player.id, marks });
  }

  async function handleBingoClaim() {
    if (!player) return;
    const { gameId: gid, myMarks, boardSize, freeSpace, winPatterns, winners: currentWinners } = useGameStore.getState();
    if (!gid) return;

    if (currentWinners.some((w) => w.playerId === player.id)) return;

    const pattern = checkWin(new Set(myMarks), boardSize, winPatterns, freeSpace);
    if (!pattern) {
      useGameStore.getState().setHasClaimed(false);
      return;
    }

    // Persist win to DB
    const supabase = createClient();
    const finishPosition = currentWinners.length + 1;
    const gameStartedAt = useGameStore.getState().gameStartedAt;
    const bingoTimeMs = gameStartedAt
      ? Date.now() - new Date(gameStartedAt).getTime()
      : null;

    supabase.from('game_players').update({
      won: true,
      marks: myMarks,
      finish_position: finishPosition,
      bingo_time_ms: bingoTimeMs,
    }).match({ game_id: gid, player_id: player.id })
      .then(({ error }) => { if (error) console.error('Failed to persist win:', error); });

    // Update game status on first winner
    if (currentWinners.length === 0) {
      supabase.from('games').update({
        status: 'won',
        win_pattern: pattern,
        ended_at: new Date().toISOString(),
      }).eq('id', gid)
        .then(({ error }) => { if (error) console.error('Failed to update game status:', error); });
    }

    await broadcast('bingo_confirmed', {
      playerId: player.id,
      displayName: player.display_name,
      pattern,
    });
  }

  async function handleNewRound() {
    if (!player || !initialRoom.template_id) return;
    try {
      const supabase = createClient();

      const { data: template } = await supabase
        .from('card_templates')
        .select('*')
        .eq('id', initialRoom.template_id)
        .single();

      if (!template) throw new Error('Template not found');

      const { gameId: prevGameId } = useGameStore.getState();
      if (prevGameId) {
        await supabase.from('games')
          .update({ status: 'won', ended_at: new Date().toISOString() })
          .eq('id', prevGameId);
      }

      const seed = crypto.randomUUID();
      const items = template.items as SquareItem[];
      const callList = generateCallList(items.length, seed);
      const settings = (initialRoom.settings as { winPatterns?: WinPattern[] } | null) ?? {};
      const winPatterns: WinPattern[] = settings.winPatterns ?? ['row', 'column', 'diagonal'];

      const { data: game, error } = await supabase
        .from('games')
        .insert({
          room_id: initialRoom.id,
          round_number: (useGameStore.getState().roundNumber ?? 0) + 1,
          call_list: callList,
          calls_made: 0,
          seed,
          status: 'active',
        })
        .select()
        .single();

      if (error || !game) throw error;

      await broadcast('game_started', {
        gameId: game.id,
        seed,
        roundNumber: game.round_number,
        callList,
        templateItems: items,
        boardSize: template.board_size,
        freeSpace: template.free_space,
        shuffleMode: template.shuffle_mode,
        winPatterns,
        cardStyles: (template.styles as CardStyles) ?? {},
      });
    } catch (err) {
      console.error('Failed to start new round:', err);
      toast.error('Could not start a new round.');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  // Show game over screen when room is finished OR when there are winners and
  // the host has not started a new round yet (covers the in-game win state)
  if (initialRoom.status === 'finished') {
    return (
      <GameOver
        room={initialRoom}
        currentPlayerId={player.id}
        presentPlayers={presentPlayers}
      />
    );
  }

  switch (initialRoom.status) {
    case 'waiting':
      return (
        <GameLobby
          room={initialRoom}
          currentPlayerId={player.id}
          presentPlayers={presentPlayers}
          isConnected={isConnected}
          onStartGame={handleStartGame}
        />
      );

    case 'playing':
      return (
        <GameView
          room={initialRoom}
          currentPlayerId={player.id}
          presentPlayers={presentPlayers}
          playerMarks={playerMarks}
          onMarkSquare={handleMarkSquare}
          onBingoClaim={handleBingoClaim}
          onNewRound={handleNewRound}
        />
      );

    default:
      return null;
  }
}
