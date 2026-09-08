'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { SquareItem, CardStyles } from '@/types/card';

interface BingoSquareProps {
  item: SquareItem;
  index: number;
  variant: 'editor' | 'preview' | 'game';
  isFreeSpace?: boolean;
  styles?: CardStyles;
  // editor
  isEditing?: boolean;
  onEdit?: () => void;
  onChange?: (item: SquareItem) => void;
  onBlur?: () => void;
  // game
  isMarked?: boolean;
  isCalled?: boolean;
  onMark?: () => void;
}

export function BingoSquare({
  item,
  variant,
  isFreeSpace = false,
  styles,
  isEditing = false,
  onEdit,
  onChange,
  onBlur,
  isMarked = false,
  isCalled = false,
  onMark,
}: BingoSquareProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input whenever this square enters edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  // Whether custom color overrides are active — disables conflicting Tailwind classes
  const hasCustomColors = !!(styles?.squareBg || styles?.squareBgMarked);

  const base = cn(
    'relative flex items-center justify-center p-[4%]',
    // Fluid font size: 12cqw = 12% of the cell width — scales with board size
    'text-center font-medium leading-tight',
    'text-[clamp(0.6rem,12cqw,1.1rem)]',
    'border border-grid-line transition-all duration-150',
    'aspect-square w-full overflow-hidden',
  );

  // Shared inline style for text + border color (applies to all variants)
  const baseInlineStyle = {
    borderColor: styles?.gridLine,
    color: styles?.textColor,
  };

  // FREE SPACE — non-interactive
  if (isFreeSpace) {
    return (
      <div
        style={{
          ...baseInlineStyle,
          backgroundColor: styles?.squareBgFree,
        }}
        className={cn(
          base,
          // Only use the violet bloom treatment when no custom override
          !styles?.squareBgFree && 'sq-free bg-primary/15',
          'select-none',
        )}
      >
        <span
          style={{ color: styles?.textColor }}
          className={cn(
            'font-display font-bold text-xs tracking-widest uppercase',
            !styles?.textColor && 'text-primary',
          )}
        >
          Free
        </span>
      </div>
    );
  }

  // EDITOR variant — inline editing on click
  if (variant === 'editor') {
    if (isEditing) {
      return (
        <div
          style={baseInlineStyle}
          className={cn(base, 'bg-card ring-2 ring-primary p-0')}
        >
          <input
            ref={inputRef}
            value={item.text ?? ''}
            onChange={(e) => onChange?.({ ...item, text: e.target.value })}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                onBlur?.();
              }
            }}
            className="w-full h-full text-center bg-transparent outline-none text-sm px-1 text-foreground placeholder:text-muted-foreground/40"
            maxLength={60}
            placeholder="Type here…"
          />
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={onEdit}
        style={{
          ...baseInlineStyle,
          backgroundColor: styles?.squareBg,
        }}
        className={cn(
          base,
          'cursor-pointer active:scale-95',
          !hasCustomColors && 'hover:bg-primary/10 hover:ring-1 hover:ring-primary/50',
          item.text ? 'text-foreground' : 'text-muted-foreground/25',
        )}
        title="Click to edit"
      >
        <span className="break-words line-clamp-3">{item.text || '+'}</span>
      </button>
    );
  }

  // GAME variant — mark on click, glow when marked
  if (variant === 'game') {
    // The pulse keyframes read --sq-glow, so a custom marked color drives the
    // animation too. The static box-shadow below is byte-identical to the
    // keyframes' 0%/100% frame, so the glow settles without a visible jump.
    const customGlow = styles?.squareBgMarked;
    const gameStyle = {
      ...baseInlineStyle,
      ...(hasCustomColors && {
        backgroundColor: isMarked ? styles?.squareBgMarked : styles?.squareBg,
        ...(isMarked && customGlow
          ? {
              '--sq-glow': customGlow,
              boxShadow: `0 0 0 2px ${customGlow}, 0 0 14px color-mix(in oklab, ${customGlow} 35%, transparent)`,
            }
          : {}),
      }),
    } as React.CSSProperties;

    return (
      <button
        type="button"
        onClick={onMark}
        style={gameStyle}
        className={cn(
          base,
          'cursor-pointer select-none',
          // 150ms dab + amber breathing pulse that settles. Applied for custom
          // palettes too — the keyframes pick up --sq-glow from the inline style.
          isMarked && 'sq-marked',
          // Default Tailwind colors only when no custom override
          !hasCustomColors && isMarked && [
            // No ring-* here: the 2px ring is baked into the shadow below so it
            // matches the pulse keyframes exactly.
            'bg-accent/25 text-foreground',
            'shadow-[0_0_0_2px_var(--accent),0_0_14px_color-mix(in_oklab,var(--accent)_35%,transparent)]',
          ],
          !hasCustomColors && isCalled && !isMarked && 'bg-primary/10 text-foreground',
          !hasCustomColors && !isMarked && !isCalled && 'hover:bg-primary/5',
        )}
      >
        <span className="break-words line-clamp-3">{item.text}</span>
      </button>
    );
  }

  // PREVIEW variant — read-only display
  return (
    <div
      style={{
        ...baseInlineStyle,
        backgroundColor: styles?.squareBg,
      }}
      className={cn(base, !styles?.squareBg && 'bg-card/40', 'select-none')}
    >
      <span className="break-words line-clamp-3">{item.text}</span>
    </div>
  );
}
