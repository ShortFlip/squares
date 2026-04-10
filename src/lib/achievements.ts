export interface Achievement {
  id: string;
  label: string;
  description: string;
  emoji: string;
  unlocked: boolean;
}

interface AchievementInput {
  wins: number;
  games: number;
  bestTimeMs: number | null;
  winPatterns: string[]; // one entry per win — may include duplicates
}

const DEFINITIONS = [
  {
    id: 'first_win',
    label: 'First Win',
    description: 'Win your first game',
    emoji: '🏆',
    check: ({ wins }: AchievementInput) => wins >= 1,
  },
  {
    id: 'five_wins',
    label: 'On a Roll',
    description: 'Win 5 games',
    emoji: '🎯',
    check: ({ wins }: AchievementInput) => wins >= 5,
  },
  {
    id: 'bingo_pro',
    label: 'Bingo Pro',
    description: 'Win 10 games',
    emoji: '⭐',
    check: ({ wins }: AchievementInput) => wins >= 10,
  },
  {
    id: 'veteran',
    label: 'Veteran',
    description: 'Play 10 games',
    emoji: '🎖️',
    check: ({ games }: AchievementInput) => games >= 10,
  },
  {
    id: 'speed_demon',
    label: 'Speed Demon',
    description: 'Win in under 60 seconds',
    emoji: '⚡',
    check: ({ bestTimeMs }: AchievementInput) =>
      bestTimeMs !== null && bestTimeMs < 60_000,
  },
  {
    id: 'blackout',
    label: 'Blackout!',
    description: 'Win with a full blackout',
    emoji: '🌑',
    check: ({ winPatterns }: AchievementInput) =>
      winPatterns.includes('blackout'),
  },
  {
    id: 'four_corners',
    label: 'Four Corners',
    description: 'Win with four corners',
    emoji: '🔲',
    check: ({ winPatterns }: AchievementInput) =>
      winPatterns.includes('four_corners'),
  },
  {
    id: 'line_hunter',
    label: 'Line Hunter',
    description: 'Win with a diagonal',
    emoji: '📐',
    check: ({ winPatterns }: AchievementInput) =>
      winPatterns.includes('diagonal'),
  },
];

export function computeAchievements(input: AchievementInput): Achievement[] {
  return DEFINITIONS.map((def) => ({
    id: def.id,
    label: def.label,
    description: def.description,
    emoji: def.emoji,
    unlocked: def.check(input),
  }));
}

/** Format bingo_time_ms as "42s" or "1m 23s" */
export function formatTime(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Human-readable win pattern label */
export function formatPattern(pattern: string | null): string {
  if (!pattern) return '—';
  const map: Record<string, string> = {
    row: 'Row',
    column: 'Column',
    diagonal: 'Diagonal',
    four_corners: 'Four Corners',
    blackout: 'Blackout!',
    custom: 'Custom',
  };
  return map[pattern] ?? pattern;
}
