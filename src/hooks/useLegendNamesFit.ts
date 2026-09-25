'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Whether the hero name row has room for the legend's game names.
 *
 * The row is one fixed 30px line the width of the board: avatar, name and
 * pill on the left; the legend, the best-line note and the score on the
 * right. "Rocket League" and "Call of Duty" fit beside a short name and note
 * at the 608px board, but not under the win banner (520px), and not beside a
 * long note ("Column 5 — three away") — and a second row would take its
 * height from the board. So when they do not fit, the names go and the icons
 * stay (BoardLegend keeps each name as a tooltip), and the player's own name
 * is never the thing that truncates.
 *
 * Measured rather than guessed from the width alone, because the fit depends
 * on the player's name and the note, and the note changes with every mark.
 * The first check runs in a layout effect so the mount never paints the wrong
 * layout; later ones (a resize, the banner arriving, a new note) run on the
 * next frame, which keeps a state change out of the ResizeObserver callback.
 *
 * Expects the row's first child to be the left group, holding the name as
 * `[data-hero-name]`, and the second the right group, holding the legend.
 */
export function useLegendNamesFit(row: HTMLElement | null, enabled: boolean): boolean {
  const [showNames, setShowNames] = useState(true);
  // What the names add over the icons alone, remembered from the last time
  // they were on screen, so a row showing icons can tell when they fit again.
  const namesWidth = useRef(0);

  useLayoutEffect(() => {
    if (!enabled || !row) return;
    const left = row.children[0] as HTMLElement | undefined;
    const right = row.children[1] as HTMLElement | undefined;
    if (!left || !right) return;

    const check = () => {
      const names = right.querySelectorAll<HTMLElement>('[data-legend-name]');
      if (names.length > 0) {
        let width = 0;
        for (const name of names) {
          // Each name brings its own gap to the icon with it.
          const chipGap = parseFloat(getComputedStyle(name.parentElement ?? name).columnGap) || 0;
          width += name.getBoundingClientRect().width + chipGap;
        }
        namesWidth.current = width;
      }

      // The name truncates rather than overflowing, so the left group's
      // rendered width hides what it lost; add the clipped part back.
      const heroName = left.querySelector<HTMLElement>('[data-hero-name]');
      const clipped = heroName ? heroName.scrollWidth - heroName.clientWidth : 0;
      const leftNeeds = left.getBoundingClientRect().width + clipped;
      const rightNeeds = right.getBoundingClientRect().width + (names.length > 0 ? 0 : namesWidth.current);
      const rowGap = parseFloat(getComputedStyle(row).columnGap) || 0;

      // Half a pixel of slack: sub-pixel text widths must not flip it back and forth.
      setShowNames(leftNeeds + rowGap + rightNeeds <= row.clientWidth + 0.5);
    };

    check();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    });
    observer.observe(row);
    observer.observe(left);
    observer.observe(right);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [row, enabled]);

  return showNames;
}
