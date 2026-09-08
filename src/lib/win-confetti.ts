import confetti from 'canvas-confetti';

/**
 * The confetti colours are read from the live theme rather than hard-coded, so
 * a theme that shifts its violet or its gold does not end up with a burst that
 * belongs to a different palette. Falls back to the default-theme literals when
 * a variable resolves to nothing (SSR, or a token that was renamed).
 */
function themeColors(): string[] {
  const fallback = ['#7c3aed', '#f59e0b', '#e9c46a', '#ec4899'];
  if (typeof window === 'undefined') return fallback;
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, or: string) => style.getPropertyValue(name).trim() || or;
  return [
    read('--primary', fallback[0]),
    read('--accent', fallback[1]),
    read('--gold', fallback[2]),
    // Pink has no token — it is only ever confetti, so it stays a literal.
    fallback[3],
  ];
}

/**
 * First bingo of the round: two cannons from the top corners, angled inward.
 * `disableForReducedMotion` means the "no confetti" branch is enforced by the
 * library itself, not only by our caller.
 */
export function fireWinConfetti(): void {
  const colors = themeColors();
  const shared = { spread: 55, particleCount: 90, colors, disableForReducedMotion: true };
  confetti({ ...shared, angle: 60, origin: { x: 0.1, y: 0.1 } });
  confetti({ ...shared, angle: 120, origin: { x: 0.9, y: 0.1 } });
}

/** Second place: the same colours, one smaller burst, no second cannon. */
export function fireSecondPlaceConfetti(): void {
  confetti({
    particleCount: 45,
    spread: 60,
    angle: 270,
    origin: { x: 0.5, y: 0.05 },
    colors: themeColors(),
    disableForReducedMotion: true,
  });
}
