'use client';

import { cn } from '@/lib/utils';

interface BoardSkeletonProps {
  /** Squares per side. Falls back to 5 when the template has not been read. */
  boardSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Per-diagonal delay of the breath, so it travels corner to corner. */
const WAVE_STEP_MS = 90;

/**
 * An N×N outline of the board while the card is on its way (DESIGN.md's
 * Loading state: "Skeleton of the board shape, not a spinner"). Same 8px gap
 * and 6px radius as the game grid, so the real board replaces it without the
 * squares moving. Width comes from the caller; squares are aspect-square.
 */
export function BoardSkeleton({ boardSize = 5, className, style }: BoardSkeletonProps) {
  const total = boardSize * boardSize;

  return (
    <div
      aria-hidden
      className={cn('grid w-full gap-2', className)}
      // Inline rather than a grid-cols-N class: N is data, and an inline track
      // list needs no pre-declared Tailwind class per size.
      style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`, ...style }}
    >
      {Array.from({ length: total }, (_, i) => {
        const row = Math.floor(i / boardSize);
        const col = i % boardSize;
        return (
          <div
            key={i}
            className="sk-square aspect-square rounded-[6px]"
            style={{ animationDelay: `${(row + col) * WAVE_STEP_MS}ms` }}
          />
        );
      })}
    </div>
  );
}
