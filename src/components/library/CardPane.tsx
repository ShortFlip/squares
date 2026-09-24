'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, ChevronDown, Loader2, Pin, Plus, Shuffle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { slotsFor } from '@/lib/game/card-builder';
import { CARD_PRESETS } from '@/lib/card-styles';
import { sameName } from '@/lib/library/api';
import { countsInSet, laneKeysFor } from '@/lib/library/card-draft';
import { notify } from '@/lib/library/notify';
import { cn } from '@/lib/utils';
import { laneCounts, mixSlots, poolFor, useLibraryStore } from '@/stores/libraryStore';
import { BTN, BTN_PRIMARY, GameGlyph, HOVER_CONTROL } from './GameGlyph';
import { MixControl } from './MixControl';
import { ConfirmDialog } from './TagDialogs';
import type { SquareItem } from '@/types/card';
import type { Tag } from '@/types/library';

const SIZES = [3, 4, 5, 6] as const;
const SIZE_ITEMS: Record<string, string> = Object.fromEntries(SIZES.map((n) => [String(n), `${n}×${n}`]));
const STYLE_ITEMS: Record<string, string> = Object.fromEntries(CARD_PRESETS.map((p) => [p.id, p.label]));

/**
 * The right pane: build one card from the library. Settings, the mix, the set
 * (pin, swap, reshuffle) and Save. Everything here edits the draft in the
 * library store; only Save writes to the database.
 */
