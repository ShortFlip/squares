'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { BingoBoard } from '@/components/board/BingoBoard';
import { WinOverlay } from './WinOverlay';
import { CallerPanel } from './CallerPanel';
import { CalledItems } from './CalledItems';
import { useGameStore } from '@/stores/gameStore';
import { useGameState } from '@/hooks/useGameState';
import { usePlayer } from '@/hooks/usePlayer';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { playerColor } from '@/lib/utils/player-color';
import { playMark, playRoundStart, isMuted, toggleMute } from '@/lib/sound';
import type { Room } from '@/types/game';
import type { PresencePlayer } from '@/hooks/useRealtimeRoom';

interface GameViewProps {
  room: Room;
  currentPlayerId: string;
  presentPlayers: PresencePlayer[];
  playerMarks: Record<string, number[]>;
  onMarkSquare: (marks: number[]) => void;
  onBingoClaim: () => Promise<void>;
  onNewRound: () => Promise<void>;
  onEndGame: () => Promise<void>;
  onCallNext: (callsMade: number) => Promise<void>;
}

export function GameView({
  room,
  currentPlayerId,
  presentPlayers,
  playerMarks,
  onMarkSquare,
  onBingoClaim,
  onNewRound,
  onEndGame,
  onCallNext,
}: GameViewProps) {
  const { player } = usePlayer();
  const {
    gameId, myCard, myMarks, boardSize, freeSpace,
    winners, hasClaimed, roundNumber, cardStyles, gameMode,
  } = useGameStore();

  const { marksSet, canMark, currentWin, calledGridIndices } = useGameState();

  const isHost = currentPlayerId === room.host_id;
  const isTraditional = gameMode === 'traditional';
  const hasWinners = winners.length > 0;
  const iAmWinner = winners.some((w) => w.playerId === currentPlayerId);
  const totalSquares = boardSize * boardSize - (freeSpace ? 1 : 0);

  // Track mute state so the toggle button re-renders
  const [muted, setMuted] = useState(() => isMuted());

  // Play the "game on" sound whenever a new round starts (gameId changes)
  const prevGameIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (gameId && gameId !== prevGameIdRef.current) {
      playRoundStart();
      prevGameIdRef.current = gameId;
    }
  }, [gameId]);

  // Auto-claim the moment a winning pattern is detected — no button needed
  useEffect(() => {
    if (currentWin && !hasClaimed && !iAmWinner && gameId) {
      useGameStore.getState().setHasClaimed(true);
      onBingoClaim().catch(() => {
        useGameStore.getState().setHasClaimed(false);
      });
    }
  }, [currentWin]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMark(gridIndex: number) {
    if (!canMark(gridIndex)) return; // blocks free space; in traditional mode, uncalled squares too
    useGameStore.getState().toggleMark(gridIndex);
    playMark();
    // Broadcast updated marks so the host overview stays live
    const newMarks = useGameStore.getState().myMarks;
    onMarkSquare(newMarks);
  }

  if (!gameId || myCard.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Setting up your card…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header bar — player name + round + progress ── */}
      <div className="border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Current player's identity — always visible */}
            <div className="flex items-center gap-2">
              <PlayerAvatar
                playerId={currentPlayerId}
                displayName={player?.display_name ?? '?'}
                avatarUrl={player?.avatar_url}
                size="xs"
              />
              <span className="font-medium text-sm">{player?.display_name ?? 'You'}</span>
            </div>
            {roundNumber > 1 && (
              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-mono">
                Round {roundNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* My mark progress */}
            <span className="text-xs text-muted-foreground font-mono">
              {myMarks.length} / {totalSquares} marked
            </span>
            {/* Mute toggle — small, unobtrusive */}
            <button
              type="button"
              onClick={() => setMuted(toggleMute())}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={muted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto w-full px-4 py-6">

        {/* Board + BINGO button */}
        <div className="flex-1 flex flex-col items-center gap-4">
          <BingoBoard
            items={myCard}
            boardSize={boardSize}
            freeSpace={false}
            variant="game"
            styles={cardStyles}
            markedIndices={marksSet}
            // Traditional: called-but-unmarked squares glow so players can spot
            // them. Honor: no caller, so "called" mirrors marked.
            calledIndices={isTraditional ? calledGridIndices : marksSet}
            onMarkSquare={handleMark}
            className="max-w-lg w-full"
          />

          {iAmWinner && (
            <p className="text-success font-bold text-sm animate-pulse">You won! 🎉</p>
          )}
        </div>

        {/* Sidebar — caller tools (traditional) + player progress */}
        {(isTraditional || presentPlayers.length > 0) && (
          <div className="w-full lg:w-64 shrink-0 space-y-4">

            {/* Caller panel — host only, traditional mode only */}
            {isTraditional && isHost && gameId && (
              <div className="rounded-xl border border-border bg-card p-4">
                <CallerPanel gameId={gameId} onCallNext={onCallNext} />
              </div>
            )}

            {/* Call history — everyone in traditional mode */}
            {isTraditional && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Called Items
                </p>
                <CalledItems />
              </div>
            )}

            {presentPlayers.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                Players
              </p>
              <ul className="space-y-3">
                {presentPlayers.map((p) => {
                  const marks = p.playerId === currentPlayerId
                    ? myMarks
                    : (playerMarks[p.playerId] ?? []);
                  const isWinner = winners.some((w) => w.playerId === p.playerId);
                  const best = bestLineCompletion(marks, boardSize);

                  return (
                    <li key={p.playerId} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerAvatar
                            playerId={p.playerId}
                            displayName={p.displayName}
                            avatarUrl={p.avatarUrl}
                            size="xs"
                          />
                          <span className="text-sm truncate">
                            {p.displayName}
                            {p.playerId === currentPlayerId && (
                              <span className="text-muted-foreground text-xs ml-1">(you)</span>
                            )}
                          </span>
                        </div>
                        <span className="text-xs font-mono shrink-0 text-muted-foreground">
                          {isWinner ? '🏆 BINGO' : `${marks.length}/${totalSquares}`}
                        </span>
                      </div>
                      {/* Best-line pips — how close to a bingo on the best line */}
                      <div className="flex gap-0.5">
                        {Array.from({ length: boardSize }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                              i < best
                                ? isWinner ? 'bg-success' : 'bg-primary'
                                : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {isWinner ? 'Winner!' : `Best line: ${best}/${boardSize}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
            )}
          </div>
        )}

      </div>

      {hasWinners && (
        <WinOverlay
          isHost={isHost}
          onNewRound={isHost ? onNewRound : undefined}
          onEndGame={isHost ? onEndGame : undefined}
        />
      )}
    </div>
  );
}

/**
 * Returns the highest number of marks in any single line (row, col, or diagonal).
 * Used to show how close a player is to bingo without knowing their card layout —
 * only grid indices and boardSize are needed.
 */
function bestLineCompletion(marks: number[], boardSize: number): number {
  const s = new Set(marks);
  let best = 0;

  for (let r = 0; r < boardSize; r++) {
    let row = 0, col = 0;
    for (let c = 0; c < boardSize; c++) {
      if (s.has(r * boardSize + c)) row++;
      if (s.has(c * boardSize + r)) col++;
    }
    best = Math.max(best, row, col);
  }

  let d1 = 0, d2 = 0;
  for (let i = 0; i < boardSize; i++) {
    if (s.has(i * boardSize + i)) d1++;
    if (s.has(i * boardSize + (boardSize - 1 - i))) d2++;
  }

  return Math.max(best, d1, d2);
}

