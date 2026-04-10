'use client';

import { useMemo } from 'react';
import { BingoBoard } from './BingoBoard';
import { generateCard } from '@/lib/game/shuffle';
import type { SquareItem, CardStyles } from '@/types/card';

interface BoardPreviewProps {
  items: SquareItem[];
  boardSize: number;
  freeSpace: boolean;
  shuffleMode: 'full' | 'column';
  styles?: CardStyles;
  // Seed for the preview shuffle — changes to show a different arrangement
  seed?: string;
  className?: string;
}

/**
 * Read-only view of what a player's card would look like after shuffling.
 * Uses a fixed preview seed so it's stable unless explicitly changed.
 */
export function BoardPreview({
  items,
  boardSize,
  freeSpace,
  shuffleMode,
  styles,
  seed = 'preview-seed',
  className,
}: BoardPreviewProps) {
  // generateCard returns N*N items with FREE already inserted at center
  // so we pass freeSpace=false to BingoBoard (no double-substitution)
  const previewItems = useMemo(
    () => generateCard(items, seed, 'preview-player', boardSize, shuffleMode, freeSpace),
    [items, seed, boardSize, shuffleMode, freeSpace],
  );

  return (
    <BingoBoard
      items={previewItems}
      boardSize={boardSize}
      // FREE sentinel is already embedded in previewItems by generateCard
      freeSpace={false}
      variant="preview"
      styles={styles}
      className={className}
    />
  );
}
