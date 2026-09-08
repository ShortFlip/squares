'use client';

import { cn } from '@/lib/utils';
import { BingoSquare } from './BingoSquare';
import type { SquareItem, CardStyles } from '@/types/card';

// Pre-declare all grid sizes so Tailwind includes them in the build
const GRID_COLS: Record<number, string> = {
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

interface BingoBoardProps {
  items: SquareItem[];
  boardSize: number;
  freeSpace: boolean;
  variant: 'editor' | 'preview' | 'game';
  styles?: CardStyles;
  className?: string;
  // editor props
  editingIndex?: number | null;
  onEditSquare?: (gridIndex: number) => void;
  onChangeSquare?: (itemIndex: number, item: SquareItem) => void;
  onBlurSquare?: () => void;
  // game props
  markedIndices?: Set<number>;
  calledIndices?: Set<number>;
  onMarkSquare?: (gridIndex: number) => void;
  /** Grid gap utility. The game screen runs an 8px gap; editors stay at 4px. */
  gapClass?: string;
  /** Extra classes for every square — lets a caller set radius and text size. */
  squareClassName?: string;
  /**
   * The unmarked cells of the player's best line. They get a flat amber wash
   * so the line you are closest to reads from across the room.
   */
  laneIndices?: Set<number>;
}

export function BingoBoard({
  items,
  boardSize,
  freeSpace,
  variant,
  styles,
  className,
  editingIndex = null,
  onEditSquare,
  onChangeSquare,
  onBlurSquare,
  markedIndices,
  calledIndices,
  onMarkSquare,
  gapClass = 'gap-1',
  squareClassName,
  laneIndices,
}: BingoBoardProps) {
  const total = boardSize * boardSize;
  // The center cell is the FREE SPACE (only on square grids, which we always have)
  const centerIndex = Math.floor(total / 2);

  return (
    // @container enables cqw units inside BingoSquare for fluid font sizing
    <div
      style={{ backgroundColor: styles?.cardBg }}
      className={cn(
        '@container grid w-full',
        gapClass,
        GRID_COLS[boardSize] ?? 'grid-cols-5',
        className,
      )}
    >
      {Array.from({ length: total }, (_, gridIndex) => {
        // Two ways a cell can be the free space: positionally (editor and
        // preview, which pass a plain item list) or because the generated card
        // already carries the flag (the game, whose card includes the item).
        const isFreeSpace =
          (freeSpace && gridIndex === centerIndex) || items[gridIndex]?.isFreeSpace === true;

        // Map grid position → items array index, skipping center when freeSpace is on
        // e.g. 5x5 with freeSpace: grid[0-11]→items[0-11], grid[12]=FREE, grid[13-24]→items[12-23]
        const itemIndex =
          freeSpace && gridIndex > centerIndex ? gridIndex - 1 : gridIndex;

        const item = isFreeSpace
          ? { text: 'FREE', isFreeSpace: true }
          : (items[itemIndex] ?? { text: '' });

        return (
          // Each cell is its own @container so cqw units inside BingoSquare
          // are relative to the cell width, not the whole board
          <div key={gridIndex} className="@container">
            <BingoSquare
              index={gridIndex}
              item={item}
              variant={variant}
              isFreeSpace={isFreeSpace}
              styles={styles}
              isEditing={variant === 'editor' && editingIndex === gridIndex}
              onEdit={() => onEditSquare?.(gridIndex)}
              onChange={(newItem) => onChangeSquare?.(itemIndex, newItem)}
              onBlur={onBlurSquare}
              isMarked={markedIndices?.has(gridIndex) ?? false}
              isCalled={calledIndices?.has(gridIndex) ?? false}
              onMark={() => onMarkSquare?.(gridIndex)}
              className={cn(squareClassName, laneIndices?.has(gridIndex) && 'lane')}
            />
          </div>
        );
      })}
    </div>
  );
}
