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
import { withRetry, RETRY_DELAYS_MS } from '@/lib/utils/retry';
import type { Json, Tables } from '@/lib/supabase/types';
import type { Room, WinPattern, GameMode } from '@/types/game';
import type { SquareItem, CardStyles } from '@/types/card';

interface RoomClientProps {
  initialRoom: Room;
}

export function RoomClient({ initialRoom }: RoomClientProps) {
  const router = useRouter();
  const { player, isLoading } = usePlayer();
  // The DB bootstrap below, reachable from the hook. A ref (set in an effect)
  // rather than the function itself so the hook's channel never resubscribes
  // just because this component re-rendered.
  const restoreRoundRef = useRef<(() => Promise<void>) | null>(null);
  const { presentPlayers, connection, broadcast } = useRealtimeRoom(
    initialRoom.join_code,
    initialRoom.id,
    player,
    // room_closed → re-render the server component so status 'finished' shows GameOver
    () => router.refresh(),
    // A newer round exists that we never got game_started for → load it from the DB.
    () => {
      restoreRoundRef.current?.().catch((err) => console.error('Round restore failed:', err));
    },
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

  // Guards restoreLatestRound: the mount effect, a games INSERT and a regained
  // SUBSCRIBED can all ask for it within a second of each other. A request
  // that arrives mid-restore is remembered and run once the current one ends,
  // so a round inserted during a restore is not skipped.
  const restoringRef = useRef(false);
  const restoreAgainRef = useRef(false);

  /**
   * Rebuild this player's view of the room's latest round from the DB: the
   * rejoin path (tab closed mid-game, refresh) and the catch-up path (a new
   * round started while our socket was down). Card generation is deterministic
   * (seed + playerId), so we get the exact card the player had before.
   *
   * Every read retries on its own short backoff, and a failed read never falls
   * through to a write: treating "couldn't read my row" as "I have no row" is
   * exactly how a refresh used to wipe a board and un-win a winner.
   */
  async function restoreLatestRound() {
    if (!player || !initialRoom.template_id) return;
    if (restoringRef.current) {
      restoreAgainRef.current = true;
      return;
    }
    restoringRef.current = true;
    try {
      do {
        restoreAgainRef.current = false;
        await restoreOnce(player.id, initialRoom.template_id);
      } while (restoreAgainRef.current);
    } finally {
      restoringRef.current = false;
    }
  }

  async function restoreOnce(playerId: string, templateId: string) {
    const supabase = createClient();
    // One heads-up per restore, not one per retry.
    let warned = false;
    const warnOnce = () => {
      if (warned) return;
      warned = true;
      toast.error('Having trouble reaching the game. Retrying…');
    };

    // The live round is the most recently started one. round_number is not
    // unique in older data, so ordering by it could pick a finished round.
    const gameRead = await withRetry<Tables<'games'> | null>(async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('room_id', initialRoom.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('Failed to read the current round:', error);
        return { ok: false };
      }
      return { ok: true, value: data };
    }, RETRY_DELAYS_MS, warnOnce);
    if (!gameRead.ok) {
      toast.error("Couldn't load this round. Try refreshing.");
      return;
    }
    const game = gameRead.value;
    if (!game) return;
    // The game_started broadcast may have got us here first.
    if (useGameStore.getState().gameId === game.id) return;

    const templateRead = await withRetry<Tables<'card_templates'>>(async () => {
      const { data, error } = await supabase
        .from('card_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      if (error || !data) {
        console.error('Failed to read the card template:', error);
        return { ok: false };
      }
      return { ok: true, value: data };
    }, RETRY_DELAYS_MS, warnOnce);
    if (!templateRead.ok) {
      toast.error("Couldn't load this round. Try refreshing.");
      return;
    }
    const template = templateRead.value;
    if (useGameStore.getState().gameId === game.id) return;

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

    // Restore winners (ourselves included) BEFORE marks — if this player
    // already won, the winners list and hasClaimed must be populated before
    // the marks land, or the auto-claim effect in GameView re-fires and
    // re-writes finish_position. So a failed read here also stops the restore.
    const othersRead = await withRetry<null>(
      async () => ((await loadGamePlayers(supabase, game.id, playerId, { quiet: true }))
        ? { ok: true, value: null }
        : { ok: false }),
      RETRY_DELAYS_MS,
      warnOnce,
    );
    if (!othersRead.ok) {
      toast.error("Couldn't restore this round. Try refreshing.");
      return;
    }
    // The host moved on while we were reading; that round's restore owns the store now.
    if (useGameStore.getState().gameId !== game.id) return;

    // Our own row. maybeSingle() separates the two cases the old .single()
    // lumped together: `data: null` with no error is a genuine first join,
    // an error is a failed read and must never lead to a write.
    const ownRead = await withRetry<{ marks: Json } | null>(async () => {
      const { data, error } = await supabase
        .from('game_players')
        .select('marks')
        .match({ game_id: game.id, player_id: playerId })
        .maybeSingle();
      if (error) {
        console.error('Failed to read own game_players row:', error);
        return { ok: false };
      }
      return { ok: true, value: data };
    }, RETRY_DELAYS_MS, warnOnce);
    if (!ownRead.ok) {
      toast.error("Couldn't restore your marks. Try refreshing.");
      return;
    }
    if (useGameStore.getState().gameId !== game.id) return;

    if (ownRead.value) {
      setMyMarks((ownRead.value.marks ?? []) as number[]);
      return;
    }

    // Player is joining this round for the first time (joined the room after
    // it started, or missed game_started). ignoreDuplicates: if a row appeared
    // since the read (the broadcast path raced us), it stays untouched.
    const { error: insertError } = await supabase.from('game_players').upsert(
      { game_id: game.id, player_id: playerId, card_data: card as unknown as Json, marks: [], won: false },
      { onConflict: 'game_id,player_id', ignoreDuplicates: true },
    );
    if (insertError) {
      console.error('Failed to create game_players on reconnect:', insertError);
      // Generic copy — never surface raw DB error text to players.
      toast.error('Could not join this round. Try refreshing.');
    }
  }

  // Keep the hook's handle on the latest closure (player, room settings).
  useEffect(() => {
    restoreRoundRef.current = restoreLatestRound;
  });

  // Rejoin: the room is already playing but our store is empty (tab was closed
  // mid-game, or a refresh).
  useEffect(() => {
    if (initialRoom.status !== 'playing' || gameId || !player) return;
    restoreLatestRound().catch((err) => console.error('Reconnect failed:', err));
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
    // Not awaited: with broadcast acks on, a send can wait out the socket
    // timeout on a dying connection, and the DB write below must not queue
    // behind it. A failed send is queued by the hook and flushed on reconnect.
    void broadcast('mark_updated', { gameId: useGameStore.getState().gameId, playerId, marks });

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

    const supabase = createClient();
    const finishPosition = currentWinners.length + 1;
    const gameStartedAt = useGameStore.getState().gameStartedAt;
    const bingoTimeMs = gameStartedAt
      ? Date.now() - new Date(gameStartedAt).getTime()
      : null;

    // Our own banner, fanfare and confetti come from here, not from the
    // self-echo of the broadcast below: if the channel is mid-reconnect there
    // is no echo, and the winner must never be the one tab that doesn't know.
    // The echo and the DB replay are then no-ops (addWinner is idempotent).
    useGameStore.getState().addWinner({
      playerId: player.id,
      displayName: player.display_name,
      pattern,
      finishPosition,
    });

    // Persist the win. The DB row is what loadGamePlayers replays to any tab
    // that missed the broadcast, so a blip must not lose it: retry on the
    // shared backoff, and only tell the player once every attempt has failed.
    const playerId = player.id;
    withRetry<null>(async () => {
      const { error } = await supabase.from('game_players').update({
        won: true,
        marks: myMarks,
        finish_position: finishPosition,
        bingo_time_ms: bingoTimeMs,
      }).match({ game_id: gid, player_id: playerId });
      if (error) console.error('Failed to persist win:', error);
      return error ? { ok: false } : { ok: true, value: null };
    }).then((result) => {
      if (!result.ok) toast.error('Your win was announced but not recorded in stats.');
    });

    // Update game status on first winner
    if (currentWinners.length === 0) {
      withRetry<null>(async () => {
        const { error } = await supabase.from('games').update({
          status: 'won',
          win_pattern: pattern,
          ended_at: new Date().toISOString(),
        }).eq('id', gid);
        if (error) console.error('Failed to update game status:', error);
        return error ? { ok: false } : { ok: true, value: null };
      }).then((result) => {
        if (!result.ok) toast.error('Round result could not be saved.');
      });
    }

    // If this can't be sent now, the hook queues it and sends it on the next
    // SUBSCRIBED; tabs that miss it entirely pick the win up from the DB.
    await broadcast('bingo_confirmed', {
      gameId: gid,
      playerId: player.id,
      displayName: player.display_name,
      pattern,
      finishPosition,
    });
  }

  // A double-click on New Round / Play Again must not insert two rounds. A ref,
  // not state, so the second click sees it before React re-renders.
  const newRoundInFlight = useRef(false);

  async function handleNewRound() {
    if (!player || !initialRoom.template_id) return;
    if (newRoundInFlight.current) return;
    newRoundInFlight.current = true;
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

      // Next round number comes from the DB, not the store: a host who
      // refreshed on Game Over has an empty store, and "0 + 1" inserted a
      // second round 1. The unique (room_id, round_number) constraint backs
      // this up if two hosts' tabs ever race.
      const { data: lastRound, error: lastRoundError } = await supabase
        .from('games')
        .select('round_number')
        .eq('room_id', initialRoom.id)
        .order('round_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastRoundError) throw lastRoundError;

      const { data: game, error } = await supabase
        .from('games')
        .insert({
          room_id: initialRoom.id,
          round_number: (lastRound?.round_number ?? 0) + 1,
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
    } finally {
      newRoundInFlight.current = false;
    }
  }

  // Host wraps up the night: room goes to 'finished' (the previously unreachable
  // GameOver state) and every client refreshes via the room_closed broadcast.
  async function handleEndGame() {
    if (!player) return;
    try {
      const supabase = createClient();

      // Same close-out handleNewRound performs: a final round that nobody won
      // must not linger as 'active', or the leaderboard counts a round that was
      // simply abandoned when the night ended.
      const { gameId: prevGameId, winners: prevWinners } = useGameStore.getState();
      if (prevGameId && prevWinners.length === 0) {
        await supabase.from('games')
          .update({ status: 'cancelled', ended_at: new Date().toISOString() })
          .eq('id', prevGameId);
      }

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
          connection={connection}
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
