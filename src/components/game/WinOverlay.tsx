'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { playBingo } from '@/lib/sound';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/stores/gameStore';
import type { WinPattern } from '@/types/game';

const PATTERN_LABELS: Record<WinPattern, string> = {
  row:         'Full Row',
  column:      'Full Column',
  diagonal:    'Diagonal',
  four_corners: 'Four Corners',
  blackout:    'BLACKOUT',
  custom:      'Custom Pattern',
};

interface WinOverlayProps {
  isHost: boolean;
  onNewRound?: () => void;
  onEndGame?: () => void;
}

export function WinOverlay({ isHost, onNewRound, onEndGame }: WinOverlayProps) {
  const { winners } = useGameStore();
  const winner = winners[0]; // show first winner

  useEffect(() => {
    if (!winner) return;

    playBingo();

    // Fire confetti in the project's color palette
    const colors = ['#7c3aed', '#f59e0b', '#10b981', '#f43f5e', '#60a5fa'];

    // Initial burst
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors });

    // Follow-up bursts for drama
    const t1 = setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 }, colors }), 400);
    const t2 = setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 }, colors }), 600);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [winner?.playerId]);

  if (!winner) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 text-center p-8 max-w-sm">
        <div className="w-20 h-20 rounded-full bg-accent/20 ring-4 ring-accent/40 flex items-center justify-center">
          <Trophy className="w-9 h-9 text-accent" />
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-sm uppercase tracking-widest">
            {PATTERN_LABELS[winner.pattern] ?? 'Bingo'}
          </p>
          <h2 className="font-display text-4xl font-black text-foreground">
            BINGO!
          </h2>
          <p className="text-xl font-semibold text-foreground/80">
            {winner.displayName}
          </p>
        </div>

        {winners.length > 1 && (
          <p className="text-sm text-muted-foreground">
            +{winners.length - 1} more winner{winners.length > 2 ? 's' : ''}
          </p>
        )}

        {isHost && (
          <div className="w-full flex flex-col gap-2">
            {onNewRound && (
              <Button size="lg" className="w-full" onClick={onNewRound}>
                New Round
              </Button>
            )}
            {onEndGame && (
              <Button size="lg" variant="outline" className="w-full" onClick={onEndGame}>
                End Game Night
              </Button>
            )}
          </div>
        )}
        {!isHost && (
          <p className="text-sm text-muted-foreground">Waiting for host to start a new round…</p>
        )}
      </div>
    </div>
  );
}
