import { describe, it, expect } from 'vitest';
import { buildLeaderboard, isScoredRound, type LeaderboardRecord } from '../stats';

const rec = (
  playerId: string,
  gameStatus: string | null,
  won = false,
  bingoTimeMs: number | null = null,
): LeaderboardRecord => ({
  playerId,
  displayName: playerId.toUpperCase(),
  avatarUrl: null,
  won,
  bingoTimeMs,
  gameStatus,
});

describe('isScoredRound', () => {
  it('counts only won rounds', () => {
    expect(isScoredRound('won')).toBe(true);
    expect(isScoredRound('active')).toBe(false);
    expect(isScoredRound('cancelled')).toBe(false);
    expect(isScoredRound(null)).toBe(false);
    expect(isScoredRound(undefined)).toBe(false);
  });
});

describe('buildLeaderboard', () => {
  it('ignores abandoned (active) and cancelled rounds for games played', () => {
    const rows = buildLeaderboard([
      rec('a', 'won', true, 60_000),
      rec('a', 'active'),     // host closed the tab instead of ending the night
      rec('a', 'cancelled'),  // host ended a round nobody won
      rec('b', 'won'),
      rec('b', 'active'),
    ]);
    const a = rows.find((r) => r.playerId === 'a')!;
    const b = rows.find((r) => r.playerId === 'b')!;
    expect(a).toMatchObject({ games: 1, wins: 1, winRate: 100, bestTimeMs: 60_000 });
    expect(b).toMatchObject({ games: 1, wins: 0, winRate: 0 });
  });

  it('leaves out a player whose only rounds never finished', () => {
    expect(buildLeaderboard([rec('c', 'active'), rec('c', 'cancelled')])).toEqual([]);
  });

  it('ranks by wins, then win rate, then fastest best time', () => {
    const rows = buildLeaderboard([
      // a: 2 wins in 3
      rec('a', 'won', true, 50_000), rec('a', 'won', true, 70_000), rec('a', 'won'),
      // b: 2 wins in 2
      rec('b', 'won', true, 90_000), rec('b', 'won', true, 80_000),
      // c and d: 1 win in 1, c faster
      rec('c', 'won', true, 30_000),
      rec('d', 'won', true, 40_000),
    ]);
    expect(rows.map((r) => r.playerId)).toEqual(['b', 'a', 'c', 'd']);
    expect(rows[0].bestTimeMs).toBe(80_000);
    expect(rows[1].winRate).toBe(67);
  });
});
