'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Save, ClipboardList, X, Plus } from 'lucide-react';
import { BingoBoard } from './BingoBoard';
import { BoardPreview } from './BoardPreview';
import { CardStylePicker } from './CardStylePicker';
import {
  useEditorStore,
  neededFor,
  surplusFor,
  shortByFor,
} from '@/stores/editorStore';
import { parseImport } from '@/lib/game/import';
import { usePlayer } from '@/hooks/usePlayer';
import { createClient } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const BOARD_SIZES = [3, 4, 5, 6] as const;

export function BoardEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id'); // present when editing an existing template
  const { player } = usePlayer();

  const {
    name, boardSize, items, shuffleMode, freeSpace, isPublic, styles,
    editingIndex, isPreviewMode, isSaving,
    setName, setBoardSize, setItem, setShuffleMode, setFreeSpace,
    setStyles, setEditingIndex, setPreviewMode, setSaving, bulkFill,
    removeItem, addItem, pruneEmpty, loadItems,
  } = useEditorStore();

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [previewSeed, setPreviewSeed] = useState('preview-1');
  const [newItemText, setNewItemText] = useState('');

  // If ?id= is set, load the existing template into the editor store
  useEffect(() => {
    if (!editId) return;
    const supabase = createClient();
    supabase
      .from('card_templates')
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setName(data.name);
        setBoardSize(data.board_size as 3 | 4 | 5 | 6);
        setShuffleMode(data.shuffle_mode as 'full' | 'column');
        setFreeSpace(data.free_space);
        setStyles((data.styles as import('@/types/card').CardStyles) ?? {});
        // Legacy templates were saved as exactly N² entries with a blank at the
        // free-space index. loadItems strips those blanks so an old 5×5 card
        // arrives as a clean 24-item pool. No migration needed.
        loadItems(data.items as import('@/types/card').SquareItem[]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // How many squares one card needs, and how the pool measures up.
  const needed = neededFor(boardSize, freeSpace);
  const surplus = surplusFor(items.length, needed);
  const shortBy = shortByFor(items.length, needed);
  const isShort = shortBy > 0;

  // The grid is a window onto the first `needed` pool entries. BingoBoard maps
  // grid position → pool index for us (skipping the FREE center); these two
  // helpers let us go back the other way when a click lands past the pool.
  const centerIndex = Math.floor((boardSize * boardSize) / 2);
  const gridIndexOfPool = (poolIndex: number) =>
    freeSpace && poolIndex >= centerIndex ? poolIndex + 1 : poolIndex;

  /**
   * Clicking an empty cell beyond the pool appends rather than leaving a hole,
   * so the edit cursor jumps to the first blank cell instead of the one clicked.
   */
  function handleEditSquare(gridIndex: number) {
    const poolIndex =
      freeSpace && gridIndex > centerIndex ? gridIndex - 1 : gridIndex;
    setEditingIndex(
      poolIndex > items.length ? gridIndexOfPool(items.length) : gridIndex,
    );
  }

  const parsedBulk = parseImport(bulkText);

  async function handleSave() {
    if (!player) {
      toast.error('Not signed in — refresh and try again.');
      return;
    }
    if (!name.trim()) {
      toast.error('Give your card a name first.');
      return;
    }
    if (isShort) {
      toast.error(`${needed} needed, ${items.length} so far.`);
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        name: name.trim(),
        board_size: boardSize,
        items: items as unknown as Json,
        styles: styles as unknown as Json,
        shuffle_mode: shuffleMode,
        free_space: freeSpace,
        is_public: isPublic,
      };

      const { error } = editId
        ? await supabase.from('card_templates').update(payload).eq('id', editId)
        : await supabase.from('card_templates').insert({ ...payload, creator_id: player.id });

      if (error) throw error;

      toast.success(editId ? 'Card updated!' : 'Card saved!');
      router.push('/?create=true');
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleBulkApply() {
    const { added, skipped } = bulkFill(bulkText);
    setBulkText('');
    setBulkDialogOpen(false);
    toast.success(
      skipped > 0
        ? `Added ${added} items, skipped ${skipped} duplicates`
        : `Added ${added} items`,
    );
  }

  function handleAddItem() {
    if (!newItemText.trim()) return;
    addItem(newItemText);
    setNewItemText('');
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display text-2xl font-bold">Card Creator</h1>
        <div className="flex items-center gap-3">
          {/* The one count line: how big the pool is against what a card needs. */}
          {isShort ? (
            <p className="text-sm text-destructive">
              <span className="font-mono">{needed}</span> needed,{' '}
              <span className="font-mono">{items.length}</span> so far
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{items.length}</span> items,{' '}
              <span className="font-mono">{needed}</span> per card
              {surplus > 0 && (
                <span className="text-success">
                  {' '}— <span className="font-mono">{surplus}</span> rotate in each round
                </span>
              )}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewMode(!isPreviewMode)}
          >
            {isPreviewMode ? (
              <><EyeOff className="w-4 h-4 mr-1.5" /> Edit</>
            ) : (
              <><Eye className="w-4 h-4 mr-1.5" /> Preview</>
            )}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || isShort}>
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? 'Saving…' : 'Save Card'}
          </Button>
        </div>
      </div>

      {/* ── Card title ── */}
      <div className="space-y-1.5">
        <Label htmlFor="card-name">Card name</Label>
        <Input
          id="card-name"
          placeholder="e.g. Movie Night Bingo, Sports Buzzword Bingo…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* ── Settings row ── */}
      <div className="flex flex-wrap gap-6 items-center">

        {/* Board size */}
        <div className="space-y-1.5">
          <Label>Board size</Label>
          <div className="flex gap-1">
            {BOARD_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setBoardSize(size)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  boardSize === size
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {size}×{size}
              </button>
            ))}
          </div>
        </div>

        {/* Free space toggle */}
        <div className="space-y-1.5">
          <Label>Free space</Label>
          <div className="flex gap-1">
            {(['on', 'off'] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setFreeSpace(val === 'on')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                  (val === 'on') === freeSpace
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Shuffle mode toggle */}
        <div className="space-y-1.5">
          <Label>Shuffle mode</Label>
          <div className="flex gap-1">
            {(['full', 'column'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setShuffleMode(mode)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                  shuffleMode === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Card style ── */}
      <CardStylePicker value={styles} onChange={setStyles} />

      {/* ── Board + sidebar ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* The board — editor or preview */}
        <div className="flex-1 min-w-0">
          {isPreviewMode ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This is how a player&apos;s card would look after shuffling.
              </p>
              <BoardPreview
                items={items}
                boardSize={boardSize}
                freeSpace={freeSpace}
                shuffleMode={shuffleMode}
                styles={styles}
                seed={previewSeed}
                className="max-w-lg"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewSeed(`preview-${Math.random()}`)}
              >
                Reshuffle preview
              </Button>
            </div>
          ) : (
            <BingoBoard
              items={items}
              boardSize={boardSize}
              freeSpace={freeSpace}
              variant="editor"
              styles={styles}
              editingIndex={editingIndex}
              onEditSquare={handleEditSquare}
              onChangeSquare={(itemIdx, item) => setItem(itemIdx, item)}
              onBlurSquare={() => {
                setEditingIndex(null);
                // A cell left blank never becomes a pool entry.
                pruneEmpty();
              }}
              className="max-w-lg"
            />
          )}

          {/* Items past what one card needs — they rotate in on later rounds. */}
          {!isPreviewMode && surplus > 0 && (
            <div className="max-w-lg mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                In the pool for other rounds
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {items.slice(needed).map((item, i) => (
                  <li
                    key={`${needed + i}-${item.text}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-card pl-2 pr-1 py-1 text-xs"
                  >
                    <span className="max-w-40 truncate">{item.text}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(needed + i)}
                      aria-label={`Remove ${item.text}`}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <X className="w-3 h-3" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick single-item add — always available, pool or not. */}
          {!isPreviewMode && (
            <div className="max-w-lg mt-3 flex items-center gap-2">
              <Input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
                placeholder="Add an item…"
                className="h-8 max-w-56 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                disabled={!newItemText.trim()}
              >
                <Plus className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
                Add item
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar — fill progress + bulk import */}
        <div className="w-full lg:w-56 shrink-0 space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setBulkDialogOpen(true)}
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            Bulk import
          </Button>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Click any square to edit. Press <kbd className="px-1 py-0.5 rounded bg-muted text-xs">Enter</kbd> or click away to confirm. The grid shows the first <span className="font-mono">{needed}</span> items in the pool.
          </p>
        </div>
      </div>

      {/* ── Bulk import dialog ── */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk import</DialogTitle>
            <DialogDescription>
              Items are added to the card&apos;s pool. Anything already in the pool is skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              placeholder="One per line, or comma-separated"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={10}
              className="font-mono text-sm resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkApply} disabled={parsedBulk.length === 0}>
                Add <span className="font-mono mx-1">{parsedBulk.length}</span> items
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
