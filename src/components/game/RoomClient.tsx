'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { GameLobby } from './GameLobby';
import { GameView } from './GameView';
import { GameOver } from './GameOver';
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom';
import { usePlayer } from '@/hooks/usePlayer';
import { useGameStore } from '@/stores/gameStore';
import { createClient } from '@/lib/supabase/client';
import { generateCard } from '@/lib/game/shuffle';
import { buildGameSetup } from '@/lib/game/game-setup';
import { loadGamePlayers } from '@/lib/game/game-players';
import { saveLastRoom, clearLastRoom } from '@/lib/utils/last-room';
import { checkWin } from '@/lib/game/win-detection';
import type { Room, WinPattern, GameMode } from '@/types/game';
import type { SquareItem, CardStyles } from '@/types/card';

interface RoomClientProps {
  initialRoom: Room;
}

export function RoomClient({ initialRoom }: RoomClientProps) {
  const router = useRouter();
  const { player, isLoading } = usePlayer();
  const { presentPlayers, isConnected, connection, broadcast } = useRealtimeRoom(
    initialRoom.join_code,
    initialRoom.id,
    player,
    // room_closed → re-render the server component so status 'finished' shows GameOver
    () => router.refresh(),
  );
  const { gameId } = useGameStore();

  // DEV-only handle so the store can be inspected from Playwright during
  // verification. Stripped from production builds by the NODE_ENV check.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __squares?: unknown }).__squares = useGameStore;
    }
  }, []);

  // Remember this room for the landing page's Rejoin chip, and forget it once
  // the night is over. DESIGN.md: "Never make me type a room code I was
  // already in."
  useEffect(() => {
    if (initialRoom.status === 'finished') {
      clearLastRoom();
    } else {
      saveLastRoom(initialRoom.join_code, initialRoom.name);
    }
  }, [initialRoom.status, initialRoom.join_code, initialRoom.name]);

  // Everyone else's boards come from the database, not from broadcasts we may
  // have missed. Re-read them whenever the round changes or we land on a room
  // that is already in progress. (The hook also re-reads on every regained
  // SUBSCRIBED and right after the game_started upsert.)
  useEffect(() => {
    if (initialRoom.status !== 'playing' || !gameId || !player) return;
    loadGamePlayers(createClient(), gameId, player.id);
  }, [initialRoom.status, gameId, player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce timer for persisting marks to game_players — marks change on every
  // tap, but the DB only needs the latest snapshot (used for reconnect restore).
  const persistMarksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (persistMarksTimer.current) clearTimeout(persistMarksTimer.current);
  }, []);

  // Transition lobby → game (and Game Over → game, when the host hits "Play
  // Again") once a game_started broadcast puts a gameId in the store. The
  // server component still holds the old rooms.status, so re-render it.
  useEffect(() => {
    if (gameId && initialRoom.status !== 'playing') {
      router.refresh();
    }
  }, [gameId, initialRoom.status, router]);

  // Reconnect: if the room is already playing but our store is empty (e.g. tab was
  // closed mid-game), fetch the active game from the DB and rebuild state locally.
  // Card generation is deterministic (seed + playerId) so we get the exact same card
  // the player had before closing the tab.
  useEffect(() => {
    if (initialRoom.status !== 'playing' || gameId || !player) return;

    const playerId = player.id; // capture before async so TypeScript is happy

    async function reconnect() {
      const supabase = createClient();

      // Get the most recent game for this room (could be active or just won)
      const { data: game } = await supabase
        .from('games')
        .select('*')
        .eq('room_id', initialRoom.id)
        .order('round_number', { ascending: false })
        .limit(1)
        .single();

      if (!game || !initialRoom.template_id) return;

      const { data: template } = await supabase
        .from('card_templates')
        .select('*')
        .eq('id', initialRoom.template_id)
        .single();

      if (!template) return;

      // Same bootstrap the lobby/new-round paths use, seeded from the existing
      // game so the item filter (and therefore indices) can't drift.
      const setup = buildGameSetup(template, initialRoom.settings, game.seed);
      const items = setup.items;

      const { initGame, setMyCard, setCalledCount, setMyMarks } = useGameStore.getState();

      initGame({
        gameId: game.id,
        seed: game.seed,
        roundNumber: game.round_number,
        // The persisted call list wins over a regenerated one — it's what the
        // host has actually been calling from.
        callList: game.call_list as number[],
        templateItems: items,
        boardSize: setup.boardSize,
        freeSpace: setup.freeSpace,
        shuffleMode: setup.shuffleMode,
        winPatterns: setup.winPatterns,
        gameMode: setup.gameMode,
        cardStyles: setup.cardStyles,
      });

      // Restore how far the host has called
      setCalledCount(game.calls_made);

      // Restore winners BEFORE marks — if this player already won, the winners
      // list (and hasClaimed) must be populated before the marks land, or the
      // auto-claim effect in GameView re-fires and re-writes finish_position.
      const { data: wonRows } = await supabase
        .from('game_players')
        .select('player_id, finish_position, players(display_name)')
        .eq('game_id', game.id)
        .eq('won', true)
        .order('finish_position', { ascending: true });

      if (wonRows) {
        const { addWinner, setHasClaimed } = useGameStore.getState();
        for (const row of wonRows) {
          addWinner({
            playerId: row.player_id,
            displayName: (row.players as { display_name: string } | null)?.display_name ?? 'Player',
            // Only the first winner's pattern is stored on the game — close enough
            // for the overlay label after a refresh.
            pattern: (game.win_pattern as WinPattern | null) ?? 'row',
          });
          if (row.player_id === playerId) setHasClaimed(true);
        }
      }

      // Regenerate the card — same seed + playerId always produces the same layout
      const card = generateCard(
        items,
        game.seed,
        playerId,
        setup.boardSize,
        setup.shuffleMode,
        setup.freeSpace,
      );
      setMyCard(card);

      // Restore any marks the player had already made
      const { data: gamePlayer } = await supabase
        .from('game_players')
        .select('marks')
        .match({ game_id: game.id, player_id: playerId })
        .single();

      if (gamePlayer?.marks) {
        setMyMarks(gamePlayer.marks as number[]);
      } else {
        // Player is joining this game for the first time (joined room after game started)
        supabase.from('game_players').upsert(
          { game_id: game.id, player_id: playerId, card_data: card as unknown as import('@/lib/supabase/types').Json, marks: [], won: false },
          { onConflict: 'game_id,player_id' },
        ).then(({ error }) => {
          if (error) {
            console.error('Failed to create game_players on reconnect:', error);
            // Generic copy — never surface raw DB error text to players.
            toast.error('Could not join this round. Try refreshing.');
          }
        });
      }
    }

    reconnect().catch((err) => console.error('Reconnect failed:', err));
    // Deps are deliberately narrowed to the identity fields: `initialRoom` is a
    // fresh object on every server re-render, so depending on it (or on
    // `initialRoom.settings`) would re-run this whole reconnect fetch on every
    // router.refresh().
  }, [initialRoom.status, initialRoom.id, initialRoom.template_id, player?.id, gameId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    gameMode: GameMode;
    cardStyles: CardStyles;
  }) {
    await broadcast('game_started', payload as unknown as Record<string, unknown>);
  }

  // Traditional mode: CallerPanel has already persisted calls_made to the DB —
  // this just fans the new count out to every player in the room.
  async function handleCallNext(callsMade: number) {
    await broadcast('item_called', { callsMade });
  }

  async function handleMarkSquare(marks: number[]) {
    if (!player) return;
    const playerId = player.id;
    await broadcast('mark_updated', { playerId, marks });

    // Persist marks (debounced) so a refresh mid-game can restore them.
    // Reads the latest marks from the store at fire time — rapid taps collapse
    // into one write with the final state.
    if (persistMarksTimer.current) clearTimeout(persistMarksTimer.current);
    persistMarksTimer.current = setTimeout(() => {
      const { gameId: gid, myMarks } = useGameStore.getState();
      if (!gid) return;
      createClient()
        .from('game_players')
        .update({ marks: myMarks })
        .match({ game_id: gid, player_id: playerId })
        .then(({ error }) => {
          if (error) {
            console.error('Failed to persist marks:', error);
            // Marks still live in the store, but a refresh would lose them.
            toast.error('Your marks could not be saved. Avoid refreshing.');
          }
        });
    }, 500);
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
      .then(({ error }) => {
        if (error) {
          console.error('Failed to persist win:', error);
          toast.error('Your win was announced but not recorded in stats.');
        }
      });

    // Update game status on first winner
    if (currentWinners.length === 0) {
      supabase.from('games').update({
        status: 'won',
        win_pattern: pattern,
        ended_at: new Date().toISOString(),
      }).eq('id', gid)
        .then(({ error }) => {
          if (error) {
            console.error('Failed to update game status:', error);
            toast.error('Round result could not be saved.');
          }
        });
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

      // Close out the previous round. If someone won, handleBingoClaim already
      // marked the game 'won' — only rounds abandoned with zero winners need a
      // status, and that's 'cancelled' so stats never count a phantom win.
      const { gameId: prevGameId, winners: prevWinners } = useGameStore.getState();
      if (prevGameId && prevWinners.length === 0) {
        await supabase.from('games')
          .update({ status: 'cancelled', ended_at: new Date().toISOString() })
          .eq('id', prevGameId);
      }

      // Shared bootstrap: item filter + settings parse + fresh seed/call list
      const setup = buildGameSetup(template, initialRoom.settings);
      const { seed, items, callList } = setup;

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
        boardSize: setup.boardSize,
        freeSpace: setup.freeSpace,
        shuffleMode: setup.shuffleMode,
        winPatterns: setup.winPatterns,
        gameMode: setup.gameMode,
        cardStyles: setup.cardStyles,
      });

      // If we're coming back from the 'finished' state (host hit "Play Again"
      // on the Game Over screen), the room row still says 'finished' — flip it
      // back so a refresh/late joiner lands on the board, not Game Over.
      if (initialRoom.status !== 'playing') {
        const { error: roomError } = await supabase
          .from('rooms')
          .update({ status: 'playing' })
          .eq('id', initialRoom.id);
        if (roomError) throw roomError;
        // room_reopened isn't a thing — game_started above already moved every
        // client's store; the refresh swaps the server-rendered shell.
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to start new round:', err);
      toast.error('Could not start a new round.');
    }
  }

  // Host wraps up the night: room goes to 'finished' (the previously unreachable
  // GameOver state) and every client refreshes via the room_closed broadcast.
  async function handleEndGame() {
    if (!player) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', initialRoom.id);
      if (error) throw error;

      await broadcast('room_closed', {});
      router.refresh();
    } catch (err) {
      console.error('Failed to end game:', err);
      toast.error('Could not end the game.');
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
        // Host can restart from the finished state; GameOver hides the button
        // for non-hosts and shows a "waiting for the host" line instead.
        onNewRound={handleNewRound}
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
          connection={connection}
          onMarkSquare={handleMarkSquare}
          onBingoClaim={handleBingoClaim}
          onNewRound={handleNewRound}
          onEndGame={handleEndGame}
          onCallNext={handleCallNext}
        />
      );

    default:
      return null;
  }
}
