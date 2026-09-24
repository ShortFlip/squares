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

/** One row's game: a compact trigger showing the game, and a radio list to change it. */
export function RowGameMenu({
  games,
  value,
  onChange,
  disabled,
}: {
  games: Tag[];
  value: string | null;
  onChange: (gameTagId: string | null) => void;
  disabled?: boolean;
}) {
  const current = games.find((g) => g.id === value) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label="Game"
        className={cn(
          'inline-flex h-7 w-40 shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2 text-[13px] outline-none',
          BTN,
          'text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground active:bg-muted',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'aria-expanded:border-border aria-expanded:bg-muted/50 disabled:pointer-events-none disabled:opacity-50',
          current && 'text-foreground',
        )}
      >
        <GameGlyph game={current} size={14} />
        <span className="min-w-0 flex-1 truncate text-left">{current ? current.name : 'No Game'}</span>
        <ChevronDown className="size-3.5 opacity-60" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuRadioGroup
          value={value ?? NONE}
          onValueChange={(next: string) => onChange(next === NONE ? null : next)}
        >
          {games.map((g) => (
            <DropdownMenuRadioItem key={g.id} value={g.id}>
              <GameGlyph game={g} />
              {g.name}
            </DropdownMenuRadioItem>
          ))}
          {games.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuRadioItem value={NONE}>
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
