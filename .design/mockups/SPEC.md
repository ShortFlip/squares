# Design Canvas Spec — Squares Game Room

Extracted from the published design canvas. Source artboards in this folder:
`Main.dc.html` (Scoreboard), `BingoMoment.dc.html`, `Arena.dc.html` (alternate:
all boards equal size, yours outlined — not specced here), `canvas.json`.

Canvas annotation, verbatim:
> "Scoreboard (recommended): your board stays the hero, everyone else is a live miniature in the rail.
> Arena: every board equal size, yours outlined. Fair comparison, drawn honestly."

## Artboard

Both artboards are **1280 × 800**, `overflow:hidden`, ground `#0f0f14`.

## Palette (no CSS custom properties are used — colors are inline oklch literals)

| Role | Value |
|---|---|
| Ground | `#0f0f14` |
| Text primary | `oklch(0.97 0.005 247)` |
| Text secondary | `oklch(0.72 0.025 240)` |
| Violet (primary / free space / room-code glow) | `oklch(0.62 0.26 278)` |
| Amber (marks, progress, hot lane) | `oklch(0.77 0.175 70)` |
| Emerald (live dot, best-line outline, "one away") | `oklch(0.70 0.175 162)` |
| Gold (winner) | `oklch(0.82 0.16 88)` |
| Square border | `oklch(0.34 0.016 271)` |
| Avatar hues | Dan `oklch(0.68 0.20 25)`, Marcus `oklch(0.70 0.16 200)`, Jess `oklch(0.72 0.19 330)`, Tyler `oklch(0.74 0.17 145)` |

Ground treatment: `radial-gradient(120% 70% at 50% -20%, violet 16% -> transparent 60%)`;
vignette layer `radial-gradient(115% 85% at 50% 45%, transparent 42%, rgba(0,0,0,0.55))` (z 1);
film grain SVG fractalNoise `baseFrequency 0.85`, opacity `0.035` (z 60).

Glass recipe: `linear-gradient(168deg, rgba(255,255,255,.055), .018 42%, .008)`,
border `1px rgba(255,255,255,.085)`, `inset 0 1px 0 rgba(255,255,255,.10)`,
`0 18px 40px -24px rgba(0,0,0,.9)`, `backdrop-filter: blur(14px)`.

## Typography

- Display (`.disp`): **Outfit** 600/700/800 — app name 15/800, hero player name 20/700, rail name 17/700, avatar initial 14px (hero) / 12px (rail) 700, rail section label 13/700 uppercase `0.14em`, banner headline 38/800 line-height 1, free-space text.
- Body (`.stage`): **Plus Jakarta Sans** 400/500/600 — square text 12px/500 (Scoreboard) or 11px/500 (Bingo Moment), best-line note 12/600, rail status line 11/500, banner subline 13/500, copy-link chip 12/600.
- Mono (`.mono`): **JetBrains Mono** 500/700 — room code 26/700 `0.14em`, round label 12/500 uppercase `0.08em`, LIVE 11/700 `0.10em`, score `N / 25` 15/700 hero and 13/700 rail, pills 10–11/700.

## Radii

`16px` hero board panel and win banner · `12px` rail cards and winner icon tile ·
`6px` bingo squares and miniature frame · `2px` miniature tiles · `999px` pills, avatars, progress bars · header bar `0`.

## Scoreboard (Main.dc.html)

- **Header bar**: height `56px`, padding `0 20px`, glass, bottom border only. Left: "Squares" · 1×22px divider · room code `PLZ4KQ` with violet text-shadow glow · "Copy link" pill (13px link icon, violet-tinted). Right: "Round 3" · LIVE pill (7px emerald dot, `0 0 9px` glow) · muted 18px volume-off icon.
- **Body row**: `display:flex; gap:20px; padding:20px 22px; height:744px`.
- **Hero board panel**: glass, `padding:18px 20px`, radius 16, `min-height:704px`, column gap 14, centered.
  - Header strip width `608px`: 30px violet avatar circle "R", "Ryann", pill `YOUR BOARD`, right side "Row 3 — one away" (amber) and `6 / 25`.
  - Grid: 5×5, `608 × 608px`, rows `115px`, gap `8px` (square ≈ 112 × 115).
- **Rail**: width `300px`, column gap `12px`. Header row: `EVERYONE ELSE` / `4 playing`.
  - Rail card: glass, `padding:12px`, radius 12, `gap:12px`, miniature left + stats right.
  - Miniature: 5×5 grid, tiles `20 × 20px`, gap `2px`, content-box `108 × 108px` plus `6px` padding and 1px border → ~`122px` outer; frame radius 6, bg `rgba(0,0,0,0.28)`, border `rgba(255,255,255,0.07)`.
  - Stats column: 26px avatar + name row, `N / 25` mono, `4px` progress bar (track `rgba(255,255,255,.08)`, glowing fill), status line.

