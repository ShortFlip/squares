'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MiniBoard } from '@/components/board/MiniBoard';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { bestLine, bestLineLabel } from '@/lib/game/win-detection';
import type { SquareItem } from '@/types/card';

interface RailCardProps {
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
  card: SquareItem[];
  marks: number[];
  boardSize: number;
  freeSpace: boolean;
  /** False until this player's game_players row has been read. */
  synced: boolean;
  /** A confirmed winner this round — gets the gold treatment. */
  winner?: boolean;
  /** 1 or 2, drawn as the `1ST` / `2ND` pill beside the name. */
  finishPosition?: number | null;
  /** The pattern the win was claimed with; the fallback when the marks that
   *  completed the line have not reached us yet. */
  winPattern?: string;
  /** Miniature content-box size. Shrinks to 90 while the win banner is up. */
  miniSize?: number;
}

const POSITION_LABELS: Record<number, string> = { 1: '1ST', 2: '2ND', 3: '3RD' };

/**
 * One other player in the rail: their whole board, their score, and how close
 * they are — all readable without clicking anything.
 */
export function RailCard({
  playerId,
  displayName,
  avatarUrl,
  card,
  marks,
  boardSize,
  freeSpace,
  synced,
  winner,
  finishPosition,
  winPattern,
  miniSize,
}: RailCardProps) {
  const total = boardSize * boardSize;

  // An unsynced board gets no derived state at all — not even a free space.
  // Drawing a line or a lit center on a board we have not read would be
  // inventing information about someone else's game.
  const line = useMemo(
    () => (synced ? bestLine(new Set(marks), boardSize, freeSpace) : null),
    [synced, marks, boardSize, freeSpace],
  );

  // A winner's status line states the fact, not the distance.
  const label = bestLineLabel(line, winner ? { pattern: winPattern ?? 'row' } : undefined);
  // "One away" is the only state worth changing color for — it is the moment
  // you might actually want to look up from the game.
  const oneAway = line !== null && line.remaining === 1;
  const percent = total > 0 ? Math.min(100, (marks.length / total) * 100) : 0;

  return (
    <div
      className={cn('glass rounded-xl p-3 flex gap-3')}
      style={
        winner
          ? {
              border: '1px solid color-mix(in oklab, var(--gold) 70%, transparent)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.12), 0 0 26px color-mix(in oklab, var(--gold) 28%, transparent)',
            }
          : undefined
      }
    >
      <MiniBoard
        card={card}
        // Nothing is drawn for a board we have not read — no marks, no free
        // space, no line. Dim and empty is the honest picture.
        marks={synced ? marks : []}
        boardSize={boardSize}
        freeSpace={synced && freeSpace}
        line={line?.cells}
        winner={winner}
        size={miniSize}
        // An unread board is dimmed rather than drawn as an empty one — an
        // honest "we don't know yet" instead of a false 0/25.
        className={cn(!synced && 'opacity-45')}
      />

      <div className="flex flex-col justify-center gap-1.5 min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <PlayerAvatar
            playerId={playerId}
            displayName={displayName}
            avatarUrl={avatarUrl}
            size="xs"
            initials={displayName.slice(0, 1).toUpperCase()}
            className="w-[26px] h-[26px] text-[12px] font-display"
          />
          <span className="font-display text-[17px] font-bold truncate">{displayName}</span>
          {winner && (
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.10em] text-background"
              style={{ backgroundColor: 'var(--gold)' }}
            >
              {POSITION_LABELS[finishPosition ?? 1] ?? '1ST'}
            </span>
          )}
        </div>

        {synced ? (
          <>
            <span className="font-mono text-[13px] font-bold">
              {marks.length} / {total}
            </span>
            <div className="h-1 rounded-full bg-white/8 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  winner
                    ? ''
                    : oneAway
                      ? 'bg-success shadow-[0_0_8px_color-mix(in_oklab,var(--success)_70%,transparent)]'
                      : 'bg-accent shadow-[0_0_8px_color-mix(in_oklab,var(--accent)_70%,transparent)]',
                )}
                style={{
                  width: `${percent}%`,
                  ...(winner
                    ? {
                        backgroundColor: 'var(--gold)',
                        boxShadow: '0 0 8px color-mix(in oklab, var(--gold) 70%, transparent)',
                      }
                    : {}),
                }}
              />
            </div>
            <p
              className={cn(
                'text-[11px] font-medium',
                winner || oneAway ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {label}
            </p>
          </>
        ) : (
          <>
            <span className="self-start rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.10em] bg-accent/15 text-accent border border-accent/30">
              SYNCING
            </span>
            <p className="text-[11px] font-medium text-muted-foreground">
              Waiting for their board
            </p>
          </>
        )}
      </div>
    </div>
  );
}
