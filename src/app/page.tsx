'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowRight, Grid3x3, History, Trophy, LogIn } from 'lucide-react';
import { CreateRoomDialog } from '@/components/game/CreateRoomDialog';
import { TemplateList } from '@/components/game/TemplateList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeRoomCode, isValidRoomCode } from '@/lib/game/room-code';
import { createClient } from '@/lib/supabase/client';
import { getLastRoom, clearLastRoom, type LastRoom } from '@/lib/utils/last-room';

// How long a remembered room stays offerable. A game night is one evening; a
// chip for yesterday's room is noise, not help.
const REJOIN_WINDOW_MS = 18 * 60 * 60 * 1000;

// Separated into its own component because useSearchParams() requires a Suspense boundary
function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(() => searchParams.get('create') === 'true');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  // Null until we have confirmed with the database that the room is still live.
  const [rejoin, setRejoin] = useState<LastRoom | null>(null);

  // Offer a one-click way back into the room this browser was last in, but only
  // while that room is still going. Anything unexpected (no memory, stale
  // memory, room finished, query failed) leaves the chip hidden.
  useEffect(() => {
    const last = getLastRoom();
    if (!last) return;
    if (Date.now() - new Date(last.savedAt).getTime() > REJOIN_WINDOW_MS) {
      clearLastRoom();
      return;
    }

    let cancelled = false;
    createClient()
      .from('rooms')
      .select('status')
      .eq('join_code', last.code)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Silent: the join box below still works, so there is nothing to
          // tell the player about.
          console.error('Failed to check the last room:', error);
          return;
        }
        if (!data) {
          clearLastRoom();
          return;
        }
        if (data.status === 'finished') {
          clearLastRoom();
          return;
        }
        setRejoin(last);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleJoinInput(e: React.ChangeEvent<HTMLInputElement>) {
    const normalized = normalizeRoomCode(e.target.value).slice(0, 6);
    setJoinCode(normalized);
    setJoinError('');
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidRoomCode(joinCode)) {
      setJoinError('Enter a valid 6-character room code.');
      return;
    }
    router.push(`/room/${joinCode}`);
  }

  return (
    <main className="min-h-screen flex flex-col px-4 py-12">
      <div className="max-w-3xl mx-auto w-full space-y-12">

        {/* ── Hero ── */}
        <div className="text-center space-y-3 pt-4">
          <div className="flex items-center justify-center">
            <Grid3x3 className="w-9 h-9 text-primary" />
          </div>
          <h1 className="font-display text-6xl font-black tracking-tight">SQUARES</h1>
          <p className="text-muted-foreground max-w-xs mx-auto">
            Real-time bingo for your friend group.
          </p>
        </div>

        {/* Rejoin — sits above the action cards so the way back into a live
            room is the first thing a returning player sees. */}
        {rejoin && (
          <button
            type="button"
            onClick={() => router.push(`/room/${rejoin.code}`)}
            className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-5 py-4 text-left transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogIn className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold">
                Rejoin{rejoin.name ? ` ${rejoin.name}` : ''}
              </p>
              <p className="text-sm text-muted-foreground">
                You were in <span className="font-mono">{rejoin.code}</span>
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        )}

        {/* ── Action cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Host */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">Host a Game</h2>
              <p className="text-sm text-muted-foreground">
                Pick a card and share a room code with your crew.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-auto">
              <Button className="w-full gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" />
                Create a Room
              </Button>
            </div>
          </div>

          {/* Join */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold">Join a Game</h2>
              <p className="text-sm text-muted-foreground">
                Got a room code from your host? Enter it below.
              </p>
            </div>
            <form onSubmit={handleJoin} className="flex flex-col gap-2 mt-auto">
              <Input
                placeholder="ABC123"
                value={joinCode}
                onChange={handleJoinInput}
                className="font-mono text-center text-xl tracking-[0.25em] uppercase"
                maxLength={6}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {joinError && <p className="text-xs text-destructive">{joinError}</p>}
              <Button
                type="submit"
                variant="outline"
                className="w-full gap-2"
                disabled={joinCode.length < 6}
              >
                Join Room
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </div>

        </div>

        {/* ── Quick nav ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/history"
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <History className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Game History</p>
              <p className="text-xs text-muted-foreground">Your past games</p>
            </div>
          </Link>
          <Link
            href="/leaderboard"
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <Trophy className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Leaderboard</p>
              <p className="text-xs text-muted-foreground">All-time rankings</p>
            </div>
          </Link>
        </div>

        {/* ── Your card templates ── */}
        <TemplateList />

      </div>

      <CreateRoomDialog open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <HomePageContent />
    </Suspense>
  );
}
