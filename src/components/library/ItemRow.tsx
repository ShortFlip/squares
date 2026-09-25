'use client';

import { memo, useRef, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { BTN, GameGlyph, HOVER_CONTROL } from './GameGlyph';
import { RowGameMenu } from './GameMenu';
import type { LibraryItem, Tag } from '@/types/library';

/** Extra-tag chips shown on a row before collapsing to "+N". */
const MAX_ROW_TAGS = 2;

interface ItemRowProps {
  item: LibraryItem;
  game: Tag | null;
  games: Tag[];
  extraTags: Tag[];
  selected: boolean;
  onCard: boolean;
  /** Every slot on the card is pinned, so "+" has nowhere to go. */
  cardFull: boolean;
  onToggleSelected: (id: string) => void;
  onRename: (id: string, text: string) => Promise<boolean>;
  onSetGame: (id: string, gameTagId: string | null) => void;
  onPin: (id: string) => void;
  /**
   * Non-zero while this row is lit after an Add an Item save (or as the
   * duplicate it found). A new number restarts the fade.
   */
  flash?: number;
}

/**
 * One library item: select, game icon, text (click to edit), its extra tags,
 * its game, and "+" to pin it onto the card. Memoised: a library can run to
 * hundreds of rows and most renders change one of them.
 */
export const ItemRow = memo(function ItemRow({
  item,
  game,
  games,
  extraTags,
  selected,
  onCard,
  cardFull,
  onToggleSelected,
  onRename,
  onSetGame,
  onPin,
  flash = 0,
}: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [saving, setSaving] = useState(false);
  // Set when edit mode is closing, so the blur that follows (the input leaving
  // the DOM) cannot save a second time or undo an Escape.
  const closing = useRef(false);

  const rowTags = extraTags.filter((t) => item.tagIds.includes(t.id));
  const shownTags = rowTags.slice(0, MAX_ROW_TAGS);
  const hiddenTags = rowTags.length - shownTags.length;

  function startEdit() {
    closing.current = false;
    setDraft(item.text);
    setEditing(true);
  }

  function stopEdit() {
    closing.current = true;
    setEditing(false);
  }

  async function commit() {
    if (closing.current || saving) return;
    const next = draft.trim();
    // Blank or unchanged: nothing to save, just leave edit mode.
    if (!next || next === item.text) {
      stopEdit();
      return;
    }
    setSaving(true);
    const ok = await onRename(item.id, next);
    setSaving(false);
    if (ok) stopEdit();
  }

  return (
    <li
      data-item-id={item.id}
      // isolate: the flash layer sits behind the row's content but above the pane.
      className={cn(
        'group relative isolate flex h-11 items-center gap-3 border-b border-border/60 px-4 transition-colors duration-150',
        selected ? 'bg-primary/10' : 'hover:bg-muted/40',
      )}
    >
      {/* Keyed by the flash number, so lighting the same row again remounts it and replays the fade. */}
      {flash > 0 && <span key={flash} aria-hidden data-testid="item-flash" className="item-flash pointer-events-none absolute inset-0 -z-10" />}
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggleSelected(item.id)}
        aria-label={`Select ${item.text}`}
        className={HOVER_CONTROL}
      />
      <GameGlyph game={game} />

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            value={draft}
            autoFocus
            disabled={saving}
            aria-label="Item Text"
            aria-invalid={!draft.trim()}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void commit(); }
              if (e.key === 'Escape') { e.preventDefault(); stopEdit(); }
            }}
            // Clicking away saves a real change, like a spreadsheet cell; Escape is the way out.
            onBlur={() => void commit()}
            className="h-8 w-full rounded-md border border-ring bg-background px-2 text-sm outline-none ring-3 ring-ring/30 aria-invalid:border-destructive disabled:opacity-60"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Click To Edit"
            className="block h-8 w-full truncate rounded-md px-2 -mx-2 text-left text-sm outline-none transition-colors duration-150 hover:bg-muted/60 active:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {item.text}
          </button>
        )}
      </div>

      {rowTags.length > 0 && (
        <div className="flex shrink-0 items-center gap-1">
          {shownTags.map((t) => (
            <span
              key={t.id}
              className="inline-flex h-6 max-w-32 items-center truncate rounded-full border border-border px-2 text-[13px] text-muted-foreground"
            >
              {t.name}
            </span>
          ))}
          {hiddenTags > 0 && (
            <span
              className="inline-flex h-6 items-center rounded-full border border-border px-2 font-mono text-[13px] text-muted-foreground"
              title={rowTags.slice(MAX_ROW_TAGS).map((t) => t.name).join(', ')}
            >
              +{hiddenTags}
            </span>
          )}
        </div>
      )}

      <RowGameMenu games={games} value={item.gameTagId} onChange={(id) => onSetGame(item.id, id)} />

      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(BTN, onCard && 'text-success disabled:opacity-100')}
        disabled={onCard || cardFull}
        onClick={() => onPin(item.id)}
        aria-label={onCard ? 'On The Card' : 'Add To Card'}
        title={onCard ? 'On The Card' : cardFull ? 'Every Square Is Pinned' : 'Add To Card'}
      >
        {onCard ? <Check strokeWidth={1.75} /> : <Plus strokeWidth={1.75} />}
      </Button>
    </li>
  );
});
