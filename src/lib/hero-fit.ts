/**
 * Geometry of the game screen's hero board, shared by GameView and the loading
 * skeleton so the skeleton's grid sits exactly where the real one lands.
 *
 * The grid used to be a fixed 608px (520px under the win banner). A maximized
 * browser on a 1280×800 display only has ~670px of viewport, and a 960px-wide
 * window (half a 1920 monitor) only has a ~596px hero column, so the bottom
 * row was clipped and the panel slid under the rail. Now the grid takes the
 * smallest of three sizes: its design cap, the column's width, and the
 * column's height — each minus the panel chrome around the grid.
 *
 * Why CSS and not a resize listener: the hero column is a size container
 * (`container-type: size`), so `cqw`/`cqh` are the space the layout actually
 * gave it — after the header, the reconnecting bar, the win banner and the
 * body padding have all taken theirs. A JS measurement would have to re-run on
 * every one of those changes and would paint a frame at the wrong size first.
 */

/** Header height. The body is sized against it, so it lives in one place. */
export const HEADER_H = 56;

/** The design size of the hero grid — reached whenever the window allows. */
export const GRID_MAX = 608;

/** While the win banner is up the grid gives back 88px to make room for it. */
export const GRID_MAX_WON = 520;

/**
 * The floor. Below it a 6×6 square drops under ~40px, which stops being an
 * easy target mid-game, so a window this small clips rather than shrinking the
 * board further ("board never shrinks below a markable size").
 */
export const GRID_MIN = 280;

/** Hero panel padding and the name row above the grid — the grid's chrome. */
export const PANEL_PAD_X = 20;
export const PANEL_PAD_Y = 18;
export const NAME_ROW_H = 30;
export const PANEL_GAP = 14;

/**
 * The hero grid's width (and so its height — squares are aspect-square) as a
 * CSS length. Only valid on a descendant of the `.hero-fit` size container.
 *
 *   clamp(280px, min(100cqw − 40px, 100cqh − 80px), 608px | 520px)
 */
export function heroGridSize(won: boolean): string {
  const cap = won ? GRID_MAX_WON : GRID_MAX;
  const fitWidth = `100cqw - ${PANEL_PAD_X * 2}px`;
  const fitHeight = `100cqh - ${PANEL_PAD_Y * 2 + NAME_ROW_H + PANEL_GAP}px`;
  return `clamp(${GRID_MIN}px, min(${fitWidth}, ${fitHeight}), ${cap}px)`;
}
