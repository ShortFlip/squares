'use client';

import { cn } from '@/lib/utils';
import type { SquareItem } from '@/types/card';

interface MiniBoardProps {
  /** The player's shuffled card. Only its length and free-space flags matter here. */
  card: SquareItem[];
  marks: number[];
  boardSize: number;
  freeSpace: boolean;
  /** Content box in px (padding and border sit outside it). 108 = 20px tiles at 5x5. */
  size?: number;
  /** Grid indices of the line to outline — the player's best line. */
  line?: number[];
  /** Reserved for Phase 3's gold winner treatment. No-op today. */
  winner?: boolean;
  className?: string;
}

/**
 * A whole bingo board at a glance, with no text on it.
 *
 * The rail's job is "who is close", answered in the second someone looks over.
 * Text at this size is unreadable, so shape and color do all the work: amber
 * tiles are marks, the violet tile is the free space, and an emerald outline
 * traces the line they are closest to completing.
 */
export function MiniBoard({
  card,
  marks,
  boardSize,
  freeSpace,
  size = 108,
  line,
  winner,
  className,
}: MiniBoardProps) {
  const total = boardSize * boardSize;
  const centerIndex = Math.floor(total / 2);
  const gap = 2;
  // Tiles share the content box with (n - 1) gaps between them.
  const tile = (size - gap * (boardSize - 1)) / boardSize;

  const marked = new Set(marks);
  const lineCells = line ? new Set(line) : null;

  return (
    <div
      className={cn('shrink-0 rounded-md p-[6px]', className)}
      style={{
        backgroundColor: 'rgba(0,0,0,0.28)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
      // Phase 3 reads this; today it is only a hook for the winner treatment.
      data-winner={winner ? 'true' : undefined}
      aria-hidden
    >
      <div
        className="grid"
        style={{
          gap: `${gap}px`,
          gridTemplateColumns: `repeat(${boardSize}, ${tile}px)`,
          gridAutoRows: `${tile}px`,
        }}
      >
        {Array.from({ length: total }, (_, gridIndex) => {
          // Free space is positional, not stored per-card, so it is derived the
          // same way BingoBoard derives it — a card that carries the flag wins.
          const isFree =
            card[gridIndex]?.isFreeSpace ?? (freeSpace && gridIndex === centerIndex);

          return (
            <div
              key={gridIndex}
              className={cn(
                'rounded-[2px]',
                isFree ? 'mt-free' : marked.has(gridIndex) ? 'mt-on' : 'mt',
                lineCells?.has(gridIndex) && 'mt-line',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
