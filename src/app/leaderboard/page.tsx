'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/hooks/usePlayer';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { formatTime } from '@/lib/achievements';
import { cn } from '@/lib/utils';

interface LeaderboardRow {
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
  wins: number;
  games: number;
  winRate: number;
  bestTimeMs: number | null;
}

export default function LeaderboardPage() {
  const { player } = usePlayer();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!player) return;
    const myId = player.id;

    async function load() {
      const supabase = createClient();

      // The board is scoped to the friend group, which we define as everyone
      // who has shared a room with me (Decision B). Step one: my rooms; step
      // two: every row from every round of those rooms. `!inner` makes the room
      // filter apply to the parent row rather than merely nulling the embed.
      const { data: mine, error: mineError } = await supabase
        .from('game_players')
        .select('games!game_players_game_id_fkey (room_id)')
        .eq('player_id', myId);

      if (mineError) { console.error(mineError); setIsLoading(false); return; }

      const roomIds = Array.from(new Set(
        (mine ?? [])
          .map((row) => (row.games as { room_id: string } | null)?.room_id)
          .filter((id): id is string => !!id),
      ));

      if (roomIds.length === 0) { setRows([]); setIsLoading(false); return; }

      const { data, error } = await supabase
        .from('game_players')
        .select(`
          player_id, won, bingo_time_ms,
          games!inner ( room_id, status ),
          players!game_players_player_id_fkey (
            display_name, avatar_url
          )
        `)
        .in('games.room_id', roomIds);

      {
        if (error) { console.error(error); setIsLoading(false); return; }

        // Aggregate stats per player client-side
        const map = new Map<string, LeaderboardRow>();

        (data ?? []).forEach((record) => {
          const p = record.players as { display_name: string; avatar_url: string | null } | null;
          if (!p) return;

          // A round the host abandoned never happened, for anybody.
          const g = record.games as unknown as { status: string } | null;
          if (g?.status === 'cancelled') return;

          if (!map.has(record.player_id)) {
            map.set(record.player_id, {
              playerId: record.player_id,
              displayName: p.display_name,
              avatarUrl: p.avatar_url,
              wins: 0,
              games: 0,
              winRate: 0,
              bestTimeMs: null,
            });
          }

          const row = map.get(record.player_id)!;
          row.games++;
          if (record.won) {
            row.wins++;
            if (record.bingo_time_ms !== null) {
              row.bestTimeMs =
                row.bestTimeMs === null
                  ? record.bingo_time_ms
                  : Math.min(row.bestTimeMs, record.bingo_time_ms);
            }
          }
        });

        // Compute win rate + sort by wins desc, then best time asc
        const sorted = [...map.values()]
          .map((r) => ({ ...r, winRate: r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0 }))
          .sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            // Tiebreak: better win rate
            if (b.winRate !== a.winRate) return b.winRate - a.winRate;
            // Tiebreak: faster best time
            if (a.bestTimeMs !== null && b.bestTimeMs !== null) return a.bestTimeMs - b.bestTimeMs;
            return 0;
          });

        setRows(sorted);
        setIsLoading(false);
      }
    }

    load();
  }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
          <h1 className="font-display text-3xl font-black">Leaderboard</h1>
          <p className="text-muted-foreground text-sm">
            Everyone who has played a night with you. Cancelled rounds don&apos;t count.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="font-display font-bold">No one on the board yet</p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[2rem_1fr_3rem_3rem_4rem_5rem] gap-3 items-center px-4 text-[11px] text-muted-foreground uppercase tracking-widest">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Wins</span>
              <span className="text-right">Games</span>
              <span className="text-right">Win %</span>
              <span className="text-right">Best time</span>
            </div>

            <ul className="space-y-2">
              {rows.map((row, i) => {
                const rank = i + 1;
                const isMe = row.playerId === player?.id;
                const medal =
                  rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

                return (
                  <li
                    key={row.playerId}
                    className={cn(
                      'grid grid-cols-[2rem_1fr_3rem_3rem_4rem_5rem] gap-3 items-center',
                      'rounded-xl border px-4 py-3 transition-colors',
                      isMe
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-card',
                    )}
                  >
                    {/* Rank */}
                    <span className="text-sm font-mono font-bold text-muted-foreground">
                      {medal ?? `${rank}`}
                    </span>

                    {/* Player */}
                    <div className="flex items-center gap-2 min-w-0">
                      <PlayerAvatar
                        playerId={row.playerId}
                        displayName={row.displayName}
                        avatarUrl={row.avatarUrl}
                        size="xs"
                      />
                      <span className="text-sm font-medium truncate">
                        {row.displayName}
                        {isMe && (
                          <span className="text-muted-foreground text-xs font-normal ml-1">(you)</span>
                        )}
                      </span>
                    </div>

                    {/* Wins */}
                    <span className="text-right font-display font-bold text-primary">
                      {row.wins}
                    </span>

                    {/* Games */}
                    <span className="text-right text-sm text-muted-foreground">
                      {row.games}
                    </span>

                    {/* Win % */}
                    <span className="text-right text-sm text-muted-foreground">
                      {row.winRate}%
                    </span>

                    {/* Best time */}
                    <span className="text-right text-sm font-mono text-muted-foreground">
                      {formatTime(row.bestTimeMs)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
