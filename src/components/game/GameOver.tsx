'use client';

import { Trophy, Home, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { useGameStore } from '@/stores/gameStore';
import type { Room } from '@/types/game';
import type { PresencePlayer } from '@/hooks/useRealtimeRoom';

interface GameOverProps {
  room: Room;
  currentPlayerId: string;
  presentPlayers: PresencePlayer[];
  onNewRound?: () => Promise<void>;
}

export function GameOver({ room, currentPlayerId, presentPlayers, onNewRound }: GameOverProps) {
  const router = useRouter();
  const { winners, roundNumber } = useGameStore();
  const isHost = currentPlayerId === room.host_id;
  const winner = winners[0];

  // Find the winner's presence info for their avatar
  const winnerPresence = presentPlayers.find((p) => p.playerId === winner?.playerId);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="space-y-8 max-w-sm w-full">

        {/* Trophy */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-accent/20 ring-4 ring-accent/30 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-accent" />
          </div>
        </div>

        {/* Winner info */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Round {roundNumber} — Game Over
          </p>
          {winner ? (
            <div className="space-y-3">
              <h2 className="font-display text-5xl font-black">BINGO!</h2>
              <div className="flex items-center justify-center gap-3">
                {winnerPresence && (
                  <PlayerAvatar
                    playerId={winner.playerId}
                    displayName={winner.displayName}
                    avatarUrl={winnerPresence.avatarUrl}
                    size="md"
                  />
                )}
                <div className="text-left">
                  <p className="font-semibold text-lg">{winner.displayName}</p>
                  <p className="text-sm text-muted-foreground capitalize">{winner.pattern} — first place</p>
                </div>
              </div>
              {winners.length > 1 && (
                <p className="text-sm text-muted-foreground">
                  +{winners.length - 1} other winner{winners.length > 2 ? 's' : ''}
                </p>
              )}
            </div>
          ) : (
            <h2 className="font-display text-4xl font-black">Game Over</h2>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {isHost && onNewRound && (
            <Button size="lg" className="w-full gap-2" onClick={onNewRound}>
              <RotateCcw className="w-4 h-4" />
              Play Again
            </Button>
          )}
          {!isHost && (
            <p className="text-sm text-muted-foreground">Waiting for the host to start a new game…</p>
          )}
          <Button variant="outline" className="w-full gap-2" onClick={() => router.push('/')}>
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </div>

      </div>
    </div>
  );
}
