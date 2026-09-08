# DESIGN.md — Squares

Design intent for the Squares bingo app. Part 1 is settled and binding. Part 2
is deliberately incomplete: follow its guardrails, do not fill gaps with
framework defaults, and ask before inventing.

Written 2026-09-07 from Ryann's own description of game night. Where something
below is a guess rather than his words, it is marked *(guess)*.

---

## Part 1 — UX

### The moment

Three to five friends in a Discord call, playing Call of Duty or Rocket League
on the main monitor. Squares lives in a browser window on the **second
monitor, always visible**, possibly sharing that monitor with Discord. Nobody
is looking at it most of the time. When something on the card happens, someone
calls it out on voice, everyone glances over, marks the square, and goes back
to the game. The mouse hand is busy; the glance is a second or two.

Design consequences:

- The window is **glanceable, not studied**. State must read from across the
  room: whose square just lit, who is close, who won.
- Every interaction is **one click, no confirm**. Nothing may steal focus from
  the game or demand a decision.
- The app is **desktop only**. No mobile work, ever. Assume ~1280×800 minimum
  and a window that may be half a monitor wide.

### Primary verb

**Mark a square.** Everything else (creating cards, resetting, history,
leaderboard) is setup or aftermath. When two things compete for space or
prominence, the board wins.

### Frequencies

| Action | How often | Treatment |
|---|---|---|
| Mark a square | Many times per night, a few seconds each | Big targets, instant feedback, no confirmation |
| Glance at who is close | Constantly, passively | Ambient, always on screen, no click |
| Someone hits bingo | A few times per night, "usually someone gets there quick" | The one moment allowed to be loud |
| Reset for a new round | Right after each bingo | One click for the host, zero for everyone else |
| Join a room | Once per night per person | Paste a link or type a code; no account, no friction |
| Rejoin after a refresh or crash | Occasionally, mid-round | Automatic; land back on the same board with marks intact |
| Create or edit a card | Rarely; before the night, or reused | Can live behind a click |
| History / leaderboard | Rarely | Aftermath; off the game screen entirely |

### Opening state

- **First visit:** name prompt, then the landing. This already exists and is fine.
- **Returning during a night:** the landing must show a **Rejoin** chip for
  the last room you were in, above the join box. One click back into the game.
  Today this does not exist; the landing has no memory of the last room.
- **Arriving via a link:** `/room/CODE` already skips code entry. The host
  screen must offer a **copy link** button, not just the bare code, so pasting
  into Discord is the normal join path.

### Success definition

A friend who just got kicked out of their browser is back on their board, with
their marks, in under five seconds and without asking the host anything.
Everyone can see everyone's board without asking anyone to verify. When
someone hits bingo the whole window makes it obvious, and play continues to the
second winner without the host doing anything.

### Tolerated failures

- A mark lost in the last half-second before a crash is fine. Losing the
  whole board is not.
- Other players' boards being a second or two stale is fine. Them showing
  0/25 after a refresh is not.
- A missed sound effect is fine. A missed bingo announcement is not.

### "Never make me"

- Never make me confirm a mark, a reset, or a rejoin.
- Never cover my board with a modal I have to dismiss while the round is still
  live. A win is a banner and a fanfare, not a wall.
- Never make me type a room code I was already in.
- Never make me verify someone else's bingo by asking them to screenshot.
- Never show me history or leaderboard chrome on the game screen.

### Structure decision

Two genuinely different structures were considered.

**A. Scoreboard (chosen).** My board is the hero, filling most of the window.
A rail on the right holds every other player's board as a live miniature,
readable at a glance (marked squares as filled tiles, best line highlighted),
plus name and progress. The rail is the "everyone's board on one sheet"
request. A win is a full-width banner across the top plus confetti and the
winner's miniature getting a gold treatment; the board stays playable
underneath so the second winner can still happen.

**B. Arena (rejected).** Every board the same size in a grid, mine outlined.
Feels like a spectator view and makes the primary verb worse: my squares shrink
to fit four other boards, and marking becomes fiddly at half-monitor width.
Looking at other boards is passive and constant; marking is active and
frequent. Active wins the pixels.

Also rejected: keeping today's fullscreen win overlay. It blocks the board
until the host clicks, which contradicts the play-to-two-winners rule already
in use.

