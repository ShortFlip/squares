'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowRight, Grid3x3, History, Trophy } from 'lucide-react';
import { CreateRoomDialog } from '@/components/game/CreateRoomDialog';
import { TemplateList } from '@/components/game/TemplateList';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeRoomCode, isValidRoomCode } from '@/lib/game/room-code';

// Separated into its own component because useSearchParams() requires a Suspense boundary
function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(() => searchParams.get('create') === 'true');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

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
