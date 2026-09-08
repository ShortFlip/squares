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
  /** Reserved for Phase 3's gold treatment. */
  winner?: boolean;
}

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
}: RailCardProps) {
  const total = boardSize * boardSize;

  // An unsynced board gets no derived state at all — not even a free space.
  // Drawing a line or a lit center on a board we have not read would be
  // inventing information about someone else's game.
  const line = useMemo(
    () => (synced ? bestLine(new Set(marks), boardSize, freeSpace) : null),
    [synced, marks, boardSize, freeSpace],
  );

  const label = bestLineLabel(line);
  // "One away" is the only state worth changing color for — it is the moment
  // you might actually want to look up from the game.
  const oneAway = line !== null && line.remaining === 1;
  const percent = total > 0 ? Math.min(100, (marks.length / total) * 100) : 0;

  return (
    <div className="glass rounded-xl p-3 flex gap-3">
      <MiniBoard
        card={card}
        // Nothing is drawn for a board we have not read — no marks, no free
        // space, no line. Dim and empty is the honest picture.
        marks={synced ? marks : []}
        boardSize={boardSize}
        freeSpace={synced && freeSpace}
        line={line?.cells}
        winner={winner}
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
                  oneAway
                    ? 'bg-success shadow-[0_0_8px_color-mix(in_oklab,var(--success)_70%,transparent)]'
                    : 'bg-accent shadow-[0_0_8px_color-mix(in_oklab,var(--accent)_70%,transparent)]',
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
            <p
              className={cn(
                'text-[11px] font-medium',
                oneAway ? 'text-success' : 'text-muted-foreground',
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