### State coverage

Every screen must handle all of these, not just the happy path:

| State | Where | Behavior |
|---|---|---|
| Empty | Lobby with one player | Big room code + copy link, "waiting for friends" with the invite as the only CTA |
| Loading | Room page on refresh | Skeleton of the board shape, not a spinner; marks pop in when restored |
| Reconnecting | Realtime dropped | Thin amber bar at the top, board still markable, syncs on return |
| Partial | A player's marks not yet received | Their miniature shows a dim "syncing" state, never 0/25 |
| Error | A write failed | Toast, board unaffected, retry silently |
| Dense | 6×6 card, 5 players | Rail scrolls; board never shrinks below a markable size |
| Won | One bingo, round live | Banner + confetti + gold miniature; board stays interactive |
| Round over | Host reset | Board flips to the new card with the round-start sound, no dialog |
| Night over | Host ended | Game Over with Play Again (host) or waiting copy (others) |

### Rejoin, specifically

What is restored today: the card, my marks, calls, winners. What is lost:
other players' marks (broadcast only), the round start time, and the landing
page has no memory of the room. The upgrade persists other players' marks
from the database on reconnect and adds the last-room chip. These are UX
requirements, not polish.

---

## Part 2 — Visual

**Status: stubbed with guardrails.** Fill only from real references, not
defaults. The palette and fonts in CLAUDE.md ("Arcade Lounge") stand and the
first polish pass (glow pulse, caller flip, noise grain) is in. What follows
is the direction for the upgrade.

### Direction in his words

"Gamify it. Gamer aesthetic. A little flashy, not over the top." The bingo
sites he has used are "very bare-bones." He wants themes and colors, and a
moment when someone hits bingo.

### Guardrails (known now)

- **Dark-first, always.** Deep charcoal ground. Light mode is a theme, not the
  default.
- **Neon on black, not gray on gray.** Accent glows are the signature: marked
  squares, the winner, the live indicator. Everything not glowing is quiet so
  the glow reads. No flat gray surfaces; use translucent glass over the ground
  with a 1px lit edge.
- **One loud moment.** The bingo banner is allowed to be over the top for two
  seconds. Nothing else is. If everything glows, nothing does.
- **Themes are palettes, not layouts.** A theme swaps ground, accent, and glow
  color. The structure never changes between themes. Card presets and app
  themes are separate things and should stay separate.
- **Readable from across the room.** Player names, progress, and the room code
  in display size. Monospace for the code and any numbers.
- **Motion:** 150ms micro, 300ms panel, one long celebratory sequence. Every
  animation respects reduced-motion.
- **Glass over gradient.** Panels are translucent with a subtle top highlight,
  sitting on a vignetted ground, not opaque cards on a flat color.

### References that fit (Mobbin, 2026-09-07)

Local copies in `.design/refs/` (gitignored): `canva-lobby.webp`,
`suno-rail.webp`, `neon-snake-board.webp`, `codecademy-win.webp`. The Mobbin
links need a logged-in Mobbin session; the local files do not.

- [Canva Live](https://mobbin.com/screens/cfe8b2c6-9b1a-4cf7-bb9b-ce4917a10d2e): the giant join code with "visit X and enter code" as the whole
  screen. That is the lobby.
- [Suno Radio](https://mobbin.com/screens/72ebb179-c187-41e5-9caf-0eb6f7567c9e): glass panels over a vivid blurred backdrop, live activity in a
  side column. That is the rail.
- [Neon Snake](https://mobbin.com/screens/2584fa5d-dd69-4543-bbb7-ea1efb656eb1) (Google AI Studio): glowing marks on a dark grid with a
  leaderboard overlay. That is the board.
- [Codecademy course-complete](https://mobbin.com/screens/c827145c-7d03-4771-908c-6a6c4be2abc7): full-bleed dark celebration with confetti and
  one gold object. That is the bingo banner.

### Still to specify

- Type scale (display sizes for code, names, banner)
- Radius language (squares vs panels vs pills)
- Theme set: names and the three colors each one swaps
- The bingo sequence, beat by beat (sound, banner, confetti, gold miniature,
  settle)
- The miniature board's visual language at ~120px wide
- Reconnecting and syncing indicators