export function CardPane() {
  const items = useLibraryStore((s) => s.items);
  const tags = useLibraryStore((s) => s.tags);
  const draft = useLibraryStore((s) => s.draft);
  const capped = useLibraryStore((s) => s.capped);
  const savedCards = useLibraryStore((s) => s.savedCards);
  const store = useLibraryStore.getState;

  const [replaceTarget, setReplaceTarget] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const games = useMemo(() => tags.filter((t) => t.kind === 'game'), [tags]);
  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const pool = useMemo(() => poolFor(items, draft), [items, draft]);
  const lanes = useMemo(() => laneKeysFor(pool, tags), [pool, tags]);
  const available = useMemo(() => laneCounts(items, draft), [items, draft]);
  const counts = useMemo(() => countsInSet(draft.set), [draft.set]);

  const slots = slotsFor(draft.boardSize, draft.freeSpace);
  const filled = draft.set.length;
  const short = filled < slots;
  const nameBlank = draft.name.trim().length === 0;
  const pinned = new Set(draft.pinnedIds);

  function laneName(gameTagId: string | null): string {
    return gameTagId ? gameById.get(gameTagId)?.name ?? 'Unknown Game' : 'No Game';
  }

  function onSwap(index: number) {
    const { swapped, lane } = store().swap(index);
    if (!swapped) notify.info(`No more ${laneName(lane)} items`);
  }

  async function save(targetId: string | null) {
    setSaving(true);
    const name = draft.name.trim();
    const ok = await store().saveCard(targetId);
    setSaving(false);
    if (ok) notify.success(`Saved “${name}”`);
  }

  function onSave() {
    if (short || nameBlank) return;
    const match = savedCards.find((card) => sameName(card.name, draft.name));
    if (!match) {
      void save(null); // a new name: a new saved card, even when this draft was loaded from another
    } else if (match.id === draft.templateId) {
      void save(match.id); // the loaded card under its own name: update it
    } else {
      setReplaceTarget({ id: match.id, name: match.name });
    }
  }

  return (
    <section aria-label="Card" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="font-display text-lg font-bold">Card</h2>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" className={BTN} />}
          >
            Load Saved
            <ChevronDown strokeWidth={1.75} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-64">
            <DropdownMenuItem onClick={() => store().newCard()}>
              <Plus strokeWidth={1.75} />
              New Card
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {savedCards.length === 0 && <DropdownMenuItem disabled>No Saved Cards Yet</DropdownMenuItem>}
            {savedCards.map((card) => (
              <DropdownMenuItem
                key={card.id}
                onClick={() => store().loadCard(card)}
                className="justify-between gap-3"
              >
                <span className="truncate">{card.name}</span>
                <span className="shrink-0 font-mono text-[13px] text-muted-foreground">
                  {card.board_size}×{card.board_size}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-3 border-b px-4 pb-4">
        <Input
          value={draft.name}
          onChange={(e) => store().setName(e.target.value)}
          placeholder="Card Name"
          aria-label="Card Name"
          maxLength={60}
          className="h-9 text-sm"
        />

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            Size
            <Select
              items={SIZE_ITEMS}
              value={String(draft.boardSize)}
              onValueChange={(value) => { if (value) store().setBoardSize(Number(value)); }}
            >
              <SelectTrigger className="w-20 text-sm text-foreground transition-colors duration-150 hover:bg-muted/40" aria-label="Size">
                <SelectValue className="font-mono" />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)} className="font-mono">
                    {n}×{n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-[13px] whitespace-nowrap text-muted-foreground">
            <Switch checked={draft.freeSpace} onCheckedChange={(on) => store().setFreeSpace(on)} aria-label="Free Space" className={HOVER_CONTROL} />
            Free Space
          </label>

          <label className="ml-auto flex items-center gap-2 text-[13px] text-muted-foreground">
            Style
            <Select
              items={STYLE_ITEMS}
              value={draft.stylePreset}
              onValueChange={(value) => { if (value) store().setStylePreset(value); }}
            >
              <SelectTrigger className="w-28 text-sm text-foreground transition-colors duration-150 hover:bg-muted/40" aria-label="Style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARD_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <MixControl
          lanes={lanes}
          games={games}
          counts={counts}
          available={available}
          capped={capped}
          slots={mixSlots(draft)}
          onChange={(next) => store().setMix(next)}
        />

        {draft.poolIds && (
          <p className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
            <span>
              Drawing From This Card&rsquo;s <span className="font-mono text-foreground">{draft.poolIds.length}</span> Items
            </span>
            <Button variant="link" className={cn(BTN, 'h-auto px-0 text-[13px]')} onClick={() => store().useWholeLibrary()}>
              Use Whole Library
            </Button>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5">
        <p className="text-[13px] text-muted-foreground">
          <span className={cn('font-mono text-sm font-bold', short ? 'text-foreground' : 'text-success')} data-testid="set-count">
            {filled} / {slots}
          </span>
          {draft.pinnedIds.length > 0 && (
            <>
              {' · '}
              <span className="font-mono text-foreground">{draft.pinnedIds.length}</span> Pinned
            </>
          )}
        </p>
        <Button variant="outline" className={BTN} onClick={() => store().reshuffle()} disabled={pool.length === 0}>
          <Shuffle strokeWidth={1.75} />
          Reshuffle
        </Button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto border-t" aria-label="Card Items" data-testid="card-set">
        {draft.set.map((square, index) => (
          <SetRow
            key={square.libraryItemId ?? `text-${index}-${square.text}`}
            square={square}
            game={square.gameTagId ? gameById.get(square.gameTagId) ?? null : null}
            pinned={!!square.libraryItemId && pinned.has(square.libraryItemId)}
            onTogglePin={() => square.libraryItemId && store().togglePin(square.libraryItemId)}
            onSwap={() => onSwap(index)}
            onRemove={() => store().removeSquare(index)}
          />
        ))}
        {draft.set.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            Import items, then they fill the card from the mix.
          </li>
        )}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
        <p className="text-[13px] text-muted-foreground" data-testid="save-hint">
          {short ? (
            <>
              <span className="font-mono text-foreground">{slots}</span> Needed, <span className="font-mono text-foreground">{filled}</span> So Far
            </>
          ) : nameBlank ? (
            'Name The Card To Save It'
          ) : null}
        </p>
        {/* Phase 3: Host This Card goes here, beside Save Card. A saved, unchanged
            card (templateId set, dirty false) hosts by its id; anything else is
            inserted first as a card_templates row with saved = false. */}
        <Button className={BTN_PRIMARY} disabled={short || nameBlank || saving} onClick={onSave}>
          {saving && <Loader2 className="animate-spin" />}
          Save Card
        </Button>
      </div>

      <ConfirmDialog
        open={replaceTarget !== null}
        onOpenChange={(open) => { if (!open) setReplaceTarget(null); }}
        title={`Replace “${replaceTarget?.name ?? ''}”?`}
        body="Your saved card with this name is overwritten by this one."
        confirmLabel="Replace"
        onConfirm={async () => { if (replaceTarget) await save(replaceTarget.id); }}
      />
    </section>
  );
}

function SetRow({
  square,
  game,
  pinned,
  onTogglePin,
  onSwap,
  onRemove,
}: {
  square: SquareItem;
  game: Tag | null;
  pinned: boolean;
  onTogglePin: () => void;
  onSwap: () => void;
  onRemove: () => void;
}) {
  // A saved card's item the library no longer has: it can be removed or
  // swapped, but not pinned (a pin is a library id).
  const textOnly = !square.libraryItemId;
  return (
    <li
      className={cn(
        'flex h-10 items-center gap-2.5 border-b border-border/60 pr-2 pl-4 transition-colors duration-150 hover:bg-muted/40',
        pinned && 'bg-primary/[0.06]',
      )}
      data-pinned={pinned || undefined}
      data-library-id={square.libraryItemId}
    >
      <GameGlyph game={game} />
      <span className="min-w-0 flex-1 truncate text-sm" title={square.text}>
        {square.text}
      </span>
      {textOnly ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className={BTN}
          onClick={onRemove}
          aria-label="Remove From Card"
          title="Not In Your Library · Remove From Card"
        >
          <X strokeWidth={1.75} />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(BTN, pinned && 'text-primary hover:text-primary')}
          onClick={onTogglePin}
          aria-pressed={pinned}
          aria-label={pinned ? 'Unpin' : 'Pin'}
          title={pinned ? 'Unpin' : 'Pin'}
        >
          <Pin strokeWidth={1.75} className={cn(pinned && 'fill-current')} />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        className={BTN}
        onClick={onSwap}
        disabled={pinned}
        aria-label="Swap"
        title={pinned ? 'Unpin To Swap' : 'Swap'}
      >
        <ArrowLeftRight strokeWidth={1.75} />
      </Button>
    </li>
  );
}
