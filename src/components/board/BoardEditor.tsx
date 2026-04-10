'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Save, ClipboardList } from 'lucide-react';
import { BingoBoard } from './BingoBoard';
import { BoardPreview } from './BoardPreview';
import { CardStylePicker } from './CardStylePicker';
import { useEditorStore } from '@/stores/editorStore';
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

/** Minimum non-empty squares required to save (rough validation) */
function countFilled(items: { text?: string }[]): number {
  return items.filter((i) => i.text && i.text.trim().length > 0).length;
}

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
  } = useEditorStore();

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [previewSeed, setPreviewSeed] = useState('preview-1');

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
        // Populate each item slot
        const loaded = data.items as { text?: string }[];
        loaded.forEach((item, i) => setItem(i, { text: item.text ?? '' }));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // Grid slots = N*N minus 1 for free space (center not editable)
  const requiredSlots = boardSize * boardSize - (freeSpace ? 1 : 0);
  const filledCount = countFilled(items);

  async function handleSave() {
    if (!player) {
      toast.error('Not signed in — refresh and try again.');
      return;
    }
    if (!name.trim()) {
      toast.error('Give your card a name first.');
      return;
    }
    if (filledCount < requiredSlots) {
      toast.error(`Fill in all ${requiredSlots} squares before saving. (${filledCount}/${requiredSlots} done)`);
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
    bulkFill(bulkText);
    setBulkText('');
    setBulkDialogOpen(false);
    toast.success('Items imported!');
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display text-2xl font-bold">Card Creator</h1>
        <div className="flex items-center gap-2">
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
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
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
              onEditSquare={(i) => setEditingIndex(i)}
              onChangeSquare={(itemIdx, item) => setItem(itemIdx, item)}
              onBlurSquare={() => setEditingIndex(null)}
              className="max-w-lg"
            />
          )}
        </div>

        {/* Sidebar — fill progress + bulk import */}
        <div className="w-full lg:w-56 shrink-0 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-medium">Squares filled</p>
            <p className="font-display text-3xl font-bold text-primary">
              {filledCount}
              <span className="text-muted-foreground text-lg font-normal">
                /{requiredSlots}
              </span>
            </p>
            {filledCount < requiredSlots && (
              <p className="text-xs text-muted-foreground">
                {requiredSlots - filledCount} more to go
              </p>
            )}
            {filledCount >= requiredSlots && (
              <p className="text-xs text-success font-medium">Ready to save ✓</p>
            )}
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setBulkDialogOpen(true)}
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            Bulk import
          </Button>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Click any square to edit. Press <kbd className="px-1 py-0.5 rounded bg-muted text-xs">Enter</kbd> or click away to confirm.
          </p>
        </div>
      </div>

      {/* ── Bulk import dialog ── */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk import</DialogTitle>
            <DialogDescription>
              Paste one item per line. Items fill the grid from the top-left, skipping the FREE space.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              placeholder={'Action hero\nCatchphrase\nExplosion\n…'}
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
              <Button onClick={handleBulkApply} disabled={!bulkText.trim()}>
                Fill {bulkText.trim().split('\n').filter(Boolean).length} items
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
