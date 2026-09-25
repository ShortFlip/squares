'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addItemDefaults } from '@/lib/library/add-item';
import { textKey } from '@/lib/library/card-draft';
import { cn } from '@/lib/utils';
import { useLibraryStore } from '@/stores/libraryStore';
import { BTN_PRIMARY } from './GameGlyph';
import { RowGameMenu } from './GameMenu';
import type { LibraryItem, Tag } from '@/types/library';

interface AddItemRowProps {
  games: Tag[];
  /** Make an item visible in the list (search, filter), scroll to it and light its row. */
  onReveal: (item: LibraryItem) => void;
}

/**
 * "Add an Item": type one item, pick its game, Enter. Pinned between the
 * toolbar and the list so it never scrolls away.
 *
 * Built for rapid entry: the input keeps focus and clears after each save,
 * and success is the new row lighting up in the list rather than a toast (a
 * toast per item would stack up bottom-left). The save goes through the same
 * importItems path as Import List, so the dedupe rule is the same one: a
 * duplicate adds nothing, keeps the text, and points at the item he already has.
 */
export function AddItemRow({ games, onReveal }: AddItemRowProps) {
  const tags = useLibraryStore((s) => s.tags);
  const filter = useLibraryStore((s) => s.filter);
  const addPick = useLibraryStore((s) => s.addPick);
  const addLastGame = useLibraryStore((s) => s.addLastGame);
  const pickAddGame = useLibraryStore((s) => s.pickAddGame);
  const importList = useLibraryStore((s) => s.importList);

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const noticeId = useId();

  const defaults = useMemo(() => addItemDefaults(filter, tags, addLastGame), [filter, tags, addLastGame]);
  const gameTagId = addPick ? addPick.gameTagId : defaults.gameTagId;
  const blank = text.trim().length === 0;

  async function add() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    const result = await importList([value], gameTagId, defaults.tagIds, 'Could not add that item. Nothing was added.');
    setBusy(false);
    // Tabbing to Add and pressing Enter leaves focus on the button; the next item is typed here.
    inputRef.current?.focus();
    // Failed: the store has already toasted the error. The text stays for a retry.
    if (!result) return;

    const key = textKey(value);
    const item = useLibraryStore.getState().items.find((i) => textKey(i.text) === key);
    if (result.added > 0) {
      // Clear only what was saved: if he has already typed the next item while
      // this one saved, that text is his and stays.
      setText((current) => (current.trim() === value ? '' : current));
      setDuplicate(false);
    } else {
      // Nothing added and nothing failed: importItems skipped it as a text he
      // already has (trimmed, case-insensitive). Keep the text so he can edit it.
      setDuplicate(true);
    }
    if (item) onReveal(item);
  }

  return (
    <form
      aria-label="Add an Item"
      className="flex items-center gap-2 border-b px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Plus
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDuplicate(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setText('');
              setDuplicate(false);
            }
          }}
          placeholder="Add an Item…"
          aria-label="Add an Item"
          aria-describedby={duplicate ? noticeId : undefined}
          autoComplete="off"
          // Room on the right for the duplicate notice, which sits inside the field.
          className={cn('pl-8 text-sm', duplicate && 'pr-48')}
        />
        {duplicate && (
          <p
            id={noticeId}
            role="status"
            data-testid="add-item-duplicate"
            className="pointer-events-none absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1.5 text-[13px] whitespace-nowrap text-foreground/85"
          >
            <AlertCircle className="size-4 text-accent" strokeWidth={1.75} />
            Already in your library
          </p>
        )}
      </div>

      <RowGameMenu
        games={games}
        value={gameTagId}
        onChange={pickAddGame}
        variant="field"
        label="New Item Game"
        finalFocus={inputRef}
      />

      <Button
        type="submit"
        className={BTN_PRIMARY}
        disabled={blank || busy}
        // A mouse click must not pull focus out of the input: he types the next
        // item straight away, even while this one is still saving.
        onMouseDown={(e) => e.preventDefault()}
      >
        Add
      </Button>
    </form>
  );
}
