'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoomCodeDisplayProps {
  code: string;
  className?: string;
}

/**
 * Displays the room code in large JetBrains Mono with a copy-to-clipboard button.
 * Big enough to read aloud over a video call without squinting.
 */
export function RoomCodeDisplay({ code, className }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
        Room Code
      </p>
      <div className="flex items-center gap-3">
        <span className="font-mono text-5xl font-bold tracking-[0.2em] text-foreground select-all">
          {code}
        </span>
        <button
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy code'}
          className={cn(
            'p-2 rounded-lg transition-all duration-150',
            'text-muted-foreground hover:text-foreground hover:bg-muted',
            copied && 'text-success',
          )}
        >
          {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Share this code with your friends to join
      </p>
    </div>
  );
}
