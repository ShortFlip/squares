'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as LinkIcon, Volume2, VolumeX } from 'lucide-react';
import { BingoBoard } from '@/components/board/BingoBoard';
import { WinBanner } from './WinBanner';
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
import { playMark, playRoundStart, playBingo, isMuted, toggleMute } from '@/lib/sound';
import { fireWinConfetti, fireSecondPlaceConfetti } from '@/lib/win-confetti';
import { cn } from '@/lib/utils';
import type { Room } from '@/types/game';
import type { PresencePlayer } from '@/hooks/useRealtimeRoom';

/** Header height. The body is sized against it, so it lives in one place. */
const HEADER_H = 56;
/** The hero grid is a fixed 608px at every board size — the board never shrinks. */
const GRID_W = 608;
/** While the win banner is up the grid gives back 88px so the banner can fit
 *  without the board leaving the window. Rows fall out of aspect-square. */
const GRID_W_WON = 520;

/** Fallback line names, for when the winner's marks have not reached us. */
const PATTERN_NAMES: Record<string, string> = {
  row: 'Row',
  column: 'Column',
  diagonal: 'Diagonal',
  four_corners: 'Four corners',
  blackout: 'Blackout',
  custom: 'Custom pattern',
};

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
    winners: storeWinners, hasClaimed, roundNumber, cardStyles, gameMode, others,
  } = useGameStore();

  const { marksSet, canMark, currentWin, calledGridIndices } = useGameState();
  const dev = useDevState();

  const isHost = currentPlayerId === room.host_id;
  const isTraditional = gameMode === 'traditional';
  const winners = dev?.winners ?? storeWinners;
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

  // ── The win sequence ────────────────────────────────────────────────────
  // Driven by `winners.length` rather than by the claim, so it runs identically
  // on every client — the winner's own tab included — and exactly once per
  // winner. `bingo_confirmed` is broadcast with `self: true`, so the claimant
  // receives their own event like everyone else.
  const announcedRef = useRef(0);
  useEffect(() => {
    if (winners.length <= announcedRef.current) {
      // A new round empties the list; the next win must announce again.
      announcedRef.current = winners.length;
      return;
    }
    const isFirst = announcedRef.current === 0;
    announcedRef.current = winners.length;

    playBingo();
    // Both bursts pass `disableForReducedMotion`, so the "no confetti" branch
    // lives in one place rather than being re-decided here. The banner's own
    // slide is switched off by the reduced-motion block in globals.css.
    if (isFirst) fireWinConfetti();
    else fireSecondPlaceConfetti();
  }, [winners.length]);

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

  // Winners keyed by id so the rail can hand each card its own placing.
  const winnerById = useMemo(
    () => new Map(winners.map((w, i) => [w.playerId, { winner: w, position: i + 1 }])),
    [winners],
  );
  const myPlacing = winnerById.get(currentPlayerId)?.position ?? null;

  /**
   * The banner says which line the first winner completed, not merely which
   * pattern they claimed: `Column 2` beats `Column`. That needs their marks,
   * which we have for anyone in the rail (and for ourselves). When the marks
   * have not landed yet, the claimed pattern is the honest fallback.
   */
  const patternLabel = useMemo(() => {
    const first = winners[0];
    if (!first) return '';
    const isMe = first.playerId === currentPlayerId;
    const winnerMarks = isMe
      ? marks
      : rail.find((o) => o.playerId === first.playerId)?.marks;
    if (winnerMarks && winnerMarks.length > 0) {
      const line = bestLine(new Set(winnerMarks), size, free);
      if (line && line.remaining === 0) {
        return line.kind === 'diagonal' ? 'Diagonal'
          : `${line.kind === 'row' ? 'Row' : 'Column'} ${line.index + 1}`;
      }
    }
    return PATTERN_NAMES[first.pattern] ?? 'Bingo';
  }, [winners, currentPlayerId, marks, rail, size, free]);

  // While the banner is up everything else gives ground: the grid, the panel,
  // the rail gap and the miniatures.
  const gridW = hasWinners ? GRID_W_WON : GRID_W;

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

      {/* The win moment: a band, never a wall. The board below stays live so
          second place is still up for grabs. */}
      {hasWinners && (
        <WinBanner
          winners={winners}
          patternLabel={patternLabel}
          roundNumber={roundNumber}
          isHost={isHost}
          onNewRound={() => { void onNewRound(); }}
          onEndGame={() => { void onEndGame(); }}
        />
      )}

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex-1 min-h-0 flex gap-5 px-[22px] transition-[padding] duration-300 ease-out',
          hasWinners ? 'pt-[14px] pb-[18px]' : 'py-5',
        )}
      >

        {/* Hero: my board, the primary verb, the biggest thing on screen.
            The panel hugs the fixed grid (grid + 20px padding either side)
            rather than stretching, and is centered in the space left of the
            rail — a stretched panel leaves the board floating off-center. */}
        <div className="flex-1 min-w-0 flex justify-center">
        <section
          className="glass w-fit flex flex-col items-center gap-[14px] px-5 py-[18px] rounded-2xl overflow-hidden"
          style={hasWinners ? { minHeight: 606 } : undefined}
        >
          <div
            className="flex items-center justify-between gap-3 transition-[width] duration-300 ease-out"
            style={{ width: gridW }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-[30px] h-[30px] rounded-full flex items-center justify-center font-display text-[14px] font-bold text-white shrink-0"
                style={{ background: playerColor(currentPlayerId) }}
              >
                {getInitials(displayName).slice(0, 1)}
              </span>
              <span className="font-display text-[20px] font-bold truncate">{displayName}</span>
              {/* My own placing replaces the "this is you" pill — once I have
                  won, which board is mine is no longer the news. */}
              {myPlacing ? (
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.10em] shrink-0 text-background"
                  style={{ backgroundColor: 'var(--gold)' }}
                >
                  {myPlacing === 2 ? '2ND' : '1ST'}
                </span>
              ) : (
                <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.10em] bg-primary/15 text-primary border border-primary/30 shrink-0">
                  YOUR BOARD
                </span>
              )}
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

          <div
            // Keyed on gameId so a new round remounts the grid and the flip
            // plays; the width transition covers the banner arriving/leaving.
            key={gameId ?? 'no-game'}
            className="call-flip transition-[width] duration-300 ease-out"
            style={{ width: gridW }}
          >
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
              squareClassName={cn(
                'rounded-[6px] font-medium',
                hasWinners || size >= 6 ? 'text-[11px]' : 'text-[12px]',
              )}
            />
          </div>
        </section>
        </div>

        {/* Rail: everyone else, always on screen, never asking for a click. */}
        <aside
          className={cn(
            'w-[300px] shrink-0 flex flex-col overflow-y-auto pr-1.5',
            '[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]',
            hasWinners ? 'gap-[10px]' : 'gap-3',
          )}
        >

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

          {/* The banner is already saying the loud thing; the rail label would
              only be competing with it for the same two seconds. */}
          {!hasWinners && (
            <div className="flex items-baseline justify-between px-0.5">
              <p className="font-display text-[13px] font-bold uppercase tracking-[0.14em]">
                Everyone Else
              </p>
              <span className="text-[12px] font-medium text-muted-foreground">
                {rail.length} playing
              </span>
            </div>
          )}

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
                winner={winnerById.has(other.playerId)}
                finishPosition={winnerById.get(other.playerId)?.position ?? null}
                winPattern={winnerById.get(other.playerId)?.winner.pattern}
                miniSize={hasWinners ? 90 : undefined}
              />
            ))
          )}
        </aside>
      </div>
    </div>
  );
}
