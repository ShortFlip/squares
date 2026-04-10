'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/stores/gameStore';

/**
 * Scrollable history of all items called so far.
 * Items that appear on the current player's card are highlighted.
 */
export function CalledItems() {
  const { callList, calledCount, templateItems, myCard } = useGameStore();

  // Build a set of original indices that appear on this player's card
  // so we can highlight relevant called items
  const onMyCard = useMemo(() => {
    const indices = new Set<number>();
    myCard.forEach((item) => {
      if (item.originalIndex !== undefined) indices.add(item.originalIndex);
    });
    return indices;
  }, [myCard]);

  const calledItems = callList
    .slice(0, calledCount)
    .reverse() // most recent first
    .map((idx) => ({ idx, item: templateItems[idx] }))
    .filter(({ item }) => item);

  if (calledItems.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-muted-foreground">
        No items called yet
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
      {calledItems.map(({ idx, item }, i) => (
        <span
          key={`${idx}-${i}`}
          className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
            i === 0
              ? 'bg-primary text-primary-foreground ring-2 ring-primary/40' // most recent
              : onMyCard.has(idx)
              ? 'bg-accent/20 text-foreground border border-accent/40'      // on my card
              : 'bg-muted text-muted-foreground',                            // not on my card
          )}
        >
          {item.text}
        </span>
      ))}
    </div>
  );
}
