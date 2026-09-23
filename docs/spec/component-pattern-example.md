# The component pattern example

- **Date:** undated
- **Symptom:** The example imports `cn` from `@/lib/utils/cn`, which does not exist; all 13 call sites import it from `@/lib/utils`.
- **Measurement:** none recorded
- **Rule:** Components are `'use client'` when interactive, a named export with a typed `Props` interface, and merge classes with `cn()` from `@/lib/utils`.
- **Code site:** `src/lib/utils.ts`, `src/components/board/BingoSquare.tsx`

## Original note (moved verbatim from CLAUDE.md, 2026-09-22)

### Component Pattern
```tsx
// components/board/BingoSquare.tsx
'use client';

import { cn } from '@/lib/utils/cn';
import type { Square } from '@/types/card';

interface BingoSquareProps {
  square: Square;
  isMarked: boolean;
  isCalled: boolean;
  onMark: () => void;
}

export function BingoSquare({ square, isMarked, isCalled, onMark }: BingoSquareProps) {
  return (
    <button
      onClick={onMark}
      className={cn(
        'aspect-square flex items-center justify-center p-2 transition-all duration-150',
        'border border-grid-line text-sm font-medium',
        isMarked && 'bg-amber-500/20 ring-2 ring-amber-500',
        isCalled && !isMarked && 'bg-violet-500/10',
      )}
    >
      {square.text}
    </button>
  );
}
```
