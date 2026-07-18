// Supabase Edge Function — server-side bingo verification
// Runs in Deno; all game logic is inlined (can't import from src/).
// Called by the client when a player clicks BINGO!

import { createClient } from 'jsr:@supabase/supabase-js@2';

// ── Inlined game logic ────────────────────────────────────────────────────────
// Kept in sync with src/lib/game/shuffle.ts and win-detection.ts.

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRng(seed: string) {
  return mulberry32(hashSeed(seed));
}

interface SquareItem {
  text?: string;
  imageUrl?: string;
  originalIndex?: number;
  isFreeSpace?: boolean;
}

function fisherYates<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateCard(
  items: SquareItem[],
  seed: string,
  playerId: string,
  boardSize: number,
  shuffleMode: string,
  freeSpace: boolean,
): SquareItem[] {
  const rng = seededRng(`${seed}:${playerId}`);
  const total = boardSize * boardSize;
  const centerIndex = Math.floor(total / 2);
  const indexed = items.map((item, i) => ({ ...item, originalIndex: i }));

  let card: SquareItem[];

  if (shuffleMode === 'full') {
    // Mirror client-side logic exactly (see src/lib/game/shuffle.ts):
    // filter by content rather than position so both new templates (empty center slot)
    // and legacy templates (empty trailing slot) produce the same verified card.
    const pool = indexed.filter((item) => item.text?.trim() || item.imageUrl);
    card = fisherYates(pool, rng).slice(0, freeSpace ? total - 1 : total);

    if (freeSpace) {
      card = [
        ...card.slice(0, centerIndex),
        { text: 'FREE', isFreeSpace: true },
        ...card.slice(centerIndex),
      ];
    }
  } else {
    // Need-based partition sizes — mirrors src/lib/game/shuffle.ts exactly.
    const centerCol = centerIndex % boardSize;
    const needs = Array.from({ length: boardSize }, (_, col) =>
      boardSize - (freeSpace && col === centerCol ? 1 : 0),
    );
    const totalNeed = needs.reduce((a, b) => a + b, 0);

    const sizes = [...needs];
    let extra = indexed.length - totalNeed;
    for (let col = 0; extra > 0; col = (col + 1) % boardSize, extra--) sizes[col]++;

    const columns: SquareItem[][] = [];
    let offset = 0;
    for (let col = 0; col < boardSize; col++) {
      columns.push(fisherYates(indexed.slice(offset, offset + sizes[col]), rng));
      offset += sizes[col];
    }

    card = [];
    const pointers = Array(boardSize).fill(0);
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (freeSpace && row * boardSize + col === centerIndex) {
          card.push({ text: 'FREE', isFreeSpace: true });
        } else {
          card.push(columns[col][pointers[col]++] ?? { text: '' });
        }
      }
    }
  }

  return card;
}

function checkWin(
  marks: Set<number>,
  boardSize: number,
  patterns: string[],
  freeSpace: boolean,
): string | null {
  const effective = new Set(marks);
  if (freeSpace) effective.add(Math.floor((boardSize * boardSize) / 2));

  for (const pattern of patterns) {
    if (matchesPattern(effective, boardSize, pattern)) return pattern;
  }
  return null;
}