### Copy strings (verbatim)

Header: `Squares` · `PLZ4KQ` · `Copy link` · `Round 3` · `Live`
Hero: `Ryann` · `YOUR BOARD` · `Row 3 — one away` · `6 / 25`
Rail: `Everyone Else` · `4 playing` · `Dan` `11 / 25` `Column 2 — one away` (44%) ·
`Marcus` `8 / 25` `No line yet` (32%) · `Jess` `13 / 25` `Row 1 — one away` (52%) ·
`Tyler` `5 / 25` `No line yet` (20%) · free square reads `Free`.
Board squares: Someone rage quits · Teammate goes 0-10 · Hit marker no kill · Dan blames lag · Nobody revives · Rocket League forfeit vote · Killed by a camper · Mic feedback squeal · Someone joins late · Shot through a wall · Killcam replay roast · Reverse boost fail · Free · Whiffed the open net · Controller disconnects · Marcus calls a bad play · Sniper quickscope · Own goal · Lobby disbands · Someone eats on mic · Jess clutches a 1v3 · Tyler goes AFK · Blame the servers · Melee kill · Double XP reminder.

### How state is depicted

- **Marked square** (`.sq-marked-static`): amber 25% fill, transparent border, `0 0 0 2px` amber ring plus `0 0 14px` amber 35% glow.
- **Free space** (`.sq-free`): violet radial 35% at 50%/45%, inset 1px violet 55% ring, `0 0 18px` violet 22%, Outfit 700 uppercase `0.16em` violet.
- **Hot lane** (`.lane`): the near-complete row's remaining square gets a flat amber 7% wash — readable but never competing with the mark glow.
- **Miniature marked** (`.mt-on`): solid amber tile plus `0 0 5px` amber 70% glow. Unmarked `.mt` is `rgba(255,255,255,0.05)`. Free `.mt-free` is solid violet plus `0 0 6px` violet 80%.
- **Best line** (`.mt-line`): `1px` emerald 85% outline, `outline-offset: 0`, applied to every tile of the near-complete line (marked or not), so the line reads as a shape.
- Status line color encodes it too: emerald when a line is one away, muted grey for `No line yet`; the progress fill is emerald when close, amber otherwise.

### Reconnecting / syncing indicators

None are drawn on either artboard. The only connection affordance is the emerald `Live` pill in the header — no offline, reconnecting, or syncing state exists in the mockups, so it still needs designing.

## Bingo Moment (BingoMoment.dc.html)

Same header. Adds a win banner and shrinks the hero board to make room.

- **Win banner**: glass, `margin:14px 22px 0`, `padding:16px 26px`, radius 16, height ≈ `78px`, z 8. Border `1px` gold 55%; `inset 0 1px 0 rgba(255,255,255,.16)` plus `0 0 60px -10px` gold 40%; background `linear-gradient(110deg, emerald 22% 0%, gold 16% 55%, rgba(255,255,255,.02) 100%)`.
  - Left: 46×46 radius-12 trophy tile (gold 22% fill, gold 60% border, 26px trophy icon), gap 18, then headline `DAN GOT BINGO` (Outfit 38/800, `0 0 30px` gold 55% text-shadow) and subline `Column 2 — Round 3. Board stays live; play on for second place.`
  - Right: pills `1ST — DAN` (solid gold on `#0f0f14`) and `2ND — OPEN` (outline `rgba(255,255,255,.14)`, muted text).
- **Confetti**: absolutely positioned SVG `1280 × 430` at top-left, z 7, roughly 40 circles (r 2–5) and rounded rects (5–19px, rotated) in violet, amber, gold, and pink at opacity 0.35–0.85.
- **Body row**: `padding:14px 22px 18px`, `height:642px`. Hero panel `min-height:606px`; header strip and grid width `520px`, grid `520 × 520`, rows `98px`, gap `8px`, square text 11px, free 9px.
- **Rail**: still `300px`, card gap `10px`, no `Everyone Else` header. Miniatures shrink to `90 × 90px` content with `16.4px` tiles, same 2px gap and 6px padding.
- **Winner card treatment**: Dan's rail card gets border `1px` gold 70%, `inset 0 1px 0 rgba(255,255,255,.12)`, `0 0 26px` gold 28% glow; a mono `1ST` pill (gold fill, `#0f0f14` text) beside the name; the progress fill switches to gold (48%, `12 / 25`); the status line reads `Bingo — column 2` in emerald; his miniature outlines the full winning column with `.mt-line`. The other rail cards are unchanged (`Marcus 8 / 25 No line yet`, `Jess 13 / 25 Row 1 — one away`, `Tyler 5 / 25 No line yet`).
- Your hero board is unchanged and still live: `Ryann` · `Row 3 — one away` · `6 / 25`.
