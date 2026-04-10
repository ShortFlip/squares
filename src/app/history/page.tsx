'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ArrowLeft, Trophy, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/hooks/usePlayer';
import { BingoBoard } from '@/components/board/BingoBoard';
import { formatTime, formatPattern } from '@/lib/achievements';
import { cn } from '@/lib/utils';
import type { SquareItem, CardStyles } from '@/types/card';

interface HistoryEntry {
  id: string;
  won: boolean;
  finish_position: number | null;
  bingo_time_ms: number | null;
  marks: number[];
  card_data: SquareItem[];
  game: {
    id: string;
    win_pattern: string | null;
    round_number: number;
    started_at: string;
  };
  template: {
    name: string;
    board_size: number;
    styles: CardStyles;
    free_space: boolean;
  } | null;
  roomName: string | null;
}

export default function HistoryPage() {
  const { player, isLoading: playerLoading } = usePlayer();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!player) return;

    const supabase = createClient();
    supabase
      .from('game_players')
      .select(`
        id, won, finish_position, bingo_time_ms, marks, card_data,
        games!game_players_game_id_fkey (
          id, win_pattern, round_number, started_at,
          rooms!games_room_id_fkey (
            name,
            card_templates!rooms_template_id_fkey (
              name, board_size, styles, free_space
            )
          )
        )
      `)
      .eq('player_id', player.id)
      .then(({ data, error }) => {
        if (error) { console.error(error); setIsLoading(false); return; }

        const mapped: HistoryEntry[] = (data ?? [])
          .map((row) => {
            const game = row.games as {
              id: string;
              win_pattern: string | null;
              round_number: number;
              started_at: string;
              rooms: {
                name: string | null;
                card_templates: {
                  name: string;
                  board_size: number;
                  styles: unknown;
                  free_space: boolean;
                } | null;
              } | null;
            } | null;

            return {
              id: row.id,
              won: row.won,
              finish_position: row.finish_position,
              bingo_time_ms: row.bingo_time_ms,
              marks: (row.marks as number[]) ?? [],
              card_data: (row.card_data as SquareItem[]) ?? [],
              game: {
                id: game?.id ?? '',
                win_pattern: game?.win_pattern ?? null,
                round_number: game?.round_number ?? 1,
                started_at: game?.started_at ?? '',
              },
              template: game?.rooms?.card_templates
                ? {
                    name: game.rooms.card_templates.name,
                    board_size: game.rooms.card_templates.board_size,
                    styles: (game.rooms.card_templates.styles as CardStyles) ?? {},
                    free_space: game.rooms.card_templates.free_space,
                  }
                : null,
              roomName: game?.rooms?.name ?? null,
            };
          })
          // Most recent first — sort by started_at descending
          .sort((a, b) =>
            new Date(b.game.started_at).getTime() - new Date(a.game.started_at).getTime()
          );

        setEntries(mapped);
        setIsLoading(false);
      });
  }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (playerLoading || isLoading) {
    return (
      <main className="min-h-screen px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        </div>
      </main>
    );
  }

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
          <h1 className="font-display text-3xl font-black">Game History</h1>
          <p className="text-muted-foreground text-sm">
            {entries.length > 0
              ? `${entries.length} games played · ${entries.filter((e) => e.won).length} wins`
              : 'No games yet — join a room to start playing'}
          </p>
        </div>

        {/* Game list */}
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground text-sm">No games played yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const date = entry.game.started_at
                ? new Date(entry.game.started_at)
                : null;

              return (
                <li
                  key={entry.id}
                  className={cn(
                    'rounded-xl border bg-card overflow-hidden transition-colors',
                    entry.won ? 'border-accent/40' : 'border-border',
                  )}
                >
                  {/* Summary row */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                  >
                    {/* Win/loss indicator */}
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                      entry.won ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground',
                    )}>
                      {entry.won ? <Trophy className="w-4 h-4" /> : <span className="text-xs font-bold">—</span>}
                    </div>

                    {/* Game info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {entry.template?.name ?? 'Unknown card'}
                        {entry.roomName && (
                          <span className="text-muted-foreground font-normal"> · {entry.roomName}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Round {entry.game.round_number}
                        {date && ` · ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>

                    {/* Result badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.won && (
                        <>
                          {entry.game.win_pattern && (
                            <span className="px-2 py-0.5 rounded bg-accent/20 text-accent text-xs font-medium">
                              {formatPattern(entry.game.win_pattern)}
                            </span>
                          )}
                          {entry.bingo_time_ms !== null && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatTime(entry.bingo_time_ms)}
                            </span>
                          )}
                        </>
                      )}
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      }
                    </div>
                  </button>

                  {/* Expanded: card snapshot */}
                  {isExpanded && entry.card_data.length > 0 && entry.template && (
                    <CardSnapshot entry={entry} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

/**
 * Mini read-only BingoBoard showing the player's card with their marks overlaid.
 * card_data from the DB already has FREE embedded at center (if free space was on),
 * so we filter it out and pass freeSpace=true for correct rendering.
 */
function CardSnapshot({ entry }: { entry: HistoryEntry }) {
  const raw = entry.card_data;
  const hasFreeSpace = raw.some((item) => item.isFreeSpace);

  // Filter out the FREE sentinel so BingoBoard can insert it via its own logic
  const items = hasFreeSpace ? raw.filter((item) => !item.isFreeSpace) : raw;
  const boardSize = entry.template!.board_size;
  const markedIndices = new Set(entry.marks);

  return (
    <div className="px-4 pb-4 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground mb-3 uppercase tracking-widest">Your card</p>
      {/* pointer-events-none prevents interaction with the snapshot */}
      <div className="pointer-events-none">
        <BingoBoard
          items={items}
          boardSize={boardSize}
          freeSpace={hasFreeSpace}
          variant="game"
          styles={entry.template!.styles}
          markedIndices={markedIndices}
          calledIndices={markedIndices}
          className="max-w-xs"
        />
      </div>
    </div>
  );
}
