'use client';

interface HostControlsProps {
  onNewRound: () => void;
  onEndGame: () => void;
}

/**
 * The host's two ways to move the night along.
 *
 * Rendered in two places — the win banner (when someone has won) and the game
 * header (when nobody has) — so a round that nobody wins is not a dead end.
 * One implementation so the pair can never drift apart in copy or styling.
 *
 * One click each, no confirm: DESIGN.md — "Never make me confirm a mark, a
 * reset, or a rejoin."
 */
export function HostControls({ onNewRound, onEndGame }: HostControlsProps) {
  return (
    <>
      <button
        type="button"
        onClick={onNewRound}
        className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-foreground/85 border border-white/12 hover:bg-white/8 hover:text-foreground transition-colors duration-150"
      >
        New Round
      </button>
      <button
        type="button"
        onClick={onEndGame}
        className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-muted-foreground border border-white/12 hover:bg-white/8 hover:text-foreground transition-colors duration-150"
      >
        End Night
      </button>
    </>
  );
}
