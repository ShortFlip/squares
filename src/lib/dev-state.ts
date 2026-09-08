'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { OtherPlayer, GameWinner } from '@/stores/gameStore';
import type { SquareItem } from '@/types/card';

/**
 * Overrides the game screen renders instead of the store, so the states that
 * are hard to stage live — a dropped connection, a board that has not synced,
 * a full 6x6 room — can be screenshotted deterministically.
 */
export interface DevOverrides {
  forceReconnecting: boolean;
  others?: OtherPlayer[];
  card?: SquareItem[];
  marks?: number[];
  boardSize?: number;
  freeSpace?: boolean;
  /** Stands in for the store's winners so the win moment can be captured. */
  winners?: GameWinner[];
}

/**
 * Reads `?state=reconnecting|syncing|dense|won|won2` — development only.
 *
 * The whole body is behind a NODE_ENV check so the fake players and their
 * names are dead code in a production build and get dropped by the minifier.
 * The query string is read from `window.location` rather than
 * `useSearchParams` so the room page needs no Suspense boundary.
 */
export function useDevState(): DevOverrides | null {
  // The query string never changes without a navigation, so there is nothing
  // to subscribe to — this is only here to read it after hydration without
  // tripping a server/client mismatch.
  const search = useSyncExternalStore(
    noopSubscribe,
    () => window.location.search,
    () => '',
  );

  return useMemo(
    () => buildOverrides(new URLSearchParams(search).get('state')),
    [search],
  );
}

function noopSubscribe(): () => void {
  return () => {};
}

function buildOverrides(state: string | null): DevOverrides | null {
  if (process.env.NODE_ENV === 'production') return null;
  if (!state) return null;

  if (state === 'reconnecting') {
    return { forceReconnecting: true };
  }

  if (state === 'syncing') {
    return { forceReconnecting: false, others: fakeFive().slice(0, 4) };
  }

  // The win moment: Dan has taken column 2. Everyone is synced, because the
  // banner and the gold rail card are what is being looked at.
  if (state === 'won') {
    return {
      forceReconnecting: false,
      others: wonRail(),
      winners: [{ playerId: 'dev-dan', displayName: 'Dan', pattern: 'column' }],
    };
  }

  // Both places taken: the subline changes and `2ND — OPEN` becomes a name.
  if (state === 'won2') {
    return {
      forceReconnecting: false,
      others: wonRail(true),
      winners: [
        { playerId: 'dev-dan', displayName: 'Dan', pattern: 'column' },
        { playerId: 'dev-jess', displayName: 'Jess', pattern: 'row' },
      ],
    };
  }

  if (state === 'dense') {
    // 6x6 with five players — the densest room the design has to survive.
    const size = 6;
    return {
      forceReconnecting: false,
      boardSize: size,
      // The fake card carries no free-space item, so the label must not count
      // one either — otherwise the note disagrees with the board.
      freeSpace: false,
      card: fakeCard(size),
      marks: [0, 1, 2, 4, 7, 9, 13, 15, 19, 20, 26, 28, 31, 33],
      others: fakeFive().map((p, i) => ({
        ...p,
        card: fakeCard(size),
        marks: scatter(size * size, 7 + i * 4, i + 1),
      })),
    };
  }

  return null;
}

/**
 * Deterministic pseudo-marks so a screenshot of the same URL is the same image.
 * A seeded shuffle of every index, sliced — a modular walk can cycle short and
 * never fill the quota.
 */
function scatter(total: number, count: number, salt: number): number[] {
  const cells = Array.from({ length: total }, (_, i) => i);
  let seed = salt * 2654435761;
  for (let i = cells.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const j = seed % (i + 1);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, Math.min(count, total));
}

/**
 * The four rail players with the win already landed: Dan holds a complete
 * column 2, and — for `won2` — Jess holds a complete row 1. Nobody is left
 * unsynced here; an unread board next to a confirmed winner would only muddy
 * what the gold treatment is saying.
 */
function wonRail(jessWins = false): OtherPlayer[] {
  const base = fakeFive().slice(0, 4).map((p) =>
    p.synced ? p : { ...p, synced: true, card: fakeCard(5), marks: [1, 5, 9, 13, 16, 18, 20, 23] },
  );
  return base.map((p) => {
    // Column 2 = indices 1, 6, 11, 16, 21 — the column the canvas shows Dan
    // one away from, now completed.
    if (p.playerId === 'dev-dan') {
      return { ...p, marks: [1, 2, 3, 6, 8, 9, 10, 11, 16, 18, 21, 22], won: true, finishPosition: 1 };
    }
    // Row 1 = indices 0 through 4.
    if (p.playerId === 'dev-jess') {
      return jessWins
        ? { ...p, marks: [0, 1, 2, 3, 4, 5, 6, 9, 13, 14, 17, 21, 23], won: true, finishPosition: 2 }
        : p;
    }
    return p;
  });
}

function fakeCard(boardSize: number): SquareItem[] {
  return Array.from({ length: boardSize * boardSize }, (_, i) => ({
    text: FAKE_SQUARES[i % FAKE_SQUARES.length],
    originalIndex: i,
  }));
}

const FAKE_SQUARES = [
  'Someone rage quits', 'Teammate goes 0-10', 'Hit marker no kill', 'Blames lag',
  'Nobody revives', 'Forfeit vote', 'Killed by a camper', 'Mic feedback squeal',
  'Someone joins late', 'Shot through a wall', 'Killcam roast', 'Reverse boost fail',
  'Whiffed open net', 'Controller disconnects', 'Calls a bad play', 'Sniper quickscope',
  'Own goal', 'Lobby disbands', 'Someone eats on mic', 'Clutches a 1v3',
  'Goes AFK', 'Blame the servers', 'Melee kill', 'Double XP reminder',
];

/**
 * The four rail players from the design canvas, plus a fifth for the dense
 * state. Marks are hand-picked so the labels cover the range: two players one
 * away, one unsynced, one nowhere near.
 */
function fakeFive(): OtherPlayer[] {
  return [
    {
      playerId: 'dev-dan',
      displayName: 'Dan',
      avatarUrl: null,
      card: fakeCard(5),
      // Column 2, one away.
      marks: [1, 2, 3, 6, 8, 9, 10, 16, 18, 21, 22],
      won: false,
      finishPosition: null,
      synced: true,
    },
    {
      playerId: 'dev-marcus',
      displayName: 'Marcus',
      avatarUrl: null,
      card: [],
      marks: [],
      won: false,
      finishPosition: null,
      // The syncing state: present in the room, board not read yet.
      synced: false,
    },
    {
      playerId: 'dev-jess',
      displayName: 'Jess',
      avatarUrl: null,
      card: fakeCard(5),
      // Row 1, one away.
      marks: [0, 1, 2, 3, 5, 6, 9, 13, 14, 17, 19, 21, 23],
      won: false,
      finishPosition: null,
      synced: true,
    },
    {
      playerId: 'dev-tyler',
      displayName: 'Tyler',
      avatarUrl: null,
      card: fakeCard(5),
      marks: [0, 7, 15, 19, 23],
      won: false,
      finishPosition: null,
      synced: true,
    },
    {
      playerId: 'dev-sam',
      displayName: 'Sam',
      avatarUrl: null,
      card: fakeCard(5),
      marks: [4, 8, 11, 16, 20, 22],
      won: false,
      finishPosition: null,
      synced: true,
    },
  ];
}
