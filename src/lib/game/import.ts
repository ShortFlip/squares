/**
 * Parse a pasted item list into clean, de-duplicated item texts.
 *
 * Why the newline-first rule: most people paste a list from Notes or a doc,
 * where each item is its own line and commas are legitimate punctuation
 * inside an item ("Someone says 'well, actually'"). Splitting on commas
 * unconditionally would shred those. Commas are only a separator when the
 * paste is a single line, which is the "a, b, c" case people type by hand.
 *
 * Dedupe is case-insensitive but keeps the FIRST spelling the user typed —
 * their capitalization is the one that ends up on the card.
 */
export function parseImport(text: string): string[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // A single line with no other content is the hand-typed comma case.
  const raw =
    lines.length === 1
      ? lines[0].split(',').map((p) => p.trim()).filter(Boolean)
      : lines;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
