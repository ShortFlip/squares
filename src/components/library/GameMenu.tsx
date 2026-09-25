'use client';

import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { BTN, GameGlyph } from './GameGlyph';
import type { Tag } from '@/types/library';

// Radio values are strings; this stands in for null (No Game) and can never be a uuid.
const NONE = '__none';

/**
 * A game picker: a trigger showing the game, and a radio list to change it.
 * `row` is the compact, borderless trigger on each item row. `field` is the
 * same menu dressed as a form field (the Input's border, fill and 32px
 * height), for the Add an Item row, where it pairs with a text input. The
 * field closes on a pick, like a select, and hands focus to `finalFocus` (the
 * row's input) so the next keystroke goes into the item text.
 */
export function RowGameMenu({
  games,
  value,
  onChange,
  disabled,
  variant = 'row',
  label = 'Game',
  finalFocus,
}: {
  games: Tag[];
  value: string | null;
  onChange: (gameTagId: string | null) => void;
  disabled?: boolean;
  variant?: 'row' | 'field';
  /** The trigger's accessible name. */
  label?: string;
  /** Where focus goes when the menu closes (default: back to the trigger). */
  finalFocus?: React.RefObject<HTMLElement | null>;
}) {
  const current = games.find((g) => g.id === value) ?? null;
  const field = variant === 'field';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={label}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 border outline-none',
          BTN,
          field
            // w-44, not the row's w-40: at 14px with a 16px glyph "Rocket League" needs the extra 16px to show whole.
            ? 'h-8 w-44 rounded-lg border-input bg-transparent px-2.5 text-sm dark:bg-input/30'
            // w-52 so "Modern Warfare 2019" shows whole — game names are the row's only label now.
            : 'h-7 w-52 rounded-md border-transparent px-2 text-[13px]',
          field
            ? 'text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted dark:hover:bg-input/50 dark:active:bg-input/70'
            : 'text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground active:bg-muted',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          field ? 'aria-expanded:bg-muted/50 dark:aria-expanded:bg-input/50' : 'aria-expanded:border-border aria-expanded:bg-muted/50',
          'disabled:pointer-events-none disabled:opacity-50',
          current && 'text-foreground',
        )}
      >
        {/* 14px inside the compact row trigger (the chip size); 16px in the field, the icon rule. */}
        <GameGlyph game={current} size={field ? 16 : 14} />
        <span className="min-w-0 flex-1 truncate text-left">{current ? current.name : 'No Game'}</span>
        <ChevronDown className={cn(field ? 'size-4' : 'size-3.5', 'opacity-60')} strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" finalFocus={finalFocus}>
        <DropdownMenuRadioGroup
          value={value ?? NONE}
          onValueChange={(next: string) => onChange(next === NONE ? null : next)}
        >
          {games.map((g) => (
            <DropdownMenuRadioItem key={g.id} value={g.id} closeOnClick={field}>
              <GameGlyph game={g} />
              {g.name}
            </DropdownMenuRadioItem>
          ))}
          {games.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuRadioItem value={NONE} closeOnClick={field}>
            <GameGlyph game={null} />
            No Game
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A labelled outline button that opens a list of choices (Set Game, Add Tag, Remove Tag). */
export function PickMenu<T extends { id: string }>({
  label,
  options,
  render,
  onPick,
  empty,
  extra,
}: {
  label: string;
  options: T[];
  render: (option: T) => React.ReactNode;
  onPick: (option: T) => void;
  /** Shown, disabled, when there is nothing to pick. */
  empty: string;
  /** A trailing choice after a separator (No Game on Set Game). */
  extra?: { label: React.ReactNode; onPick: () => void };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-sm font-medium whitespace-nowrap outline-none',
          BTN,
          'hover:bg-muted active:bg-muted/80 aria-expanded:bg-muted dark:bg-input/30 dark:hover:bg-input/50',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        {label}
        <ChevronDown className="size-4 opacity-60" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {options.length === 0 && !extra && <DropdownMenuItem disabled>{empty}</DropdownMenuItem>}
        {options.map((option) => (
          <DropdownMenuItem key={option.id} onClick={() => onPick(option)}>
            {render(option)}
          </DropdownMenuItem>
        ))}
        {extra && (
          <>
            {options.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={extra.onPick}>{extra.label}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