function matchesPattern(marks: Set<number>, size: number, pattern: string): boolean {
  switch (pattern) {
    case 'row':
      for (let r = 0; r < size; r++) {
        if (Array.from({ length: size }, (_, c) => r * size + c).every(i => marks.has(i))) return true;
      }
      return false;
    case 'column':
      for (let c = 0; c < size; c++) {
        if (Array.from({ length: size }, (_, r) => r * size + c).every(i => marks.has(i))) return true;
      }
      return false;
    case 'diagonal': {
      const tlbr = Array.from({ length: size }, (_, i) => i * size + i).every(i => marks.has(i));
      if (tlbr) return true;
      return Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)).every(i => marks.has(i));
    }
    case 'four_corners': {
      const t = size * size;
      return marks.has(0) && marks.has(size - 1) && marks.has(t - size) && marks.has(t - 1);
    }
    case 'blackout':
      return marks.size === size * size;
    default:
      return false;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { gameId, marks } = await req.json() as { gameId: string; marks: number[] };

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResp({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User-scoped client — resolves who is making the claim
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonResp({ error: 'Unauthorized' }, 401);

    // Service-role client — bypasses RLS for result writes
    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve player record from auth_id
    const { data: player } = await admin
      .from('players')
      .select('id')
      .eq('auth_id', user.id)
      .single();
    if (!player) return jsonResp({ error: 'Player not found' }, 404);

    // Fetch game with nested room data
    const { data: game } = await admin
      .from('games')
      .select('*, rooms(template_id, settings)')
      .eq('id', gameId)
      .single();
    if (!game) return jsonResp({ error: 'Game not found' }, 404);
    if (game.status !== 'active') return jsonResp({ valid: false, reason: 'Game is not active' });

    const roomData = game.rooms as { template_id: string; settings: { winPatterns?: string[] } };

    const { data: template } = await admin
      .from('card_templates')
      .select('*')
      .eq('id', roomData.template_id)
      .single();
    if (!template) return jsonResp({ error: 'Template not found' }, 404);

    // ── Regenerate this player's card server-side ─────────────────────────
    // Filter empty pool slots BEFORE generateCard, exactly like the client does
    // (GameLobby/RoomClient). originalIndex must be tagged on the filtered pool —
    // the call list indices refer to filtered positions, so tagging the raw
    // template array would shift every index past an empty slot and reject
    // legitimate bingos.
    const items = (template.items as SquareItem[])
      .filter((item) => item.text?.trim() || item.imageUrl);
    const card = generateCard(
      items,
      game.seed,
      player.id,
      template.board_size,
      template.shuffle_mode,
      template.free_space,
    );

    // ── Validate: every claimed mark must be a called item ────────────────
    const calledSet = new Set((game.call_list as number[]).slice(0, game.calls_made));
    const marksSet = new Set(marks);

    for (const gridIndex of marks) {
      const item = card[gridIndex];
      if (!item) return jsonResp({ valid: false, reason: `Invalid grid index ${gridIndex}` });
      if (item.isFreeSpace) continue; // free space is always valid
      if (item.originalIndex === undefined || !calledSet.has(item.originalIndex)) {
        return jsonResp({ valid: false, reason: `Item at position ${gridIndex} has not been called` });
      }
    }

    // ── Check win patterns ────────────────────────────────────────────────
    const winPatterns = roomData.settings?.winPatterns ?? ['row', 'column', 'diagonal'];
    const pattern = checkWin(marksSet, template.board_size, winPatterns, template.free_space);
    if (!pattern) return jsonResp({ valid: false, reason: 'No winning pattern in claimed marks' });

    // ── Persist results ───────────────────────────────────────────────────
    const now = new Date().toISOString();
    const bingoTimeMs = Date.now() - new Date(game.started_at).getTime();

    // Count existing winners to assign finish_position
    const { count: existingWinners } = await admin
      .from('game_players')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .eq('won', true);

    await Promise.all([
      admin.from('game_players').upsert(
        {
          game_id: gameId,
          player_id: player.id,
          card_data: card,
          marks,
          won: true,
          bingo_time_ms: bingoTimeMs,
          finish_position: (existingWinners ?? 0) + 1,
        },
        { onConflict: 'game_id,player_id' },
      ),
      admin.from('games').update({
        status: 'won',
        win_pattern: pattern,
        ended_at: now,
      }).eq('id', gameId),
    ]);

    return jsonResp({ valid: true, pattern });
  } catch (err) {
    console.error('verify-bingo error:', err);
    return jsonResp({ error: 'Internal server error' }, 500);
  }
});

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
