'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { computeAchievements, formatTime, formatPattern } from '@/lib/achievements';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import type { Achievement } from '@/lib/achievements';

interface StatsData {
  totalGames: number;
  totalWins: number;
  bestTimeMs: number | null;
  topPattern: string | null;
  achievements: Achievement[];
}

interface PlayerStatsProps {
  playerId: string;
  displayName: string;
  avatarUrl?: string | null;
  /** When true, shows a compact single-section layout instead of the full card */
  compact?: boolean;
}

export function PlayerStats({ playerId, displayName, avatarUrl, compact }: PlayerStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('game_players')
      .select('won, bingo_time_ms, games!game_players_game_id_fkey(win_pattern, status)')
      .eq('player_id', playerId)
      .then(({ data: raw }) => {
        if (!raw) { setIsLoading(false); return; }

        // A round the host abandoned counts for nobody — same rule the
        // leaderboard applies, so the two screens never disagree.
        const data = raw.filter(
          (r) => (r.games as { status: string } | null)?.status !== 'cancelled',
        );

        const totalGames = data.length;
        const wins = data.filter((r) => r.won);
        const totalWins = wins.length;

        const times = wins
          .map((r) => r.bingo_time_ms)
          .filter((t): t is number => t !== null);
        const bestTimeMs = times.length > 0 ? Math.min(...times) : null;

        // Count wins per pattern to find the most common
        const patternCounts: Record<string, number> = {};
        wins.forEach((r) => {
          const p = (r.games as { win_pattern: string | null } | null)?.win_pattern;
          if (p) patternCounts[p] = (patternCounts[p] ?? 0) + 1;
        });
        const topPattern = Object.entries(patternCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        const winPatterns = wins
          .map((r) => (r.games as { win_pattern: string | null } | null)?.win_pattern)
          .filter((p): p is string => !!p);

        const achievements = computeAchievements({
          wins: totalWins,
          games: totalGames,
          bestTimeMs,
          winPatterns,
        });

        setStats({ totalGames, totalWins, bestTimeMs, topPattern, achievements });
        setIsLoading(false);
      });
  }, [playerId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading stats…
      </div>
    );
  }

  if (!stats) return null;

  const winRate = stats.totalGames > 0
    ? Math.round((stats.totalWins / stats.totalGames) * 100)
    : 0;

  const unlockedCount = stats.achievements.filter((a) => a.unlocked).length;

  if (compact) {
    // Inline version for ProfileModal
    return (
      <div className="space-y-4">
        {/* Stat pills */}
        <div className="grid grid-cols-3 gap-2">
          <StatPill label="Games" value={stats.totalGames} />
          <StatPill label="Wins" value={stats.totalWins} highlight />
          <StatPill label="Win %" value={`${winRate}%`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatPill label="Best time" value={formatTime(stats.bestTimeMs)} />
          <StatPill label="Top pattern" value={formatPattern(stats.topPattern)} />
        </div>

        {/* Badges */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Badges — {unlockedCount}/{stats.achievements.length} unlocked
          </p>
          <div className="flex flex-wrap gap-2">
            {stats.achievements.map((badge) => (
              <BadgePip key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Full card layout for leaderboard/history
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {/* Player identity */}
      <div className="flex items-center gap-3">
        <PlayerAvatar
          playerId={playerId}
          displayName={displayName}
          avatarUrl={avatarUrl}
          size="md"
        />
        <div>
          <p className="font-semibold">{displayName}</p>
          <p className="text-xs text-muted-foreground">
            {stats.totalGames} games · {unlockedCount} badges
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatPill label="Games" value={stats.totalGames} />
        <StatPill label="Wins" value={stats.totalWins} highlight />
        <StatPill label="Win %" value={`${winRate}%`} />
        <StatPill label="Best time" value={formatTime(stats.bestTimeMs)} />
      </div>

      {/* Badges */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">Badges</p>
        <div className="flex flex-wrap gap-2">
          {stats.achievements.map((badge) => (
            <BadgePip key={badge.id} badge={badge} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
      <p className={`font-display font-bold text-lg ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

function BadgePip({ badge }: { badge: Achievement }) {
  return (
    <div
      title={`${badge.label}: ${badge.description}`}
      className={`
        flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-center
        border transition-all
        ${badge.unlocked
          ? 'border-primary/30 bg-primary/10'
          : 'border-border bg-muted/30 opacity-40 grayscale'
        }
      `}
    >
      <span className="text-lg leading-none">{badge.emoji}</span>
      <span className="text-[9px] text-muted-foreground leading-none max-w-[48px]">
        {badge.label}
      </span>
    </div>
  );
}
