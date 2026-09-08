'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as LinkIcon, Volume2, VolumeX } from 'lucide-react';
import { BingoBoard } from '@/components/board/BingoBoard';
import { WinOverlay } from './WinOverlay';
import { CallerPanel } from './CallerPanel';
import { CalledItems } from './CalledItems';
import { RailCard } from './RailCard';
import { useGameStore, type OtherPlayer } from '@/stores/gameStore';
import { useGameState } from '@/hooks/useGameState';
import { usePlayer } from '@/hooks/usePlayer';
import { useDevState } from '@/lib/dev-state';
import { bestLine, bestLineLabel } from '@/lib/game/win-detection';
import { copyLink } from '@/lib/utils/copy-link';
import { playerColor, getInitials } from '@/lib/utils/player-color';
import { playMark, playRoundStart, isMuted, toggleMute } from '@/lib/sound';
import { cn } from '@/lib/utils';
import type { Room } from '@/types/game';
import type { PresencePlayer } from '@/hooks/useRealtimeRoom';

/** Header height. The body is sized against it, so it lives in one place. */
const HEADER_H = 56;
/** The hero grid is a fixed 608px at every board size — the board never shrinks. */
const GRID_W = 608;

interface GameViewProps {
  room: Room;
  currentPlayerId: string;
  presentPlayers: PresencePlayer[];
  connection: 'connecting' | 'live' | 'reconnecting';
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
  connection,
  onMarkSquare,
  onBingoClaim,
  onNewRound,
  onEndGame,
  onCallNext,
}: GameViewProps) {
  const { player } = usePlayer();
  const {
    gameId, myCard, myMarks, boardSize, freeSpace,
    winners, hasClaimed, roundNumber, cardStyles, gameMode, others,
  } = useGameStore();

  const { marksSet, canMark, currentWin, calledGridIndices } = useGameState();
  const dev = useDevState();

  const isHost = currentPlayerId === room.host_id;
  const isTraditional = gameMode === 'traditional';
  const hasWinners = winners.length > 0;
  const iAmWinner = winners.some((w) => w.playerId === currentPlayerId);

  // Dev overrides stand in for the store so the states that are hard to stage
  // live (dropped connection, unsynced board, a full 6x6 room) can be captured.
  const size = dev?.boardSize ?? boardSize;
  const free = dev?.freeSpace ?? freeSpace;
  const card = dev?.card ?? myCard;
  const marks = dev?.marks ?? myMarks;
  const totalSquares = size * size;
  const isReconnecting = dev?.forceReconnecting || connection !== 'live';

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
    // Only `currentWin` may trigger this. Adding onBingoClaim (a new identity
    // each parent render) plus hasClaimed would let a failed claim — which
    // resets hasClaimed to false — immediately re-fire in a retry loop.
  }, [currentWin]); // eslint-disable-line react-hooks/exhaustive-deps

  // My best line drives both the header note and the hot lane on the board.
  const myLine = useMemo(
    () => bestLine(new Set(marks), size, free),
    [marks, size, free],
  );
  const myLineLabel = bestLineLabel(myLine);
  const myOneAway = myLine !== null && myLine.remaining === 1;

  // Only the cells still to go get the wash — the marked ones already glow.
  const laneIndices = useMemo(() => {
    if (!myLine || myLine.remaining === 0 || myLineLabel === 'No line yet') return undefined;
    const markSet = new Set(marks);
    return new Set(myLine.cells.filter((c) => !markSet.has(c)));
  }, [myLine, myLineLabel, marks]);

  /**
   * Everyone else, most marks first, with anyone we have not read yet at the
   * bottom — an unknown board should never outrank a known one.
   */
  const livePlayers: OtherPlayer[] = useMemo(() => {
    const byId = new Map<string, OtherPlayer>();
    for (const other of Object.values(others)) {
      if (other.playerId !== currentPlayerId) byId.set(other.playerId, other);
    }
    // Someone in presence with no row yet still belongs in the rail, as syncing.
    for (const p of presentPlayers) {
      if (p.playerId === currentPlayerId || byId.has(p.playerId)) continue;
      byId.set(p.playerId, {
        playerId: p.playerId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl ?? null,
        card: [],
        marks: [],
        won: false,
        finishPosition: null,
        synced: false,
      });
    }

    return [...byId.values()].sort((a, b) => {
      if (a.synced !== b.synced) return a.synced ? -1 : 1;
      return b.marks.length - a.marks.length;
    });
  }, [others, presentPlayers, currentPlayerId]);

  const rail = dev?.others ?? livePlayers;

  function handleMark(gridIndex: number) {
    if (!canMark(gridIndex)) return; // blocks free space; in traditional mode, uncalled squares too
    useGameStore.getState().toggleMark(gridIndex);
    playMark();
    // Broadcast updated marks so everyone else's rail stays live
    const newMarks = useGameStore.getState().myMarks;
    onMarkSquare(newMarks);
  }

  if (!dev?.card && (!gameId || myCard.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Setting up your card…</p>
      </div>
    );
  }

  const displayName = player?.display_name ?? 'You';

  return (
    <div className="h-screen overflow-hidden flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────
          Everything you might need to say out loud on the call — the code,
          the link, the round — and nothing you have to click to keep playing.
          The right padding clears the app-wide floating profile avatar. */}
      <header
        className="glass-header shrink-0 flex items-center justify-between px-5 pr-[68px] relative z-20"
        style={{ height: HEADER_H }}
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-[15px] font-extrabold">Squares</span>
          <span className="w-px h-[22px] bg-white/12" />
          <span
            className="font-mono text-[26px] font-bold tracking-[0.14em]"
            style={{ textShadow: '0 0 18px var(--primary)' }}
          >
            {room.join_code}
          </span>
          <button
            type="button"
            onClick={() => copyLink()}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors duration-150"
          >
            <LinkIcon className="w-[13px] h-[13px]" strokeWidth={1.75} />
            Copy link
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Round {roundNumber}
          </span>

          {/* The Live pill is the only connection affordance while things are
              fine; when they are not, the amber bar below takes over. */}
          {!isReconnecting && (
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.10em] bg-success/12 text-success border border-success/25">
              <span
                className="w-[7px] h-[7px] rounded-full bg-success"
                style={{ boxShadow: '0 0 9px var(--success)' }}
              />
              Live
            </span>
          )}

          <button
            type="button"
            onClick={() => setMuted(toggleMute())}
            className="text-muted-foreground hover:text-foreground transition-colors duration-150"
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted
              ? <VolumeX className="w-[18px] h-[18px]" strokeWidth={1.75} />
              : <Volume2 className="w-[18px] h-[18px]" strokeWidth={1.75} />}
          </button>
        </div>
      </header>

      {/* Dropped realtime: a bar, not a dialog. The board stays markable and
          catches up when the channel comes back. */}
      {isReconnecting && (
        <div className="relative z-20 shrink-0">
          <div
            className="h-[3px] w-full bg-accent"
            style={{ boxShadow: '0 0 10px var(--accent)' }}
          />
          <span className="absolute right-5 top-[5px] font-mono text-[11px] font-bold uppercase tracking-[0.10em] text-accent">
            Reconnecting
          </span>
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex gap-5 px-[22px] py-5">

        {/* Hero: my board, the primary verb, the biggest thing on screen.
            The panel hugs the fixed grid (grid + 20px padding either side)
            rather than stretching, and is centered in the space left of the
            rail — a stretched panel leaves the board floating off-center. */}
        <div className="flex-1 min-w-0 flex justify-center">
        <section
          className="glass w-fit flex flex-col items-center gap-[14px] px-5 py-[18px] rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3" style={{ width: GRID_W }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-[30px] h-[30px] rounded-full flex items-center justify-center font-display text-[14px] font-bold text-white shrink-0"
                style={{ background: playerColor(currentPlayerId) }}
              >
                {getInitials(displayName).slice(0, 1)}
              </span>
              <span className="font-display text-[20px] font-bold truncate">{displayName}</span>
              <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.10em] bg-primary/15 text-primary border border-primary/30 shrink-0">
                YOUR BOARD
              </span>
            </div>

            <div className="flex items-center gap-[14px] shrink-0">
              <span
                className={cn(
                  'text-[12px] font-semibold',
                  myOneAway ? 'text-accent'
                    : myLineLabel === 'No line yet' ? 'text-muted-foreground'
                    : 'text-foreground',
                )}
              >
                {myLineLabel}
              </span>
              <span className="font-mono text-[15px] font-bold">
                {marks.length} / {totalSquares}
              </span>
            </div>
          </div>

          <div style={{ width: GRID_W }}>
            <BingoBoard
              items={card}
              boardSize={size}
              freeSpace={false}
              variant="game"
              styles={cardStyles}
              markedIndices={new Set(marks)}
              // Traditional: called-but-unmarked squares glow so players can
              // spot them. Honor: no caller, so "called" mirrors marked.
              calledIndices={isTraditional ? calledGridIndices : marksSet}
              laneIndices={laneIndices}
              onMarkSquare={handleMark}
              gapClass="gap-2"
              squareClassName={cn('rounded-[6px] font-medium', size >= 6 ? 'text-[11px]' : 'text-[12px]')}
            />
          </div>
        </section>
        </div>

        {/* Rail: everyone else, always on screen, never asking for a click. */}
        <aside className="w-[300px] shrink-0 flex flex-col gap-3 overflow-y-auto pr-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]">

          {/* Caller tools ride above the players in traditional mode. */}
          {isTraditional && isHost && gameId && (
            <div className="glass rounded-xl p-3">
              <CallerPanel gameId={gameId} onCallNext={onCallNext} />
            </div>
          )}

          {isTraditional && (
            <div className="glass rounded-xl p-3 space-y-3">
              <p className="font-display text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Called Items
              </p>
              <CalledItems />
            </div>
          )}

          <div className="flex items-baseline justify-between px-0.5">
            <p className="font-display text-[13px] font-bold uppercase tracking-[0.14em]">
              Everyone Else
            </p>
            <span className="text-[12px] font-medium text-muted-foreground">
              {rail.length} playing
            </span>
          </div>

          {rail.length === 0 ? (
            <p className="text-[12px] text-muted-foreground px-0.5">
              Nobody else is here yet. Share the link.
            </p>
          ) : (
            rail.map((other) => (
              <RailCard
                key={other.playerId}
                playerId={other.playerId}
                displayName={other.displayName}
                avatarUrl={other.avatarUrl}
                card={other.card}
                marks={other.marks}
                boardSize={size}
                freeSpace={free}
                synced={other.synced}
              />
            ))
          )}
        </aside>
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
